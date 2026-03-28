import { FastifyInstance } from 'fastify';
import { pool } from '../db';

export async function portariaRoutes(server: FastifyInstance) {
  // POST /api/portaria/pedido
  server.post('/pedido', async (request, reply) => {
    const {
      clienteId,
      telefone,
      nome,
      endereco,
      bairro,
      produtos,
      formaPagamento,
      trocoPara,
      lat,
      lng,
    } = request.body as any;

    try {
      // Upsert client
      let cId = clienteId ? parseInt(clienteId) : null;
      const tel = String(telefone || `portaria-${Date.now()}`).trim();

      if (!cId) {
        const { rows } = await pool.query(
          `INSERT INTO public.telegas_clientes (telefone, nome, endereco, bairro)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (telefone) DO UPDATE SET
             nome = COALESCE(EXCLUDED.nome, telegas_clientes.nome),
             updated_at = NOW()
           RETURNING id`,
          [tel, nome || null, endereco || null, bairro || null]
        );
        cId = rows[0].id;
      }

      // Calculate total
      let total = 0;
      for (const p of produtos) {
        total += (p.qtd || 1) * (p.preco || 0);
      }

      // Find best delivery person
      const { rows: entregadores } = await pool.query(`
        SELECT e.id, e.nome, e.telefone,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','em_entrega')) AS entregas_ativas
        FROM public.telegas_entregadores e
        LEFT JOIN public.telegas_pedidos p ON p.entregador_id = e.id
        WHERE e.ativo = true AND e.em_folga = false
        GROUP BY e.id
        ORDER BY entregas_ativas ASC, RANDOM()
        LIMIT 1
      `);

      if (!entregadores.length) {
        return reply.code(400).send({ error: 'Nenhum entregador disponível' });
      }

      const entregador = entregadores[0];

      // Create order
      const produtosJson = JSON.stringify(
        produtos.map((p: any) => ({ produto: p.nome, qtd: p.qtd, preco: p.preco }))
      );

      const latVal = lat ? parseFloat(lat) : null;
      const lngVal = lng ? parseFloat(lng) : null;

      const { rows: pedidoRows } = await pool.query(
        `INSERT INTO public.telegas_pedidos
          (cliente_id, telefone_cliente, telefone, produtos, total, endereco, bairro,
           troco_para, forma_pagamento, status, entregador_id, confirmado_em, atribuido_em,
           latitude, longitude)
         VALUES ($1, $2, $2, $3::jsonb, $4, $5, $6, $7, $8, 'atribuido', $9, NOW(), NOW(), $10, $11)
         RETURNING id`,
        [cId, tel, produtosJson, total, endereco || '', bairro || null,
         trocoPara ? parseFloat(trocoPara) : null, formaPagamento || null, entregador.id,
         latVal, lngVal]
      );

      const pedidoId = pedidoRows[0].id;

      // Debit stock
      for (const p of produtos) {
        if (!p.id) continue;
        await pool.query(
          `UPDATE public.telegas_estoque SET quantidade = GREATEST(0, quantidade - $1), updated_at = NOW() WHERE produto_id = $2`,
          [p.qtd || 1, p.id]
        );
        await pool.query(
          `INSERT INTO public.telegas_estoque_movimentos (produto_id, tipo, quantidade, pedido_id)
           VALUES ($1, 'saida', $2, $3)`,
          [p.id, p.qtd || 1, pedidoId]
        );
      }

      // Notify delivery person via WhatsApp
      try {
        const listaProdutos = produtos
          .map((p: any) => `${p.qtd}x ${p.nome} (R$${parseFloat(p.preco).toFixed(2)})`)
          .join('\n');
        const pagMap: Record<string, string> = { pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão' };
        const pagLabel = pagMap[(formaPagamento || '').toLowerCase()] || formaPagamento || 'Não informado';
        const trocoMsg = trocoPara ? ` | Troco para: R$${parseFloat(trocoPara).toFixed(2)}` : '';
        const texto = `*Novo pedido #${pedidoId}* (Portaria)\n\nCliente: ${nome || tel}\nProdutos:\n${listaProdutos}\nTotal: R$${total.toFixed(2)}\nEndereço: ${endereco || 'Não informado'}${bairro ? ' - ' + bairro : ''}\nPagamento: ${pagLabel}${trocoMsg}\n\nResponda ACEITAR ou RECUSAR`;

        const entTel = String(entregador.telefone || '').replace(/\D/g, '');
        const numero = entTel.startsWith('55') ? entTel : `55${entTel}`;
        const instance = process.env.EVOLUTION_INSTANCE || 'Correios Teste';
        const apikey = process.env.EVOLUTION_APIKEY || '16C1E1CA295C-4903-87B9-316E3A641581';
        const evolutionUrl = process.env.EVOLUTION_URL || 'https://evolution.comercialdrb.com.br';

        await fetch(`${evolutionUrl}/message/sendText/${encodeURIComponent(instance)}`, {
          method: 'POST',
          headers: { apikey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ number: numero, text: texto }),
        });
      } catch (e) {
        server.log.warn('Falha ao notificar entregador: ' + e);
      }

      return { pedidoId, entregador: entregador.nome, total };
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao criar pedido' });
    }
  });
}
