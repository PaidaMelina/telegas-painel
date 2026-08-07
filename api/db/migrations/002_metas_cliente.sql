-- 002 — Meta semanal de compra por cliente e produto
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- Por que existe: a detecção de queda de vendas compara o que o cliente compra
-- agora com o que ele costuma comprar. Como a base de pedidos foi zerada, não
-- há histórico para calcular esse "costuma" — levaria meses acumulando.
-- A meta declarada no cadastro resolve isso: o gerente já sabe que "As gurias
-- levam 16 P13 por semana", e essa informação vira a régua desde o primeiro dia.
--
-- É por produto, e não um total, porque a perda costuma começar em uma linha
-- só: a revenda mantém o gás e para a água. Um número agregado esconderia isso.

BEGIN;

CREATE TABLE IF NOT EXISTS public.telegas_cliente_metas (
  id                  SERIAL PRIMARY KEY,
  cliente_id          INTEGER NOT NULL
                        REFERENCES public.telegas_clientes(id) ON DELETE CASCADE,
  produto_id          INTEGER NOT NULL
                        REFERENCES public.telegas_produtos(id) ON DELETE CASCADE,

  -- Quantidade que se espera que o cliente compre por semana.
  -- NUMERIC e não INTEGER: há casos de meia unidade em produtos maiores
  -- (ex.: um P45 a cada duas semanas = 0,5).
  quantidade_semanal  NUMERIC(10,2) NOT NULL CHECK (quantidade_semanal > 0),

  observacao          TEXT,
  criado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMP NOT NULL DEFAULT NOW(),

  -- Uma meta por par cliente/produto: duas linhas para o mesmo produto
  -- tornariam ambíguo contra qual número comparar.
  CONSTRAINT telegas_cliente_metas_unico UNIQUE (cliente_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_telegas_cliente_metas_cliente
  ON public.telegas_cliente_metas (cliente_id);

COMMIT;
