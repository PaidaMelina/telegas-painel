import { FastifyInstance } from 'fastify';
import { pool } from '../db';

const STATUS_ABERTOS = ['pendente', 'em_andamento', 'adiada'];

const RESULTADOS = [
  // desfecho de visita a cliente
  'recuperado', 'sem_sucesso', 'nao_estava', 'perdido', 'engano',
  // desfecho de tarefa operacional
  'feito', 'nao_feito', 'nao_necessario',
];
const STATUS = ['pendente', 'em_andamento', 'concluida', 'adiada', 'descartada'];
const TIPOS = ['visita', 'cobranca', 'cadastro', 'follow_up', 'oportunidade', 'compra', 'operacional', 'outro'];
const RECORRENCIAS = ['semanal', 'quinzenal', 'mensal'];

/**
 * Próximo prazo de uma tarefa que se repete.
 *
 * Trabalha com texto na entrada e na saída, tratando o valor como horário de
 * parede: "sábado às 10h" continua sendo 10h na semana seguinte. Converter
 * para Date e de volta faria o horário escorregar conforme o fuso do processo,
 * e ainda mudaria sozinho na virada do horário de verão.
 */
function proximoPrazo(prazoIso: string, recorrencia: string): string {
  const d = new Date(prazoIso);
  if (recorrencia === 'semanal')   d.setDate(d.getDate() + 7);
  if (recorrencia === 'quinzenal') d.setDate(d.getDate() + 14);
  if (recorrencia === 'mensal')    d.setMonth(d.getMonth() + 1);

  // Remonta a partir dos componentes locais, sem marcação de fuso.
  const dd = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dd(d.getMonth() + 1)}-${dd(d.getDate())}`
       + `T${dd(d.getHours())}:${dd(d.getMinutes())}:${dd(d.getSeconds())}`;
}

export async function tarefasRoutes(server: FastifyInstance) {
  // GET /api/tarefas — lista, com a pauta aberta primeiro
  //
  // `abertas` é o modo usado pela tela do gerente: traz apenas o que ainda
  // exige ação, já ordenado por prioridade. Tarefas adiadas só reaparecem
  // quando chega a data marcada.
  server.get('/', async (request, reply) => {
    const { status, limit = 100 } = request.query as { status?: string; limit?: number };

    const cond: string[] = [];
    const params: any[] = [];

    if (status === 'abertas' || !status) {
      cond.push(`(
        t.status IN ('pendente','em_andamento')
        OR (t.status = 'adiada' AND (t.adiada_para IS NULL OR t.adiada_para <= CURRENT_DATE))
      )`);
    } else if (status !== 'todas') {
      params.push(status);
      cond.push(`t.status = $${params.length}`);
    }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';
    params.push(limit);

    try {
      const { rows } = await pool.query(
        `SELECT t.*,
                c.nome     AS cliente_nome,
                c.telefone AS cliente_telefone,
                c.endereco AS cliente_endereco,
                c.bairro   AS cliente_bairro,
                COALESCE(c.etiquetas, '{}') AS cliente_etiquetas,
                u.nome     AS criado_por_nome
           FROM public.telegas_tarefas t
           LEFT JOIN public.telegas_clientes c ON c.id = t.cliente_id
           LEFT JOIN public.telegas_usuarios u ON u.id = t.criado_por
           ${where}
          ORDER BY
            -- Prazo apertado passa à frente da prioridade: perder as 10h do
            -- sábado custa a semana, independente de quão importante era.
            CASE WHEN t.status IN ('pendente','em_andamento')
                  AND t.prazo IS NOT NULL
                  AND t.prazo <= NOW() + INTERVAL '2 days'
                 THEN 0 ELSE 1 END,
            t.prioridade DESC,
            t.prazo ASC NULLS LAST,
            t.criado_em ASC
          LIMIT $${params.length}`,
        params
      );
      return rows.map(serializar);
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar tarefas' });
    }
  });

  // GET /api/tarefas/resumo — contadores do cabeçalho
  server.get('/resumo', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status = 'pendente')::int      AS pendentes,
          COUNT(*) FILTER (WHERE status = 'em_andamento')::int  AS em_andamento,
          COUNT(*) FILTER (WHERE status = 'adiada')::int        AS adiadas,
          COUNT(*) FILTER (WHERE status = 'concluida'
            AND concluida_em >= date_trunc('week', NOW()))::int AS concluidas_semana,
          COUNT(*) FILTER (WHERE status = 'concluida'
            AND resultado = 'recuperado'
            AND concluida_em >= date_trunc('week', NOW()))::int AS recuperados_semana,
          COALESCE(SUM(valor_risco) FILTER (
            WHERE status IN ('pendente','em_andamento')), 0)    AS valor_em_risco
        FROM public.telegas_tarefas
      `);
      const r = rows[0];
      return {
        pendentes: r.pendentes,
        emAndamento: r.em_andamento,
        adiadas: r.adiadas,
        concluidasSemana: r.concluidas_semana,
        recuperadosSemana: r.recuperados_semana,
        valorEmRisco: parseFloat(r.valor_em_risco) || 0,
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao calcular resumo' });
    }
  });

  // POST /api/tarefas
  server.post('/', async (request, reply) => {
    const b = request.body as any;
    const usuario = (request as any).user;

    if (!b?.titulo?.trim()) {
      return reply.code(400).send({ error: 'Informe o título da tarefa' });
    }
    if (b.tipo && !TIPOS.includes(b.tipo)) {
      return reply.code(400).send({ error: 'Tipo inválido' });
    }
    if (b.recorrencia && !RECORRENCIAS.includes(b.recorrencia)) {
      return reply.code(400).send({ error: 'Recorrência inválida' });
    }
    // Sem prazo não há como calcular a ocorrência seguinte.
    if (b.recorrencia && !b.prazo) {
      return reply.code(400).send({ error: 'Tarefa que se repete precisa de prazo' });
    }

    try {
      const { rows } = await pool.query(
        `INSERT INTO public.telegas_tarefas
           (cliente_id, tipo, origem, titulo, descricao, prioridade, valor_risco,
            prazo, recorrencia, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          b.clienteId || null,
          b.tipo || 'visita',
          // Quem cria manualmente marca a própria origem: o administrador
          // precisa distinguir o que pediu do que o gerente se atribuiu.
          usuario?.papel === 'gerente' ? 'gerente' : 'admin',
          b.titulo.trim(),
          b.descricao?.trim() || null,
          Number.isFinite(b.prioridade) ? b.prioridade : 50,
          b.valorRisco ?? null,
          b.prazo || null,
          b.recorrencia || null,
          usuario?.id || null,
        ]
      );
      return reply.code(201).send({ id: rows[0].id });
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar tarefa' });
    }
  });

  // PATCH /api/tarefas/:id — muda estado ou edita
  server.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const b = request.body as any;

    if (b.status && !STATUS.includes(b.status)) {
      return reply.code(400).send({ error: 'Status inválido' });
    }
    if (b.resultado && !RESULTADOS.includes(b.resultado)) {
      return reply.code(400).send({ error: 'Resultado inválido' });
    }
    // Concluir sem dizer o que aconteceu esvazia o propósito do registro:
    // é o resultado que mostra se a visita adiantou alguma coisa.
    if (b.status === 'concluida' && !b.resultado) {
      return reply.code(400).send({ error: 'Informe o resultado ao concluir a tarefa' });
    }
    if (b.status === 'adiada' && !b.adiadaPara) {
      return reply.code(400).send({ error: 'Informe para quando adiar' });
    }

    const sets: string[] = [];
    const params: any[] = [];
    const set = (col: string, val: any) => { params.push(val); sets.push(`${col} = $${params.length}`); };

    if (b.titulo !== undefined)      set('titulo', b.titulo.trim());
    if (b.descricao !== undefined)   set('descricao', b.descricao?.trim() || null);
    if (b.tipo !== undefined)        set('tipo', b.tipo);
    if (b.prioridade !== undefined)  set('prioridade', b.prioridade);
    if (b.observacao !== undefined)  set('observacao', b.observacao?.trim() || null);
    if (b.resultado !== undefined)   set('resultado', b.resultado || null);
    if (b.prazo !== undefined)       set('prazo', b.prazo || null);
    if (b.recorrencia !== undefined) set('recorrencia', b.recorrencia || null);
    if (b.adiadaPara !== undefined)  set('adiada_para', b.adiadaPara || null);

    if (b.status !== undefined) {
      set('status', b.status);
      // Sair de "concluída" tem que limpar a data, senão o resumo semanal
      // continua contando uma tarefa que voltou a ficar aberta.
      // NOW() do banco, não new Date() do Node: a conexão está no fuso de
      // operação, então é ele que dá o horário coerente com o resto da tabela.
      if (b.status === 'concluida') {
        sets.push('concluida_em = NOW()');
      } else {
        set('concluida_em', null);
      }
      if (b.status !== 'adiada') set('adiada_para', null);
    }

    if (!sets.length) return reply.code(400).send({ error: 'Nada para atualizar' });

    params.push(id);
    try {
      const { rows } = await pool.query(
        `UPDATE public.telegas_tarefas SET ${sets.join(', ')}
          WHERE id = $${params.length} RETURNING id`,
        params
      );
      if (!rows.length) return reply.code(404).send({ error: 'Tarefa não encontrada' });

      // Rotina que se repete: concluir uma ocorrência abre a seguinte, já com
      // o próximo prazo. Sem isso o gerente teria que recriar à mão toda
      // semana, e a que ele esquecesse simplesmente deixaria de existir.
      let proxima: number | null = null;
      if (b.status === 'concluida') {
        proxima = await criarProximaOcorrencia(server, id);
      }

      return { ok: true, proximaOcorrencia: proxima };
    } catch (err: any) {
      server.log.error({ err, sets, params }, 'Falha ao atualizar tarefa');

      // 42703 = coluna inexistente. É o sintoma de a trigger de atualizado_em
      // ainda estar apontando para `updated_at`, o que derruba todo UPDATE.
      if (err.code === '42703') {
        return reply.code(500).send({
          error: 'O banco recusou a alteração (coluna inexistente). '
               + 'Verifique se a migração 005 foi aplicada.',
          codigo: err.code,
        });
      }
      return reply.code(500).send({
        error: `Erro ao atualizar tarefa: ${err.message || 'desconhecido'}`,
        codigo: err.code,
      });
    }
  });

  // DELETE /api/tarefas/:id
  //
  // Descartar (status) preserva o histórico e é o caminho normal; excluir de
  // vez existe para tarefa criada por engano.
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM public.telegas_tarefas WHERE id = $1`, [id]
      );
      if (!rowCount) return reply.code(404).send({ error: 'Tarefa não encontrada' });
      return { ok: true };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao excluir tarefa' });
    }
  });
}

/**
 * Cria a próxima ocorrência de uma tarefa recorrente que acabou de ser
 * concluída. Devolve o id da nova tarefa, ou null se não havia recorrência.
 *
 * Nunca lança: falhar aqui não pode desfazer a conclusão que o usuário já fez.
 */
async function criarProximaOcorrencia(
  server: FastifyInstance,
  idConcluida: number
): Promise<number | null> {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM public.telegas_tarefas WHERE id = $1`, [idConcluida]
    );
    const t = rows[0];
    if (!t?.recorrencia || !t.prazo) return null;

    // A rotina é identificada pela primeira ocorrência: assim todas as
    // repetições apontam para a mesma origem, e não numa corrente longa.
    const origem = t.recorrencia_de || t.id;

    const { rows: nova } = await pool.query(
      `INSERT INTO public.telegas_tarefas
         (cliente_id, tipo, origem, titulo, descricao, prioridade, valor_risco,
          prazo, recorrencia, recorrencia_de, criado_por)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        t.cliente_id, t.tipo, t.origem, t.titulo, t.descricao, t.prioridade,
        t.valor_risco,
        proximoPrazo(String(t.prazo), t.recorrencia),
        t.recorrencia, origem, t.criado_por,
      ]
    );
    return nova[0].id;
  } catch (err) {
    server.log.error(err, 'Falha ao criar próxima ocorrência da tarefa');
    return null;
  }
}

function serializar(r: any) {
  return {
    id: r.id,
    clienteId: r.cliente_id,
    clienteNome: r.cliente_nome,
    clienteTelefone: r.cliente_telefone,
    clienteEndereco: r.cliente_endereco,
    clienteBairro: r.cliente_bairro,
    clienteEtiquetas: r.cliente_etiquetas || [],
    tipo: r.tipo,
    origem: r.origem,
    regra: r.regra,
    titulo: r.titulo,
    descricao: r.descricao,
    prioridade: r.prioridade,
    valorRisco: r.valor_risco !== null ? parseFloat(r.valor_risco) : null,
    status: r.status,
    resultado: r.resultado,
    observacao: r.observacao,
    prazo: r.prazo,
    recorrencia: r.recorrencia,
    recorrenciaDe: r.recorrencia_de,
    adiadaPara: r.adiada_para,
    criadoPorNome: r.criado_por_nome,
    criadoEm: r.criado_em,
    concluidaEm: r.concluida_em,
  };
}
