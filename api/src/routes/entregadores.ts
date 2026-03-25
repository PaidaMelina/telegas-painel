import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function entregadoresRoutes(server: FastifyInstance) {
  // Ensure columns exist
  await pool.query(`
    ALTER TABLE public.telegas_entregadores
    ADD COLUMN IF NOT EXISTS em_folga BOOLEAN NOT NULL DEFAULT false
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE public.telegas_entregadores
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
  `).catch(() => {});

  // GET /api/entregadores
  server.get('/', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          e.id, e.nome, e.telefone, e.ativo, e.em_folga, e.created_at,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega')) as pedidos_abertos,
          COUNT(p.id) FILTER (WHERE p.status = 'entregue'
            AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE) as entregues_hoje,
          COALESCE(
            AVG(EXTRACT(EPOCH FROM (p.entregue_em - p.atribuido_em)) / 60)
            FILTER (WHERE p.entregue_em IS NOT NULL AND p.atribuido_em IS NOT NULL
              AND DATE(p.created_at AT TIME ZONE 'America/Sao_Paulo') = CURRENT_DATE),
            0
          ) as tempo_medio_entrega
        FROM public.telegas_entregadores e
        LEFT JOIN public.telegas_pedidos p ON p.entregador_id = e.id
        GROUP BY e.id
        ORDER BY e.ativo DESC, e.em_folga ASC, e.nome
      `);
      return rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        telefone: r.telefone,
        ativo: r.ativo,
        emFolga: r.em_folga,
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

  // POST /api/entregadores
  server.post<{ Body: { nome: string; telefone: string } }>('/', async (request, reply) => {
    const { nome, telefone } = request.body;
    if (!nome?.trim() || !telefone?.trim()) {
      return reply.code(400).send({ error: 'Nome e telefone são obrigatórios' });
    }
    const tel = telefone.replace(/\D/g, '');
    try {
      const { rows } = await pool.query(
        `INSERT INTO public.telegas_entregadores (nome, telefone, ativo, em_folga)
         VALUES ($1, $2, true, false) RETURNING *`,
        [nome.trim(), tel]
      );
      return reply.code(201).send(rows[0]);
    } catch (err: any) {
      if (err.code === '23505') return reply.code(409).send({ error: 'Telefone já cadastrado' });
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar entregador' });
    }
  });

  // PUT /api/entregadores/:id
  server.put<{ Params: { id: string }; Body: { nome: string; telefone: string; ativo: boolean } }>(
    '/:id', async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { nome, telefone, ativo } = request.body;
      if (!nome?.trim() || !telefone?.trim()) {
        return reply.code(400).send({ error: 'Nome e telefone são obrigatórios' });
      }
      const tel = telefone.replace(/\D/g, '');
      try {
        const { rows } = await pool.query(
          `UPDATE public.telegas_entregadores
           SET nome = $1, telefone = $2, ativo = $3, updated_at = NOW()
           WHERE id = $4 RETURNING *`,
          [nome.trim(), tel, ativo !== false, id]
        );
        if (!rows.length) return reply.code(404).send({ error: 'Entregador não encontrado' });
        return rows[0];
      } catch (err: any) {
        if (err.code === '23505') return reply.code(409).send({ error: 'Telefone já cadastrado' });
        server.log.error(err);
        return reply.code(500).send({ error: 'Erro ao atualizar entregador' });
      }
    }
  );

  // PATCH /api/entregadores/:id/folga
  server.patch<{ Params: { id: string }; Body: { emFolga: boolean } }>(
    '/:id/folga', async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { emFolga } = request.body;
      try {
        const { rows } = await pool.query(
          `UPDATE public.telegas_entregadores
           SET em_folga = $1, updated_at = NOW()
           WHERE id = $2 RETURNING id, nome, em_folga`,
          [emFolga, id]
        );
        if (!rows.length) return reply.code(404).send({ error: 'Entregador não encontrado' });
        return rows[0];
      } catch (err) {
        server.log.error(err);
        return reply.code(500).send({ error: 'Erro ao atualizar folga' });
      }
    }
  );

  // DELETE /api/entregadores/:id
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const id = parseInt(request.params.id, 10);
    try {
      const { rows: pedidos } = await pool.query(
        `SELECT COUNT(*) as c FROM public.telegas_pedidos
         WHERE entregador_id = $1 AND status IN ('atribuido','saiu_para_entrega')`,
        [id]
      );
      if (parseInt(pedidos[0].c) > 0) {
        return reply.code(409).send({ error: 'Entregador possui pedidos em andamento' });
      }
      const { rowCount } = await pool.query(
        `DELETE FROM public.telegas_entregadores WHERE id = $1`, [id]
      );
      if (!rowCount) return reply.code(404).send({ error: 'Entregador não encontrado' });
      return { ok: true };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao excluir entregador' });
    }
  });
}
