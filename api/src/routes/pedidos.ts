import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function pedidosRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    // Buscar todos os pedidos com suporte básico a paginação e status
    const { status, limit = 20, offset = 0 } = request.query as any;
    
    let query = 'SELECT * FROM public.telegas_pedidos';
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    try {
      const { rows } = await pool.query(query, params);
      
      const countQuery = status ? 'SELECT COUNT(*) FROM public.telegas_pedidos WHERE status = $1' : 'SELECT COUNT(*) FROM public.telegas_pedidos';
      const countParams = status ? [status] : [];
      const { rows: countRows } = await pool.query(countQuery, countParams);
      
      return {
        data: rows,
        total: parseInt(countRows[0].count, 10),
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar pedidos' });
    }
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rows } = await pool.query('SELECT * FROM public.telegas_pedidos WHERE id = $1', [id]);
      if (rows.length === 0) {
        return reply.code(404).send({ error: 'Pedido não encontrado' });
      }
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar pedido' });
    }
  });

  server.get('/:id/history', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rows } = await pool.query('SELECT * FROM public.telegas_pedidos_status_history WHERE pedido_id = $1 ORDER BY criado_em ASC', [id]);
      return rows;
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar historico' });
    }
  });
}
