import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function formasPagamentoRoutes(server: FastifyInstance) {
  server.get('/', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT id, nome, slug, aceita_troco, ordem
        FROM public.telegas_formas_pagamento
        WHERE ativo = true
        ORDER BY ordem ASC, nome ASC
      `);
      return rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        slug: r.slug,
        aceitaTroco: r.aceita_troco,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar formas de pagamento' });
    }
  });
}
