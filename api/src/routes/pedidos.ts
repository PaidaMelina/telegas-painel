import { FastifyInstance } from 'fastify';
import { pool } from '../db';

const N8N_ACAO_WEBHOOK = process.env.N8N_ACAO_WEBHOOK_URL || '';

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
      const idx = params.length;
      conditions.push(`(telefone_cliente ILIKE $${idx} OR endereco ILIKE $${idx})`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataQuery = `SELECT * FROM public.telegas_pedidos ${where} ORDER BY ${sortCol} ${sortDir} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countQuery = `SELECT COUNT(*) FROM public.telegas_pedidos ${where}`;
    const countParams = [...params];
    params.push(limit, offset);

    try {
      const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(dataQuery, params),
        pool.query(countQuery, countParams),
      ]);
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

  // GET /ativos — pedidos em andamento (atribuido + saiu_para_entrega)
  server.get('/ativos', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT p.*, e.nome as entregador_nome, c.nome as nome_cliente
        FROM public.telegas_pedidos p
        LEFT JOIN public.telegas_entregadores e ON e.id = p.entregador_id
        LEFT JOIN public.telegas_clientes c ON c.telefone = p.telefone_cliente
        WHERE p.status IN ('atribuido', 'saiu_para_entrega')
        ORDER BY p.created_at ASC
      `);
      return rows;
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar pedidos ativos' });
    }
  });

  server.get('/:id', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rows } = await pool.query(
        `SELECT p.*, e.nome as entregador_nome, c.nome as nome_cliente
         FROM public.telegas_pedidos p
         LEFT JOIN public.telegas_entregadores e ON e.id = p.entregador_id
         LEFT JOIN public.telegas_clientes c ON c.telefone = p.telefone_cliente
         WHERE p.id = $1`,
        [id]
      );
      if (rows.length === 0) return reply.code(404).send({ error: 'Pedido não encontrado' });
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar pedido' });
    }
  });

  server.get('/:id/history', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rows } = await pool.query(
        'SELECT * FROM public.telegas_pedidos_status_history WHERE pedido_id = $1 ORDER BY changed_at ASC',
        [id]
      );
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
      cancelado: 'cancelado_em',
    };

    try {
      const extra = timestampField[status];
      const q = `UPDATE public.telegas_pedidos SET status = $1, ${extra} = NOW() WHERE id = $2 RETURNING *`;
      const { rows } = await pool.query(q, [status, id]);
      if (rows.length === 0) return reply.code(404).send({ error: 'Pedido não encontrado' });
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar status' });
    }
  });

  // Concluir pedido: atualiza DB + dispara notificação via n8n
  server.post('/:id/concluir', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rows } = await pool.query(
        `UPDATE public.telegas_pedidos
         SET status = 'entregue', entregue_em = NOW()
         WHERE id = $1 AND status NOT IN ('entregue','cancelado')
         RETURNING *`,
        [id]
      );
      if (rows.length === 0) {
        return reply.code(409).send({ error: 'Pedido não encontrado ou já finalizado' });
      }
      if (N8N_ACAO_WEBHOOK) {
        fetch(N8N_ACAO_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidoId: id, action: 'concluir', pedido: rows[0] }),
        }).catch((e: Error) => server.log.warn('n8n webhook falhou: ' + e.message));
      }
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao concluir pedido' });
    }
  });

  // Cancelar pedido: atualiza DB + dispara notificação via n8n
  server.post('/:id/cancelar', async (request, reply) => {
    const { id } = request.params as any;
    const { motivo } = (request.body as any) || {};
    try {
      const { rows } = await pool.query(
        `UPDATE public.telegas_pedidos
         SET status = 'cancelado', cancelado_em = NOW(), motivo_cancelamento = $2
         WHERE id = $1 AND status NOT IN ('entregue','cancelado')
         RETURNING *`,
        [id, motivo || null]
      );
      if (rows.length === 0) {
        return reply.code(409).send({ error: 'Pedido não encontrado ou já finalizado' });
      }
      if (N8N_ACAO_WEBHOOK) {
        fetch(N8N_ACAO_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pedidoId: id, action: 'cancelar', motivo: motivo || null, pedido: rows[0] }),
        }).catch((e: Error) => server.log.warn('n8n webhook falhou: ' + e.message));
      }
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao cancelar pedido' });
    }
  });
}
