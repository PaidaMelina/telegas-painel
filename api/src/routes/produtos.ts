import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function produtosRoutes(server: FastifyInstance) {
  // GET /api/produtos
  server.get('/', async (request, reply) => {
    const { all } = request.query as any;
    const whereClause = all === 'true' ? '' : 'WHERE p.ativo = true';
    try {
      const { rows } = await pool.query(`
        SELECT p.id, p.nome, p.preco, p.unidade, p.ativo,
          COALESCE(e.quantidade, 0) AS quantidade,
          COALESCE(e.quantidade_minima, 5) AS quantidade_minima
        FROM public.telegas_produtos p
        LEFT JOIN public.telegas_estoque e ON e.produto_id = p.id
        ${whereClause}
        ORDER BY p.nome
      `);
      return rows.map((r: any) => ({
        id: parseInt(r.id),
        nome: r.nome,
        preco: parseFloat(r.preco),
        unidade: r.unidade,
        quantidade: parseInt(r.quantidade),
        quantidadeMinima: parseInt(r.quantidade_minima),
        estoqueBaixo: parseInt(r.quantidade) <= parseInt(r.quantidade_minima),
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar produtos' });
    }
  });

  // POST /api/produtos
  server.post('/', async (request, reply) => {
    const { nome, preco, unidade = 'unidade', quantidade = 0, quantidadeMinima = 5 } = request.body as any;
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.telegas_produtos (nome, preco, unidade) VALUES ($1, $2, $3) RETURNING id`,
        [nome, preco, unidade]
      );
      const id = rows[0].id;
      await pool.query(
        `INSERT INTO public.telegas_estoque (produto_id, quantidade, quantidade_minima) VALUES ($1, $2, $3)`,
        [id, quantidade, quantidadeMinima]
      );
      return { id, nome, preco, unidade, quantidade, quantidadeMinima };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar produto' });
    }
  });

  // PATCH /api/produtos/:id
  server.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id);
    const { nome, preco, unidade, ativo } = request.body as any;
    const sets: string[] = [];
    const params: any[] = [];
    if (nome !== undefined) { params.push(nome); sets.push(`nome = $${params.length}`); }
    if (preco !== undefined) { params.push(preco); sets.push(`preco = $${params.length}`); }
    if (unidade !== undefined) { params.push(unidade); sets.push(`unidade = $${params.length}`); }
    if (ativo !== undefined) { params.push(ativo); sets.push(`ativo = $${params.length}`); }
    if (!sets.length) return reply.code(400).send({ error: 'Nada para atualizar' });
    params.push(id);
    try {
      const { rows } = await pool.query(
        `UPDATE public.telegas_produtos SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
        params
      );
      if (!rows.length) return reply.code(404).send({ error: 'Produto não encontrado' });
      return rows[0];
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar produto' });
    }
  });

  // GET /api/produtos/:id/movimentos
  server.get<{ Params: { id: string } }>('/:id/movimentos', async (request, reply) => {
    const id = parseInt(request.params.id);
    try {
      const { rows } = await pool.query(
        `SELECT id, tipo, quantidade, observacao, created_at
         FROM public.telegas_estoque_movimentos
         WHERE produto_id = $1
         ORDER BY created_at DESC
         LIMIT 20`,
        [id]
      );
      return rows;
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar movimentos' });
    }
  });

  // POST /api/produtos/:id/estoque — entrada ou ajuste manual
  server.post<{ Params: { id: string } }>('/:id/estoque', async (request, reply) => {
    const id = parseInt(request.params.id);
    const { tipo, quantidade, observacao } = request.body as any;
    try {
      const delta = tipo === 'saida' ? -Math.abs(quantidade) : Math.abs(quantidade);
      await pool.query(
        `UPDATE public.telegas_estoque SET quantidade = GREATEST(0, quantidade + $1), updated_at = NOW() WHERE produto_id = $2`,
        [delta, id]
      );
      await pool.query(
        `INSERT INTO public.telegas_estoque_movimentos (produto_id, tipo, quantidade, observacao) VALUES ($1, $2, $3, $4)`,
        [id, tipo, Math.abs(quantidade), observacao || null]
      );
      const { rows } = await pool.query(`SELECT quantidade FROM public.telegas_estoque WHERE produto_id = $1`, [id]);
      return { quantidade: rows[0]?.quantidade ?? 0 };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar estoque' });
    }
  });
}
