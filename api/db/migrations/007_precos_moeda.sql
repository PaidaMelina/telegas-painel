-- 007 — Preço por grupo de cliente e pagamento em outra moeda
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- O caso: os clientes do Uruguai pagam $770 (pesos uruguaios) no Gás Cinza
-- 13kg — preço combinado para entrega do outro lado da fronteira. O Gás Azul
-- e os demais produtos seguem a tabela normal.
--
-- Duas coisas diferentes, separadas de propósito:
--
--   1. O PREÇO é por etiqueta, não por cliente. Marcar um cliente novo como
--      "Uruguai" já lhe dá o preço certo, sem cadastrar cliente por cliente.
--   2. A MOEDA é como o cliente paga. A venda continua sendo registrada em
--      reais, senão estoque, faturamento e relatórios deixam de fechar.

BEGIN;

-- ---------------------------------------------------------------------------
-- Moedas
-- ---------------------------------------------------------------------------
-- `unidades_por_real` = quantas unidades da moeda equivalem a R$ 1,00.
-- Com 8,28, um preço de $770 vale 770 / 8,28 = R$ 93,00.
CREATE TABLE IF NOT EXISTS public.telegas_moedas (
  codigo             VARCHAR(3) PRIMARY KEY,
  nome               VARCHAR(50) NOT NULL,
  simbolo            VARCHAR(5)  NOT NULL,
  unidades_por_real  NUMERIC(12,6) NOT NULL CHECK (unidades_por_real > 0),
  atualizado_em      TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO public.telegas_moedas (codigo, nome, simbolo, unidades_por_real)
VALUES ('UYU', 'Peso uruguaio', '$', 8.28)
ON CONFLICT (codigo) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Preços por etiqueta
-- ---------------------------------------------------------------------------
-- Uma linha por etiqueta + produto. Sem linha, vale o preço da tabela.
CREATE TABLE IF NOT EXISTS public.telegas_precos_especiais (
  id             SERIAL PRIMARY KEY,
  etiqueta       VARCHAR(50) NOT NULL,
  produto_id     INTEGER NOT NULL
                   REFERENCES public.telegas_produtos(id) ON DELETE CASCADE,

  -- Valor na moeda indicada. Com moeda NULL, o preço já está em reais.
  preco          NUMERIC(10,2) NOT NULL CHECK (preco > 0),
  moeda          VARCHAR(3) REFERENCES public.telegas_moedas(codigo),

  ativo          BOOLEAN NOT NULL DEFAULT true,
  observacao     TEXT,
  criado_em      TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em  TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT telegas_precos_especiais_unico UNIQUE (etiqueta, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_telegas_precos_especiais_etiqueta
  ON public.telegas_precos_especiais (etiqueta) WHERE ativo;


-- ---------------------------------------------------------------------------
-- Rastro no pedido
-- ---------------------------------------------------------------------------
-- A cotação precisa ficar gravada em cada pedido. Guardando só "pagou em
-- pesos", daqui a três meses — com a cotação em outro patamar — não haveria
-- como reconstruir quanto aquele pedido realmente valeu.
ALTER TABLE public.telegas_pedidos
  ADD COLUMN IF NOT EXISTS moeda_pagamento VARCHAR(3);

ALTER TABLE public.telegas_pedidos
  ADD COLUMN IF NOT EXISTS cotacao_usada NUMERIC(12,6);

-- Total na moeda estrangeira, como o cliente vê e paga. O campo `total`
-- continua sendo a fonte de verdade em reais.
ALTER TABLE public.telegas_pedidos
  ADD COLUMN IF NOT EXISTS total_moeda NUMERIC(10,2);


-- ---------------------------------------------------------------------------
-- O caso que motivou tudo
-- ---------------------------------------------------------------------------
-- $770 no Gás Cinza 13kg para quem tem etiqueta "Uruguai". Se o produto tiver
-- outro nome nesta base, o INSERT simplesmente não encontra nada e nada é
-- criado — sem erro, e você cadastra pela tela.
INSERT INTO public.telegas_precos_especiais (etiqueta, produto_id, preco, moeda, observacao)
SELECT 'Uruguai', p.id, 770.00, 'UYU', 'Preço de entrega no Uruguai'
  FROM public.telegas_produtos p
 WHERE p.nome ILIKE '%cinza%'
 LIMIT 1
ON CONFLICT (etiqueta, produto_id) DO NOTHING;

COMMIT;


-- Conferir o que ficou cadastrado:
--   SELECT pe.etiqueta, p.nome, pe.preco, pe.moeda,
--          ROUND(pe.preco / m.unidades_por_real, 2) AS em_reais
--     FROM telegas_precos_especiais pe
--     JOIN telegas_produtos p ON p.id = pe.produto_id
--     LEFT JOIN telegas_moedas m ON m.codigo = pe.moeda;
