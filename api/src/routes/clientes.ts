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

  // GET /api/clientes/retencao — ciclo de compra + fidelidade
  server.get('/retencao', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        WITH pedidos_entregues AS (
          SELECT telefone_cliente, created_at
          FROM public.telegas_pedidos
          WHERE status = 'entregue'
          ORDER BY telefone_cliente, created_at
        ),
        com_intervalo AS (
          SELECT
            telefone_cliente, created_at,
            LAG(created_at) OVER (PARTITION BY telefone_cliente ORDER BY created_at) as anterior
          FROM pedidos_entregues
        ),
        stats AS (
          SELECT
            telefone_cliente,
            COUNT(*) as total_compras,
            MAX(created_at) as ultima_compra,
            AVG(EXTRACT(EPOCH FROM (created_at - anterior)) / 86400)
              FILTER (WHERE anterior IS NOT NULL) as media_dias
          FROM com_intervalo
          GROUP BY telefone_cliente
        )
        SELECT
          c.id, c.nome, c.telefone, c.endereco, c.bairro,
          COALESCE(c.etiquetas, '{}') as etiquetas,
          COALESCE(s.total_compras, 0) as total_compras,
          s.ultima_compra,
          ROUND(COALESCE(s.media_dias, 0)::numeric, 1) as media_dias,
          ROUND(EXTRACT(EPOCH FROM (NOW() - s.ultima_compra)) / 86400) as dias_desde_ultima
        FROM public.telegas_clientes c
        LEFT JOIN stats s ON s.telefone_cliente = c.telefone
        WHERE s.total_compras >= 1
        ORDER BY
          CASE
            WHEN s.media_dias > 0 AND s.ultima_compra IS NOT NULL
              THEN EXTRACT(EPOCH FROM (NOW() - s.ultima_compra)) / 86400 / s.media_dias
            ELSE 0
          END DESC,
          s.ultima_compra ASC NULLS LAST
      `);

      return rows.map((r: any) => {
        const totalCompras = parseInt(r.total_compras, 10) || 0;
        const mediaDias = parseFloat(r.media_dias) || 0;
        const diasDesdeUltima = parseInt(r.dias_desde_ultima, 10) || 0;
        const ratio = mediaDias > 0 ? diasDesdeUltima / mediaDias : 0;

        let statusRetencao = 'sem_dados';
        if (mediaDias > 0) {
          if (ratio >= 1.2) statusRetencao = 'atrasado';
          else if (ratio >= 0.75) statusRetencao = 'proximo';
          else statusRetencao = 'normal';
        } else if (totalCompras === 1) {
          statusRetencao = diasDesdeUltima > 30 ? 'atrasado' : diasDesdeUltima > 20 ? 'proximo' : 'normal';
        }

        // Fidelidade: a cada 10 pedidos entregues
        const fidelidadeCiclo = 10;
        const fidelidadeProgresso = totalCompras % fidelidadeCiclo;
        const fidelidadeCompletos = Math.floor(totalCompras / fidelidadeCiclo);

        return {
          id: r.id,
          nome: r.nome,
          telefone: r.telefone,
          endereco: r.endereco,
          bairro: r.bairro,
          etiquetas: r.etiquetas || [],
          totalCompras,
          ultimaCompra: r.ultima_compra,
          mediaDias,
          diasDesdeUltima,
          ratio: Math.round(ratio * 100) / 100,
          statusRetencao,
          fidelidade: {
            progresso: fidelidadeProgresso,
            ciclo: fidelidadeCiclo,
            recompensas: fidelidadeCompletos,
            faltam: fidelidadeCiclo - fidelidadeProgresso,
          },
        };
      });
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao calcular retenção' });
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
