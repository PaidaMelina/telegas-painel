import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function dashboardRoutes(server: FastifyInstance) {
  server.get('/summary', async (_request, reply) => {
    try {
      const [totalRes, entreguesRes, abertosRes] = await Promise.all([
        pool.query(`SELECT COUNT(*) FROM public.pedidos WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`),
        pool.query(`SELECT COUNT(*) FROM public.pedidos WHERE status = 'entregue' AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE`),
        pool.query(`SELECT COUNT(*) FROM public.pedidos WHERE status NOT IN ('entregue','cancelado')`),
      ]);
      return {
        hoje: {
          total: parseInt(totalRes.rows[0].count, 10),
          entregues: parseInt(entreguesRes.rows[0].count, 10),
        },
        emAberto: parseInt(abertosRes.rows[0].count, 10),
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar consolidado' });
    }
  });

  server.get('/metrics', async (_request, reply) => {
    try {
      const [ticketRes, tempoEntregaRes, atrasadosRes] = await Promise.all([
        pool.query(`
          SELECT COALESCE(AVG(total::numeric), 0) as ticket_medio
          FROM public.pedidos
          WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
            AND status != 'cancelado'
        `),
        pool.query(`
          SELECT COALESCE(
            AVG(EXTRACT(EPOCH FROM (entregue_em - atribuido_em)) / 60)
            FILTER (WHERE entregue_em IS NOT NULL AND atribuido_em IS NOT NULL
              AND DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE),
            0
          ) as minutos
          FROM public.pedidos
        `),
        pool.query(`
          SELECT COUNT(*) as count FROM public.pedidos
          WHERE
            (status = 'atribuido' AND atribuido_em IS NOT NULL AND atribuido_em < NOW() - INTERVAL '15 minutes')
            OR
            (status = 'saiu_para_entrega' AND saiu_entrega_em IS NOT NULL AND saiu_entrega_em < NOW() - INTERVAL '45 minutes')
        `),
      ]);
      return {
        ticketMedio: parseFloat(ticketRes.rows[0].ticket_medio) || 0,
        tempoMedioEntrega: parseFloat(tempoEntregaRes.rows[0].minutos) || 0,
        pedidosAtrasados: parseInt(atrasadosRes.rows[0].count, 10) || 0,
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar métricas' });
    }
  });

  server.get('/status-distribution', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT status, COUNT(*) as count
        FROM public.pedidos
        WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
        GROUP BY status
        ORDER BY count DESC
      `);
      return rows.map((r: any) => ({ status: r.status, count: parseInt(r.count, 10) }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar distribuição' });
    }
  });

  server.get('/by-bairro', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(NULLIF(TRIM(bairro), ''), 'Não informado') as bairro,
          COUNT(*) as count,
          COALESCE(SUM(total::numeric), 0) as total
        FROM public.pedidos
        WHERE DATE(created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
        GROUP BY bairro
        ORDER BY count DESC
        LIMIT 8
      `);
      return rows.map((r: any) => ({
        bairro: r.bairro,
        count: parseInt(r.count, 10),
        total: parseFloat(r.total),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar por bairro' });
    }
  });

  server.get('/by-entregador', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          COALESCE(e.nome, 'Não atribuído') as nome,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega')) as em_aberto,
          COUNT(p.id) FILTER (WHERE p.status = 'entregue'
            AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE) as entregues_hoje,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (p.entregue_em - p.atribuido_em)) / 60)
            FILTER (WHERE p.entregue_em IS NOT NULL AND p.atribuido_em IS NOT NULL
              AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE),
            0
          ) as tempo_medio
        FROM public.pedidos p
        LEFT JOIN public.entregadores e ON e.id = p.entregador_id
        WHERE DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE
        GROUP BY e.id, e.nome
        ORDER BY entregues_hoje DESC
      `);
      return rows.map((r: any) => ({
        nome: r.nome,
        emAberto: parseInt(r.em_aberto, 10) || 0,
        entreguesHoje: parseInt(r.entregues_hoje, 10) || 0,
        tempoMedio: parseFloat(r.tempo_medio) || 0,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar por entregador' });
    }
  });
}
