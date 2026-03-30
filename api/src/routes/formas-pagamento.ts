import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function formasPagamentoRoutes(server: FastifyInstance) {

  // GET /api/formas-pagamento — public (used by agent tool)
  server.get('/', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, nome, slug, aceita_troco, ativo, ordem
        FROM public.telegas_formas_pagamento
        ORDER BY ordem ASC, nome ASC
      `);
      return rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        slug: r.slug,
        aceitaTroco: r.aceita_troco,
        ativo: r.ativo,
        ordem: r.ordem,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar formas de pagamento' });
    }
  });

  // POST /api/formas-pagamento
  server.post('/', async (request, reply) => {
    const { nome, slug, aceitaTroco = false, ativo = true, ordem = 0 } = request.body as any;
    if (!nome || !slug) return reply.code(400).send({ error: 'nome e slug são obrigatórios' });
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.telegas_formas_pagamento (nome, slug, aceita_troco, ativo, ordem)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [nome, slug.toLowerCase().replace(/\s+/g, '_'), aceitaTroco, ativo, ordem]
      );
      const r = rows[0];
      return { id: r.id, nome: r.nome, slug: r.slug, aceitaTroco: r.aceita_troco, ativo: r.ativo, ordem: r.ordem };
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Slug já existe' });
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar forma de pagamento' });
    }
  });

  // PATCH /api/formas-pagamento/:id
  server.patch('/:id', async (request, reply) => {
    const { id } = request.params as any;
    const { nome, slug, aceitaTroco, ativo, ordem } = request.body as any;
    try {
      const fields: string[] = [];
      const vals: any[] = [];
      if (nome !== undefined)       { fields.push(`nome = $${fields.length + 1}`);        vals.push(nome); }
      if (slug !== undefined)       { fields.push(`slug = $${fields.length + 1}`);        vals.push(slug.toLowerCase().replace(/\s+/g, '_')); }
      if (aceitaTroco !== undefined){ fields.push(`aceita_troco = $${fields.length + 1}`);vals.push(aceitaTroco); }
      if (ativo !== undefined)      { fields.push(`ativo = $${fields.length + 1}`);       vals.push(ativo); }
      if (ordem !== undefined)      { fields.push(`ordem = $${fields.length + 1}`);       vals.push(ordem); }
      if (!fields.length) return reply.code(400).send({ error: 'Nenhum campo para atualizar' });
      vals.push(id);
      const { rows } = await pool.query(
        `UPDATE public.telegas_formas_pagamento SET ${fields.join(', ')} WHERE id = $${vals.length} RETURNING *`,
        vals
      );
      if (!rows.length) return reply.code(404).send({ error: 'Não encontrado' });
      const r = rows[0];
      return { id: r.id, nome: r.nome, slug: r.slug, aceitaTroco: r.aceita_troco, ativo: r.ativo, ordem: r.ordem };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao atualizar forma de pagamento' });
    }
  });

  // DELETE /api/formas-pagamento/:id
  server.delete('/:id', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const { rowCount } = await pool.query(
        `DELETE FROM public.telegas_formas_pagamento WHERE id = $1`, [id]
      );
      if (!rowCount) return reply.code(404).send({ error: 'Não encontrado' });
      return { ok: true };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao excluir forma de pagamento' });
    }
  });
}
