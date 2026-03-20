import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function pedidosRoutes(server: FastifyInstance) {
  server.get('/', async (request, reply) => {
    const { status, limit = 20, offset = 0, search, sort = 'created_at', dir = 'desc' } = request.query as any;

    const allowedSortCols: Record<string, string> = { id: 'id', created_at: 'created_at', total: 'total' };
    const sortCol = allowedSortCols[sort] ?? 'created_at';
    const sortDir = dir === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = [];
    const params: any[] = [];

    if (status) {
      params.push(status);
      conditions.push(`status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(telefone_cliente ILIKE $${params.length} OR endereco ILIKE $${params.length})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM public.telegas_pedidos ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
      const { rows } = await pool.query(query, params);

      const countParams2 = params.slice(0, params.length - 2);
      const countQuery = `SELECT COUNT(*) FROM public.telegas_pedidos ${where}`;
      const { rows: countRows } = await pool.query(countQuery, countParams2);

      return {
        data: rows,
        total: parseInt(countRows[0].count, 10),
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
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

  server.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as any;
    const { status } = request.body as any;

    const validStatuses = ['atribuido', 'saiu_para_entrega', 'entregue', 'cancelado'];
    if (!validStatuses.includes(status)) {
      return reply.code(400).send({ error: 'Status inválido' });
    }

    const timestampField: Record<string, string> = {
      atribuido: 'atribuido_em',
      saiu_para_entrega: 'saiu_entrega_em',
      entregue: 'entregue_em',
    };

    try {
      const extra = timestampField[status];
      const q = extra
        ? `UPDATE public.telegas_pedidos SET status = $1, ${extra} = NOW() WHERE id = $2 RETURNING *`
        : `UPDATE public.telegas_pedidos SET status = $1 WHERE id = $2 RETURNING *`;
      const { rows } = await pool.query(q, [status, id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Pedido não encontrado' });

      await pool.query(
        'INSERT INTO public.telegas_pedidos_status_history (pedido_id, status) VALUES ($1, $2)',
        [id, status]
      );

      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar status' });
    }
  });
}
