import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function dashboardRoutes(server: FastifyInstance) {
  server.get('/summary', async (request, reply) => {
    try {
      // Exemplo básico de summary para a V1
      const totalQuery = await pool.query('SELECT COUNT(*) FROM public.telegas_pedidos WHERE DATE(created_at) = CURRENT_DATE');
      const entreguesQuery = await pool.query('SELECT COUNT(*) FROM public.telegas_pedidos WHERE status = $1 AND DATE(created_at) = CURRENT_DATE', ['entregue']);
      const abertosQuery = await pool.query('SELECT COUNT(*) FROM public.telegas_pedidos WHERE status != $1 AND status != $2', ['entregue', 'cancelado']);
      
      return {
        hoje: {
          total: parseInt(totalQuery.rows[0].count, 10),
          entregues: parseInt(entreguesQuery.rows[0].count, 10),
        },
        emAberto: parseInt(abertosQuery.rows[0].count, 10),
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar consolidado' });
    }
  });
}
