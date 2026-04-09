import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function entregadorRoutes(server: FastifyInstance) {
  // Ensure senha_hash column exists
  await pool.query(`
    ALTER TABLE public.telegas_entregadores
    ADD COLUMN IF NOT EXISTS senha_hash TEXT
  `).catch(() => {});

  // POST /api/entregador/login
  server.post('/login', async (request, reply) => {
    const { telefone, senha } = request.body as { telefone: string; senha: string };

    if (!telefone || !senha) {
      return reply.status(400).send({ error: 'Telefone e senha são obrigatórios' });
    }

    const tel = telefone.replace(/\D/g, '');

    try {
      const result = await pool.query(
        `SELECT id, nome, telefone
         FROM public.telegas_entregadores
         WHERE telefone = $1
           AND ativo = true
           AND senha_hash IS NOT NULL
           AND senha_hash = crypt($2, senha_hash)`,
        [tel, senha]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({ error: 'Telefone ou senha incorretos' });
      }

      const entregador = result.rows[0];
      const token = (server as any).jwt.sign(
        { id: entregador.id, nome: entregador.nome, telefone: entregador.telefone, role: 'entregador' },
        { expiresIn: '30d' }
      );

      return reply.send({ token, entregador: { id: entregador.id, nome: entregador.nome, telefone: entregador.telefone } });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  // GET /api/entregador/meus-pedidos  (requires JWT)
  server.get('/meus-pedidos', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const user = (request as any).user;
      if (user.role !== 'entregador') return reply.status(403).send({ error: 'Acesso negado' });

      const { rows } = await pool.query(
        `SELECT
           p.id, p.status, p.telefone_cliente, p.nome_cliente,
           p.endereco, p.bairro, p.total, p.produtos,
           p.troco_para, p.forma_pagamento,
           p.created_at, p.atribuido_em
         FROM public.telegas_pedidos p
         WHERE p.entregador_id = $1
           AND p.status IN ('atribuido', 'saiu_para_entrega')
         ORDER BY p.atribuido_em ASC`,
        [user.id]
      );

      return rows.map((r: any) => ({
        id: r.id,
        status: r.status,
        telefoneCliente: r.telefone_cliente,
        nomeCliente: r.nome_cliente,
        endereco: r.endereco,
        bairro: r.bairro,
        total: parseFloat(r.total),
        produtos: r.produtos,
        trocoPara: r.troco_para ? parseFloat(r.troco_para) : null,
        formaPagamento: r.forma_pagamento,
        createdAt: r.created_at,
        atribuidoEm: r.atribuido_em,
      }));
    } catch (err: any) {
      if (err.statusCode === 401) return reply.status(401).send({ error: 'Não autorizado' });
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  // POST /api/entregador/pedidos/:id/aceitar
  server.post<{ Params: { id: string } }>('/pedidos/:id/aceitar', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const user = (request as any).user;
      if (user.role !== 'entregador') return reply.status(403).send({ error: 'Acesso negado' });

      const pedidoId = parseInt(request.params.id, 10);

      const { rows } = await pool.query(
        `UPDATE public.telegas_pedidos
         SET status = 'saiu_para_entrega', saiu_entrega_em = NOW()
         WHERE id = $1 AND entregador_id = $2 AND status = 'atribuido'
         RETURNING id, status`,
        [pedidoId, user.id]
      );

      if (!rows.length) {
        return reply.status(404).send({ error: 'Pedido não encontrado ou não pode ser aceito' });
      }

      return { ok: true, pedido: rows[0] };
    } catch (err: any) {
      if (err.statusCode === 401) return reply.status(401).send({ error: 'Não autorizado' });
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  // POST /api/entregador/pedidos/:id/entregar
  server.post<{ Params: { id: string } }>('/pedidos/:id/entregar', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const user = (request as any).user;
      if (user.role !== 'entregador') return reply.status(403).send({ error: 'Acesso negado' });

      const pedidoId = parseInt(request.params.id, 10);

      const { rows } = await pool.query(
        `UPDATE public.telegas_pedidos
         SET status = 'entregue', entregue_em = NOW()
         WHERE id = $1 AND entregador_id = $2 AND status = 'saiu_para_entrega'
         RETURNING id, status`,
        [pedidoId, user.id]
      );

      if (!rows.length) {
        return reply.status(404).send({ error: 'Pedido não encontrado ou não pode ser marcado como entregue' });
      }

      return { ok: true, pedido: rows[0] };
    } catch (err: any) {
      if (err.statusCode === 401) return reply.status(401).send({ error: 'Não autorizado' });
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });

  // POST /api/entregador/pedidos/:id/recusar
  server.post<{ Params: { id: string } }>('/pedidos/:id/recusar', async (request, reply) => {
    try {
      await (request as any).jwtVerify();
      const user = (request as any).user;
      if (user.role !== 'entregador') return reply.status(403).send({ error: 'Acesso negado' });

      const pedidoId = parseInt(request.params.id, 10);

      // Remove entregador assignment, set back to novo so it can be re-assigned
      const { rows } = await pool.query(
        `UPDATE public.telegas_pedidos
         SET status = 'novo', entregador_id = NULL, atribuido_em = NULL
         WHERE id = $1 AND entregador_id = $2 AND status = 'atribuido'
         RETURNING id, status`,
        [pedidoId, user.id]
      );

      if (!rows.length) {
        return reply.status(404).send({ error: 'Pedido não encontrado ou não pode ser recusado' });
      }

      return { ok: true, pedido: rows[0] };
    } catch (err: any) {
      if (err.statusCode === 401) return reply.status(401).send({ error: 'Não autorizado' });
      server.log.error(err);
      return reply.status(500).send({ error: 'Erro interno' });
    }
  });
}

// PATCH /api/entregadores/:id/senha  (admin route — added to entregadores prefix)
export async function definirSenhaEntregador(server: FastifyInstance) {
  server.patch<{ Params: { id: string }; Body: { senha: string } }>(
    '/:id/senha', async (request, reply) => {
      const id = parseInt(request.params.id, 10);
      const { senha } = request.body;

      if (!senha || senha.length < 4) {
        return reply.status(400).send({ error: 'Senha deve ter pelo menos 4 caracteres' });
      }

      try {
        const { rows } = await pool.query(
          `UPDATE public.telegas_entregadores
           SET senha_hash = crypt($1, gen_salt('bf'))
           WHERE id = $2
           RETURNING id, nome`,
          [senha, id]
        );
        if (!rows.length) return reply.status(404).send({ error: 'Entregador não encontrado' });
        return { ok: true, nome: rows[0].nome };
      } catch (err) {
        server.log.error(err);
        return reply.status(500).send({ error: 'Erro ao definir senha' });
      }
    }
  );
}
