import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function clientesRoutes(server: FastifyInstance) {
  // Auto-migrate etiquetas column
  await pool.query(`
    ALTER TABLE public.telegas_clientes
    ADD COLUMN IF NOT EXISTS etiquetas TEXT[] DEFAULT '{}'
  `).catch(() => {});

  // GET /api/clientes
  server.get('/', async (request, reply) => {
    const { search, etiqueta, limit = 60, offset = 0 } = request.query as any;

    const conditions: string[] = [];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(`(c.nome ILIKE $${idx} OR c.telefone ILIKE $${idx} OR c.endereco ILIKE $${idx})`);
    }
    if (etiqueta) {
      params.push(etiqueta);
      conditions.push(`$${params.length} = ANY(COALESCE(c.etiquetas, '{}'))`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const countParams = [...params];
    params.push(limit, offset);

    const dataQuery = `
      SELECT c.*,
        COUNT(p.id) as total_pedidos,
        COUNT(p.id) FILTER (WHERE p.status = 'entregue') as pedidos_entregues,
        MAX(p.created_at) as ultimo_pedido
      FROM public.telegas_clientes c
      LEFT JOIN public.telegas_pedidos p ON p.telefone_cliente = c.telefone
      ${where}
      GROUP BY c.id
      ORDER BY MAX(p.created_at) DESC NULLS LAST, c.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const countQuery = `SELECT COUNT(*) FROM public.telegas_clientes c ${where}`;

    try {
      const [{ rows }, { rows: countRows }] = await Promise.all([
        pool.query(dataQuery, params),
        pool.query(countQuery, countParams),
      ]);
      return {
        data: rows.map((r: any) => ({
          ...r,
          etiquetas: r.etiquetas || [],
          totalPedidos: parseInt(r.total_pedidos, 10) || 0,
          pedidosEntregues: parseInt(r.pedidos_entregues, 10) || 0,
          ultimoPedido: r.ultimo_pedido || null,
        })),
        total: parseInt(countRows[0].count, 10),
      };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar clientes' });
    }
  });

  // PATCH /api/clientes/:id
  server.patch<{
    Params: { id: string };
    Body: { nome?: string; endereco?: string; bairro?: string; etiquetas?: string[] };
  }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    const { nome, endereco, bairro, etiquetas } = request.body;

    const sets: string[] = [];
    const params: any[] = [];

    if (nome !== undefined) { params.push(nome.trim()); sets.push(`nome = $${params.length}`); }
    if (endereco !== undefined) { params.push(endereco.trim()); sets.push(`endereco = $${params.length}`); }
    if (bairro !== undefined) { params.push(bairro.trim()); sets.push(`bairro = $${params.length}`); }
    if (etiquetas !== undefined) { params.push(etiquetas); sets.push(`etiquetas = $${params.length}`); }

    if (sets.length === 0) return reply.code(400).send({ error: 'Nada para atualizar' });

    params.push(id);
    try {
      const { rows } = await pool.query(
        `UPDATE public.telegas_clientes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows.length) return reply.code(404).send({ error: 'Cliente não encontrado' });
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar cliente' });
    }
  });
}
