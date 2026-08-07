import { FastifyInstance } from 'fastify';
import { pool } from '../db';

const STATUS_ABERTOS = ['pendente', 'em_andamento', 'adiada'];

const RESULTADOS = ['recuperado', 'sem_sucesso', 'nao_estava', 'perdido', 'engano'];
const STATUS = ['pendente', 'em_andamento', 'concluida', 'adiada', 'descartada'];
const TIPOS = ['visita', 'cobranca', 'cadastro', 'follow_up', 'oportunidade', 'outro'];

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
          ORDER BY t.prioridade DESC, t.criado_em ASC
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

    try {
      const { rows } = await pool.query(
        `INSERT INTO public.telegas_tarefas
           (cliente_id, tipo, origem, titulo, descricao, prioridade, valor_risco, criado_por)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

    if (b.titulo !== undefined)     set('titulo', b.titulo.trim());
    if (b.descricao !== undefined)  set('descricao', b.descricao?.trim() || null);
    if (b.tipo !== undefined)       set('tipo', b.tipo);
    if (b.prioridade !== undefined) set('prioridade', b.prioridade);
    if (b.observacao !== undefined) set('observacao', b.observacao?.trim() || null);
    if (b.resultado !== undefined)  set('resultado', b.resultado || null);
    if (b.adiadaPara !== undefined) set('adiada_para', b.adiadaPara || null);

    if (b.status !== undefined) {
      set('status', b.status);
      // Sair de "concluída" tem que limpar a data, senão o resumo semanal
      // continua contando uma tarefa que voltou a ficar aberta.
      set('concluida_em', b.status === 'concluida' ? new Date() : null);
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
      return { ok: true };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar tarefa' });
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
    adiadaPara: r.adiada_para,
    criadoPorNome: r.criado_por_nome,
    criadoEm: r.criado_em,
    concluidaEm: r.concluida_em,
  };
}
