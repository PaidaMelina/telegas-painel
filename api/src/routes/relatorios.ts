import { FastifyInstance } from 'fastify';
import { pool } from '../db';

const TZ = `'America/Sao_Paulo'`;

function buildWhere(periodo: string, de?: string, ate?: string): { current: string; prev: string } {
  if (periodo === '7d') {
    return {
      current: `(created_at AT TIME ZONE ${TZ}) >= (NOW() AT TIME ZONE ${TZ}) - INTERVAL '7 days'`,
      prev: `(created_at AT TIME ZONE ${TZ}) BETWEEN (NOW() AT TIME ZONE ${TZ}) - INTERVAL '14 days' AND (NOW() AT TIME ZONE ${TZ}) - INTERVAL '7 days'`,
    };
  }
  if (periodo === '30d') {
    return {
      current: `(created_at AT TIME ZONE ${TZ}) >= (NOW() AT TIME ZONE ${TZ}) - INTERVAL '30 days'`,
      prev: `(created_at AT TIME ZONE ${TZ}) BETWEEN (NOW() AT TIME ZONE ${TZ}) - INTERVAL '60 days' AND (NOW() AT TIME ZONE ${TZ}) - INTERVAL '30 days'`,
    };
  }
  if (periodo === 'mes') {
    return {
      current: `DATE_TRUNC('month', created_at AT TIME ZONE ${TZ}) = DATE_TRUNC('month', NOW() AT TIME ZONE ${TZ})`,
      prev: `DATE_TRUNC('month', created_at AT TIME ZONE ${TZ}) = DATE_TRUNC('month', NOW() AT TIME ZONE ${TZ}) - INTERVAL '1 month'`,
    };
  }
  if (
    periodo === 'custom' && de && ate &&
    /^\d{4}-\d{2}-\d{2}$/.test(de) && /^\d{4}-\d{2}-\d{2}$/.test(ate)
  ) {
    return {
      current: `DATE(created_at AT TIME ZONE ${TZ}) BETWEEN '${de}' AND '${ate}'`,
      prev: `DATE(created_at AT TIME ZONE ${TZ}) BETWEEN '${de}'::date - ('${ate}'::date - '${de}'::date + 1) * INTERVAL '1 day' AND '${de}'::date - INTERVAL '1 day'`,
    };
  }
  return {
    current: `DATE(created_at AT TIME ZONE ${TZ}) = CURRENT_DATE`,
    prev: `DATE(created_at AT TIME ZONE ${TZ}) = CURRENT_DATE - INTERVAL '1 day'`,
  };
}

export async function relatoriosRoutes(server: FastifyInstance) {

  server.get('/resumo', async (request, reply) => {
    const { periodo = 'hoje', de, ate } = request.query as any;
    const { current, prev } = buildWhere(periodo, de, ate);
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${current})                                         AS total_atual,
          COALESCE(SUM(total::numeric) FILTER (WHERE ${current}), 0)                AS receita_atual,
          COUNT(*) FILTER (WHERE ${current} AND status = 'entregue')                AS entregues_atual,
          COUNT(*) FILTER (WHERE ${current} AND status = 'cancelado')               AS cancelados_atual,
          COALESCE(AVG(
            CASE WHEN ${current} AND status = 'entregue'
                  AND atribuido_em IS NOT NULL AND entregue_em IS NOT NULL
            THEN EXTRACT(EPOCH FROM (entregue_em - atribuido_em)) / 60 END
          ), 0)                                                                      AS tempo_medio_atual,
          COUNT(*) FILTER (WHERE ${prev})                                            AS total_prev,
          COALESCE(SUM(total::numeric) FILTER (WHERE ${prev}), 0)                   AS receita_prev,
          COUNT(*) FILTER (WHERE ${prev} AND status = 'entregue')                   AS entregues_prev
        FROM public.telegas_pedidos
      `);
      const r = rows[0];
      const totalAtual    = parseInt(r.total_atual);
      const receitaAtual  = parseFloat(r.receita_atual);
      const entreguesAtual = parseInt(r.entregues_atual);
      const totalPrev     = parseInt(r.total_prev);
      const receitaPrev   = parseFloat(r.receita_prev);

      const delta = (atual: number, ant: number) =>
        ant === 0 ? null : Math.round(((atual - ant) / ant) * 100);

      return {
        totalPedidos:  totalAtual,
        receita:       receitaAtual,
        entregues:     entreguesAtual,
        cancelados:    parseInt(r.cancelados_atual),
        tempoMedio:    Math.round(parseFloat(r.tempo_medio_atual)),
        taxaConclusao: totalAtual > 0 ? Math.round((entreguesAtual / totalAtual) * 100) : 0,
        ticketMedio:   totalAtual > 0 ? receitaAtual / totalAtual : 0,
        deltas: {
          totalPedidos:  delta(totalAtual, totalPrev),
          receita:       delta(receitaAtual, receitaPrev),
          entregues:     delta(entreguesAtual, parseInt(r.entregues_prev)),
        },
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar resumo' });
    }
  });

  server.get('/serie-temporal', async (request, reply) => {
    const { periodo = 'hoje', de, ate } = request.query as any;
    const { current } = buildWhere(periodo, de, ate);
    try {
      const { rows } = await pool.query(`
        SELECT
          DATE(created_at AT TIME ZONE ${TZ})                              AS dia,
          COUNT(*)                                                          AS pedidos,
          COALESCE(SUM(total::numeric), 0)                                 AS receita,
          COUNT(*) FILTER (WHERE status = 'entregue')                      AS entregues
        FROM public.telegas_pedidos
        WHERE ${current}
        GROUP BY dia
        ORDER BY dia ASC
      `);
      return rows.map((r: any) => ({
        dia:       r.dia,
        pedidos:   parseInt(r.pedidos),
        receita:   parseFloat(r.receita),
        entregues: parseInt(r.entregues),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar série temporal' });
    }
  });

  server.get('/top-produtos', async (request, reply) => {
    const { periodo = 'hoje', de, ate } = request.query as any;
    const { current } = buildWhere(periodo, de, ate);
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(item->>'produto', item->>'nome', 'Produto') AS produto,
          SUM(COALESCE((item->>'qtd')::int, (item->>'quantidade')::int, 1))   AS qtd,
          SUM(COALESCE((item->>'qtd')::int, (item->>'quantidade')::int, 1)
              * COALESCE((item->>'preco')::numeric, (item->>'valor')::numeric, 0)) AS receita
        FROM public.telegas_pedidos,
             jsonb_array_elements(
               CASE WHEN jsonb_typeof(produtos::jsonb) = 'array'
                    THEN produtos::jsonb
                    ELSE '[]'::jsonb
               END
             ) AS item
        WHERE ${current}
        GROUP BY produto
        ORDER BY qtd DESC
        LIMIT 10
      `);
      return rows.map((r: any) => ({
        produto: r.produto,
        qtd:     parseInt(r.qtd),
        receita: parseFloat(r.receita),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar top produtos' });
    }
  });

  server.get('/top-entregadores', async (request, reply) => {
    const { periodo = 'hoje', de, ate } = request.query as any;
    const { current } = buildWhere(periodo, de, ate);
    try {
      const { rows } = await pool.query(`
        SELECT
          e.nome,
          COUNT(p.id)                                                   AS total,
          COUNT(p.id) FILTER (WHERE p.status = 'entregue')             AS entregues,
          COUNT(p.id) FILTER (WHERE p.status = 'cancelado')            AS cancelados,
          COALESCE(AVG(
            CASE WHEN p.status = 'entregue'
                  AND p.atribuido_em IS NOT NULL AND p.entregue_em IS NOT NULL
            THEN EXTRACT(EPOCH FROM (p.entregue_em - p.atribuido_em)) / 60 END
          ), 0)                                                         AS tempo_medio
        FROM public.telegas_pedidos p
        JOIN public.telegas_entregadores e ON e.id = p.entregador_id
        WHERE ${current}
        GROUP BY e.nome
        ORDER BY entregues DESC
        LIMIT 8
      `);
      return rows.map((r: any) => ({
        nome:      r.nome,
        total:     parseInt(r.total),
        entregues: parseInt(r.entregues),
        cancelados: parseInt(r.cancelados),
        tempoMedio: Math.round(parseFloat(r.tempo_medio)),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar top entregadores' });
    }
  });

  server.get('/top-bairros', async (request, reply) => {
    const { periodo = 'hoje', de, ate } = request.query as any;
    const { current } = buildWhere(periodo, de, ate);
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') AS bairro,
          COUNT(*)                                             AS pedidos,
          COALESCE(SUM(total::numeric), 0)                    AS receita
        FROM public.telegas_pedidos
        WHERE ${current}
        GROUP BY bairro
        ORDER BY pedidos DESC
        LIMIT 8
      `);
      return rows.map((r: any) => ({
        bairro:  r.bairro,
        pedidos: parseInt(r.pedidos),
        receita: parseFloat(r.receita),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar top bairros' });
    }
  });
}
