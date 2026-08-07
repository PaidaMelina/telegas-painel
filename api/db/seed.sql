-- TeleGás — dados mínimos para o sistema subir utilizável.
-- Rodar depois de schema.sql:
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- Idempotente: ON CONFLICT DO NOTHING em tudo, pode rodar de novo sem duplicar.

-- ---------------------------------------------------------------------------
-- Usuário administrador do painel
-- ---------------------------------------------------------------------------
-- ⚠️  TROQUE O E-MAIL E A SENHA ABAIXO ANTES DE RODAR.
--     A senha é gravada com bcrypt via pgcrypto; o login em routes/auth.ts
--     compara com crypt(senha, senha_hash).
--
-- Para trocar a senha depois:
--   UPDATE public.telegas_usuarios
--      SET senha_hash = crypt('nova-senha', gen_salt('bf'))
--    WHERE email = 'admin@telegas.com.br';

INSERT INTO public.telegas_usuarios (nome, email, senha_hash, ativo)
VALUES (
  'Administrador',
  'admin@telegas.com.br',
  crypt('TROQUE-ESTA-SENHA', gen_salt('bf')),
  true
)
ON CONFLICT (email) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Formas de pagamento
-- ---------------------------------------------------------------------------
-- Os slugs 'dinheiro', 'pix' e 'cartao' são reconhecidos pela portaria
-- (routes/portaria.ts monta o rótulo da mensagem do WhatsApp a partir deles).
-- Slugs novos funcionam, mas caem no rótulo genérico.

INSERT INTO public.telegas_formas_pagamento (nome, slug, aceita_troco, ativo, ordem) VALUES
  ('Dinheiro', 'dinheiro', true,  true, 1),
  ('PIX',      'pix',      false, true, 2),
  ('Cartão',   'cartao',   false, true, 3)
ON CONFLICT (slug) DO NOTHING;


-- ---------------------------------------------------------------------------
-- Produtos e estoque inicial
-- ---------------------------------------------------------------------------
-- ⚠️  OS PREÇOS ESTÃO ZERADOS DE PROPÓSITO. Ajuste em Produtos no painel
--     (ou por UPDATE aqui) ANTES de aceitar pedidos — um pedido criado com
--     preço 0 fecha com total R$ 0,00.
--
-- Ajuste a lista para os produtos que você realmente vende.

-- telegas_produtos não tem UNIQUE em nome, então ON CONFLICT não protegeria
-- contra duplicação: o filtro por NOT EXISTS é o que torna este bloco repetível.
INSERT INTO public.telegas_produtos (nome, preco, unidade, ativo)
SELECT v.nome, v.preco, v.unidade, true
  FROM (VALUES
    ('Gás P13',  0.00, 'unidade'),
    ('Gás P45',  0.00, 'unidade'),
    ('Água 20L', 0.00, 'unidade')
  ) AS v(nome, preco, unidade)
 WHERE NOT EXISTS (
   SELECT 1 FROM public.telegas_produtos p WHERE p.nome = v.nome
 );

-- Cria a linha de estoque para todo produto que ainda não tem uma.
INSERT INTO public.telegas_estoque (produto_id, quantidade, quantidade_minima)
SELECT p.id, 0, 5
  FROM public.telegas_produtos p
 WHERE NOT EXISTS (
   SELECT 1 FROM public.telegas_estoque e WHERE e.produto_id = p.id
 );
