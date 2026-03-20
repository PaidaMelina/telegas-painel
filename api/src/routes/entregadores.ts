import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function entregadoresRoutes(server: FastifyInstance) {
  server.get('/', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          e.id, e.nome, e.telefone, e.ativo, e.created_at,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega')) as pedidos_abertos,
          COUNT(p.id) FILTER (WHERE p.status = 'entregue' AND DATE(p.created_at) = CURRENT_DATE) as entregues_hoje,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (p.entregue_em - p.atribuido_em))/60)
            FILTER (WHERE p.entregue_em IS NOT NULL AND p.atribuido_em IS NOT NULL AND DATE(p.created_at) = CURRENT_DATE),
            0
          ) as tempo_medio_entrega
        FROM public.telegas_entregadores e
        LEFT JOIN public.telegas_pedidos p ON p.entregador_id = e.id
        GROUP BY e.id
        ORDER BY e.ativo DESC, e.nome
      `);
      return rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        telefone: r.telefone,
        ativo: r.ativo,
        created_at: r.created_at,
        pedidosAbertos: parseInt(r.pedidos_abertos, 10) || 0,
        entreguesHoje: parseInt(r.entregues_hoje, 10) || 0,
        tempoMedioEntrega: parseFloat(r.tempo_medio_entrega) || 0,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar entregadores' });
    }
  });
}
