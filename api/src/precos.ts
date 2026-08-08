import { pool } from './db';

/**
 * Resolução de preço por grupo de cliente.
 *
 * Os clientes do Uruguai pagam $770 no Gás Cinza — preço combinado para
 * entrega do outro lado da fronteira. A regra vale por etiqueta, não por
 * cliente: marcar alguém como "Uruguai" já lhe dá o preço certo.
 *
 * O preço é sempre resolvido aqui, no servidor, e nunca aceito do navegador:
 * o valor que a tela envia serve para exibir, não para cobrar.
 */

export interface PrecoResolvido {
  produtoId: number;
  /** Preço final em reais — é o que vai para o pedido e para os relatórios. */
  precoBrl: number;
  /** Preço na moeda de cobrança, quando houver. */
  precoMoeda: number | null;
  moeda: string | null;
  simbolo: string | null;
  cotacao: number | null;
  /** De onde veio: tabela do produto, preço de grupo ou acordo com o cliente. */
  especial: boolean;
  etiqueta: string | null;
  /** true quando o preço foi combinado com este cliente especificamente. */
  doCliente?: boolean;
}

/**
 * Preços válidos para um cliente.
 *
 * Ordem de precedência, do mais específico ao mais geral:
 *
 *   1. preço combinado com aquele cliente
 *   2. preço do grupo (etiqueta)
 *   3. preço de tabela do produto
 *
 * Entre duas etiquetas com preço para o mesmo produto, vence o menor: o
 * cliente não deve ser penalizado por se encaixar em dois grupos.
 */
export async function resolverPrecos(
  produtoIds: number[],
  etiquetas: string[],
  clienteId?: number | null
): Promise<Map<number, PrecoResolvido>> {
  const mapa = new Map<number, PrecoResolvido>();
  if (produtoIds.length === 0) return mapa;

  const { rows: produtos } = await pool.query(
    `SELECT id, nome, preco FROM public.telegas_produtos WHERE id = ANY($1::int[])`,
    [produtoIds]
  );

  for (const p of produtos) {
    mapa.set(p.id, {
      produtoId: p.id,
      precoBrl: parseFloat(p.preco),
      precoMoeda: null,
      moeda: null,
      simbolo: null,
      cotacao: null,
      especial: false,
      etiqueta: null,
      doCliente: false,
    });
  }

  if (etiquetas.length === 0 && !clienteId) return mapa;

  const { rows: especiais } = await pool.query(
    `SELECT pe.produto_id, pe.etiqueta, pe.cliente_id, pe.preco, pe.moeda,
            m.simbolo, m.unidades_por_real
       FROM public.telegas_precos_especiais pe
       LEFT JOIN public.telegas_moedas m ON m.codigo = pe.moeda
      WHERE pe.ativo
        AND pe.produto_id = ANY($1::int[])
        AND (
          ($2::int IS NOT NULL AND pe.cliente_id = $2::int)
          OR (pe.etiqueta = ANY($3::text[]))
        )
      -- Cliente antes de etiqueta: assim a linha do cliente é a última a
      -- sobrescrever e prevalece sobre a regra do grupo.
      ORDER BY (pe.cliente_id IS NOT NULL) ASC`,
    [produtoIds, clienteId ?? null, etiquetas]
  );

  for (const e of especiais) {
    const cotacao = e.unidades_por_real ? parseFloat(e.unidades_por_real) : null;
    const preco = parseFloat(e.preco);

    // Sem moeda, o preço já está em reais; com moeda, converte pela cotação.
    const precoBrl = e.moeda && cotacao
      ? Math.round((preco / cotacao) * 100) / 100
      : preco;

    const atual = mapa.get(e.produto_id);
    if (!atual) continue;

    const ehDoCliente = e.cliente_id !== null;
    // Preço do cliente sempre vence. Entre grupos, prevalece o menor.
    if (!ehDoCliente && atual.especial && atual.precoBrl <= precoBrl) continue;

    mapa.set(e.produto_id, {
      produtoId: e.produto_id,
      precoBrl,
      precoMoeda: e.moeda ? preco : null,
      moeda: e.moeda || null,
      simbolo: e.simbolo || null,
      cotacao,
      especial: true,
      etiqueta: ehDoCliente ? null : e.etiqueta,
      doCliente: ehDoCliente,
    });
  }

  return mapa;
}

/** Etiquetas de um cliente, para alimentar `resolverPrecos`. */
export async function etiquetasDoCliente(clienteId: number | null, telefone?: string): Promise<string[]> {
  if (!clienteId && !telefone) return [];
  const { rows } = await pool.query(
    clienteId
      ? `SELECT COALESCE(etiquetas, '{}') AS etiquetas FROM public.telegas_clientes WHERE id = $1`
      : `SELECT COALESCE(etiquetas, '{}') AS etiquetas FROM public.telegas_clientes WHERE telefone = $1`,
    [clienteId || telefone]
  );
  return rows[0]?.etiquetas || [];
}
