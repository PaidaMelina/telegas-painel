import { FastifyInstance } from 'fastify';
import { pool } from '../db';
import { sendPush } from '../push';

function formatTel(tel: string): string {
  const t = String(tel).replace(/\D/g, '').replace(/^55/, '');
  if (t.length === 11) return `(${t.slice(0,2)}) ${t.slice(2,7)}-${t.slice(7)}`;
  return tel;
}

export async function portariaRoutes(server: FastifyInstance) {
  // GET /api/portaria/entregadores-disponiveis
  server.get('/entregadores-disponiveis', async (_request, reply) => {
    try {
      const { rows } = await pool.query(`
        SELECT e.id, e.nome,
          COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega')) AS pedidos_ativos
        FROM public.telegas_entregadores e
        LEFT JOIN public.telegas_pedidos p ON p.entregador_id = e.id
        WHERE e.ativo = true AND e.em_folga = false
        GROUP BY e.id
        ORDER BY pedidos_ativos ASC, e.nome
      `);
      return rows.map((r: any) => ({
        id: r.id,
        nome: r.nome,
        pedidosAtivos: parseInt(r.pedidos_ativos, 10) || 0,
      }));
    } catch (err) {
      server.log.error(err);
      return reply.code(500).send({ error: 'Erro ao buscar entregadores' });
    }
  });

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
      entregadorId,
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

      // Find delivery person — manual selection or auto (least busy)
      let entregador: any;
      if (entregadorId) {
        const { rows } = await pool.query(
          `SELECT id, nome, telefone, push_subscription FROM public.telegas_entregadores WHERE id = $1 AND ativo = true`,
          [parseInt(entregadorId)]
        );
        if (!rows.length) return reply.code(400).send({ error: 'Entregador não encontrado' });
        entregador = rows[0];
      } else {
        const { rows: entregadores } = await pool.query(`
          SELECT e.id, e.nome, e.telefone, e.push_subscription,
            COUNT(p.id) FILTER (WHERE p.status IN ('atribuido','saiu_para_entrega')) AS entregas_ativas
          FROM public.telegas_entregadores e
          LEFT JOIN public.telegas_pedidos p ON p.entregador_id = e.id
          WHERE e.ativo = true AND e.em_folga = false
          GROUP BY e.id
          ORDER BY entregas_ativas ASC, RANDOM()
          LIMIT 1
        `);
        if (!entregadores.length) return reply.code(400).send({ error: 'Nenhum entregador disponível' });
        entregador = entregadores[0];
      }

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

      // Push notification via Web Push
      if (entregador.push_subscription) {
        try {
          const sub = typeof entregador.push_subscription === 'string'
            ? JSON.parse(entregador.push_subscription)
            : entregador.push_subscription;
          const listaPush = produtos.map((p: any) => `${p.qtd}x ${p.nome}`).join(', ');
          await sendPush(sub, {
            title: `🛵 Novo pedido #${pedidoId}`,
            body: `${nome || formatTel(tel)} — ${listaPush}\nR$${total.toFixed(2)} · ${endereco || ''}`,
            data: { pedidoId, url: '/entregador' },
          });
        } catch (e: any) {
          if (e.message === 'SUBSCRIPTION_INVALID') {
            await pool.query(`UPDATE public.telegas_entregadores SET push_subscription = NULL WHERE id = $1`, [entregador.id]);
          }
          server.log.warn('Push notification falhou: ' + e.message);
        }
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

        if (latVal && lngVal) {
          await fetch(`${evolutionUrl}/message/sendLocation/${encodeURIComponent(instance)}`, {
            method: 'POST',
            headers: { apikey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              number: numero,
              options: { delay: 800 },
              locationMessage: {
                degreesLatitude: latVal,
                degreesLongitude: lngVal,
                name: `Pedido #${pedidoId}`,
                address: `${endereco || ''}${bairro ? ', ' + bairro : ''}, Jaguarão - RS`,
              },
            }),
          });
        }
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
