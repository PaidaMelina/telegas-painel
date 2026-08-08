-- 008 — Preço combinado com um cliente específico
--
-- A 007 resolveu preço por etiqueta ("todo cliente do Uruguai paga $770 no
-- Cinza"), que cobre o grupo mas não a exceção: um cliente com preço próprio,
-- negociado só com ele, não tinha onde ser cadastrado.
--
-- Agora a mesma tabela guarda os dois casos:
--
--   cliente_id preenchido  → preço daquele cliente
--   etiqueta preenchida    → preço do grupo
--
-- Quando os dois existem para o mesmo produto, vence o do cliente: o acordo
-- individual é mais específico que a regra do grupo.

BEGIN;

ALTER TABLE public.telegas_precos_especiais
  ADD COLUMN IF NOT EXISTS cliente_id INTEGER
    REFERENCES public.telegas_clientes(id) ON DELETE CASCADE;

-- etiqueta deixa de ser obrigatória: linhas de cliente não têm etiqueta.
ALTER TABLE public.telegas_precos_especiais
  ALTER COLUMN etiqueta DROP NOT NULL;

-- Uma linha vale por cliente OU por etiqueta, nunca pelos dois nem por nenhum.
ALTER TABLE public.telegas_precos_especiais
  DROP CONSTRAINT IF EXISTS telegas_precos_especiais_alvo;

ALTER TABLE public.telegas_precos_especiais
  ADD CONSTRAINT telegas_precos_especiais_alvo
  CHECK (
    (cliente_id IS NOT NULL AND etiqueta IS NULL) OR
    (cliente_id IS NULL AND etiqueta IS NOT NULL)
  );

-- A unicidade antiga cobria (etiqueta, produto). Com etiqueta anulável ela
-- deixa de valer para as linhas de cliente, então são dois índices parciais.
ALTER TABLE public.telegas_precos_especiais
  DROP CONSTRAINT IF EXISTS telegas_precos_especiais_unico;

CREATE UNIQUE INDEX IF NOT EXISTS idx_precos_etiqueta_produto
  ON public.telegas_precos_especiais (etiqueta, produto_id)
  WHERE etiqueta IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_precos_cliente_produto
  ON public.telegas_precos_especiais (cliente_id, produto_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_precos_cliente
  ON public.telegas_precos_especiais (cliente_id) WHERE ativo;

COMMIT;
