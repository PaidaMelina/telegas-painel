-- TeleGás — schema do banco de dados
--
-- Retrato fiel do banco de produção, extraído de information_schema/pg_catalog
-- em 2026-08-07. O schema original nunca esteve versionado: as tabelas nasceram
-- do workflow n8n "Setup DB TeleGas" e foram evoluindo por ALTER TABLE avulsos.
-- Este arquivo passa a ser a fonte de verdade.
--
-- Para um Postgres novo e vazio:
--   psql "$DATABASE_URL" -f db/schema.sql
--   psql "$DATABASE_URL" -f db/seed.sql
--
-- Idempotente: rodar sobre um banco já populado não apaga nem altera dados.
--
-- ATENÇÃO — dívidas conhecidas, preservadas aqui porque o banco de produção é
-- assim hoje. Mudar qualquer uma exige migração combinada com o código:
--   1. telegas_pedidos carrega DUAS gerações de colunas (ver comentário lá).
--   2. Os timestamps são "timestamp without time zone", exceto dois campos.
--      Como a aplicação opera em America/Sao_Paulo e as queries fazem
--      "AT TIME ZONE", trocar para timestamptz mudaria resultados de relatório.
--   3. telegas_estoque.produto_id não é UNIQUE, mas o código assume uma linha
--      por produto.
--   4. telegas_entregadores.telefone não é UNIQUE, mas o código trata o erro
--      23505 ("telefone já cadastrado"), que nunca dispara.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- crypt() nos logins


-- ---------------------------------------------------------------------------
-- Usuários do painel administrativo
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegas_usuarios (
  id          SERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  senha_hash  VARCHAR(255) NOT NULL,
  nome        VARCHAR(255),
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- Clientes
-- ---------------------------------------------------------------------------
-- telefone é a chave de negócio: telegas_pedidos referencia esta coluna por FK,
-- e o agente do WhatsApp faz upsert por ela.
--
-- total_pedidos é uma coluna física, não calculada — mas nenhuma rota da API a
-- mantém atualizada (as telas contam os pedidos por JOIN). Hoje fica sempre 0.
CREATE TABLE IF NOT EXISTS public.telegas_clientes (
  id                SERIAL PRIMARY KEY,
  telefone          VARCHAR(20) NOT NULL UNIQUE,
  nome              VARCHAR(100),
  endereco          TEXT,
  bairro            VARCHAR(100),
  etiquetas         TEXT[] DEFAULT '{}',
  total_pedidos     INTEGER DEFAULT 0,
  ultima_interacao  TIMESTAMP DEFAULT NOW(),
  created_at        TIMESTAMP DEFAULT NOW(),
  updated_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegas_clientes_telefone
  ON public.telegas_clientes (telefone);


-- ---------------------------------------------------------------------------
-- Entregadores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegas_entregadores (
  id                 SERIAL PRIMARY KEY,
  nome               VARCHAR(200) NOT NULL,
  telefone           VARCHAR(50) NOT NULL,   -- ver dívida 4
  ativo              BOOLEAN DEFAULT true,
  em_folga           BOOLEAN NOT NULL DEFAULT false,
  senha_hash         TEXT,
  push_subscription  JSONB,
  created_at         TIMESTAMP DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- Produtos e estoque
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegas_produtos (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(200) NOT NULL,
  preco       NUMERIC NOT NULL,
  unidade     VARCHAR(50) DEFAULT 'unidade',
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.telegas_estoque (
  id                 SERIAL PRIMARY KEY,
  produto_id         INTEGER REFERENCES public.telegas_produtos(id),  -- ver dívida 3
  quantidade         INTEGER NOT NULL DEFAULT 0,
  quantidade_minima  INTEGER NOT NULL DEFAULT 5,
  updated_at         TIMESTAMP DEFAULT NOW()
);

-- tipo: 'entrada' | 'saida' | 'ajuste'
CREATE TABLE IF NOT EXISTS public.telegas_estoque_movimentos (
  id          SERIAL PRIMARY KEY,
  produto_id  INTEGER REFERENCES public.telegas_produtos(id),
  tipo        VARCHAR(20) NOT NULL,
  quantidade  INTEGER NOT NULL,
  pedido_id   INTEGER,   -- FK adicionada no fim do arquivo (telegas_pedidos vem depois)
  observacao  TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);


-- ---------------------------------------------------------------------------
-- Meta semanal de compra (clientes B2B)
-- ---------------------------------------------------------------------------
-- Quanto se espera que um cliente compre de cada produto por semana. Serve de
-- régua para a detecção de queda de vendas enquanto não há histórico suficiente
-- para calcular o padrão observado — ver migrations/002_metas_cliente.sql.
CREATE TABLE IF NOT EXISTS public.telegas_cliente_metas (
  id                  SERIAL PRIMARY KEY,
  cliente_id          INTEGER NOT NULL
                        REFERENCES public.telegas_clientes(id) ON DELETE CASCADE,
  produto_id          INTEGER NOT NULL
                        REFERENCES public.telegas_produtos(id) ON DELETE CASCADE,
  quantidade_semanal  NUMERIC(10,2) NOT NULL CHECK (quantidade_semanal > 0),
  observacao          TEXT,
  criado_em           TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em       TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT telegas_cliente_metas_unico UNIQUE (cliente_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_telegas_cliente_metas_cliente
  ON public.telegas_cliente_metas (cliente_id);


-- ---------------------------------------------------------------------------
-- Formas de pagamento
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegas_formas_pagamento (
  id            SERIAL PRIMARY KEY,
  nome          VARCHAR(100) NOT NULL,
  slug          VARCHAR(50) NOT NULL UNIQUE,
  aceita_troco  BOOLEAN DEFAULT false,
  ativo         BOOLEAN DEFAULT true,
  ordem         INTEGER DEFAULT 0
);


-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------
-- ⚠️  DÍVIDA 1 — duas gerações de colunas convivendo:
--
--   Geração 1 (agente n8n original, um produto por pedido):
--     telefone, nome_cliente, produto, quantidade, valor_total, mensagem_ia
--   Geração 2 (painel, carrinho com vários itens):
--     telefone_cliente, produtos (jsonb), total, cliente_id, bairro,
--     troco_para, entregador_id, latitude, longitude, os campos *_em
--
--   O painel escreve na geração 2, mas `telefone` continua NOT NULL e é quem
--   carrega a foreign key. `valor_total` e `total` podem divergir, assim como
--   `produto` e `produtos`. Unificar exige migrar dados e ajustar o agente n8n.
--
-- produtos (jsonb): [{"produto": "Gás P13", "qtd": 1, "preco": 129.00}, ...]
-- Os relatórios leem essas chaves via ->>'produto', ->>'qtd', ->>'preco'.
--
-- A FK é por TELEFONE, com ON DELETE CASCADE: apagar um cliente apaga todos os
-- pedidos dele, e o histórico de status vai junto.
CREATE TABLE IF NOT EXISTS public.telegas_pedidos (
  id                   SERIAL PRIMARY KEY,

  -- geração 1
  telefone             VARCHAR(20) NOT NULL
                         REFERENCES public.telegas_clientes(telefone) ON DELETE CASCADE,
  nome_cliente         VARCHAR(100),
  produto              VARCHAR(100),
  quantidade           INTEGER DEFAULT 1,
  valor_total          NUMERIC,
  mensagem_ia          TEXT,

  -- geração 2
  cliente_id           INTEGER,
  telefone_cliente     VARCHAR(50),
  produtos             JSONB,
  total                NUMERIC,
  bairro               VARCHAR(100),
  troco_para           NUMERIC,
  entregador_id        INTEGER,
  latitude             NUMERIC,
  longitude            NUMERIC,

  -- comuns
  endereco             TEXT,
  forma_pagamento      VARCHAR(50),
  status               VARCHAR(20) DEFAULT 'pendente'
                         CHECK (status IN ('novo', 'confirmado', 'atribuido',
                                           'saiu_para_entrega', 'entregue', 'cancelado')),
  motivo_cancelamento  TEXT,
  created_at           TIMESTAMP DEFAULT NOW(),
  updated_at           TIMESTAMP DEFAULT NOW(),
  confirmado_em        TIMESTAMP,
  atribuido_em         TIMESTAMP,
  saiu_entrega_em      TIMESTAMP,
  entregue_em          TIMESTAMP,
  cancelado_em         TIMESTAMP
);
-- Nota: o DEFAULT 'pendente' viola o próprio CHECK — um INSERT que omita
-- `status` falha. Toda inserção precisa informar o status explicitamente.
-- Preservado como está para espelhar produção.

CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_created_at    ON public.telegas_pedidos (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_telefone      ON public.telegas_pedidos (telefone);
CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_status        ON public.telegas_pedidos (status);
CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_entregador_id ON public.telegas_pedidos (entregador_id);


-- ---------------------------------------------------------------------------
-- Histórico de status
-- ---------------------------------------------------------------------------
-- Guarda apenas o status novo (não o anterior); a transição fica descrita em
-- texto na coluna observacao. Populado por trigger (ver adiante).
CREATE TABLE IF NOT EXISTS public.telegas_pedidos_status_history (
  id          BIGSERIAL PRIMARY KEY,
  pedido_id   INTEGER NOT NULL
                REFERENCES public.telegas_pedidos(id) ON DELETE CASCADE,
  status      VARCHAR NOT NULL,
  changed_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  changed_by  VARCHAR,
  observacao  TEXT
);

CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_status_history_pedido_id
  ON public.telegas_pedidos_status_history (pedido_id);
CREATE INDEX IF NOT EXISTS idx_telegas_pedidos_status_history_changed_at
  ON public.telegas_pedidos_status_history (changed_at);


-- ---------------------------------------------------------------------------
-- Memória de conversa do n8n
-- ---------------------------------------------------------------------------
-- telegas_memoria_chat é a tabela do nó "Postgres Chat Memory" e é a que a rota
-- /api/conversas lê. telegas_chat_history é de uma implementação anterior e
-- nenhuma rota da API a consulta hoje.
CREATE TABLE IF NOT EXISTS public.telegas_memoria_chat (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(255) NOT NULL,
  message     JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS public.telegas_chat_history (
  id          SERIAL PRIMARY KEY,
  session_id  VARCHAR(255) NOT NULL,
  type        VARCHAR(50) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegas_chat_history_session
  ON public.telegas_chat_history (session_id);


-- ---------------------------------------------------------------------------
-- FKs adiadas
-- ---------------------------------------------------------------------------
-- telegas_estoque_movimentos.pedido_id só pode referenciar telegas_pedidos
-- depois que ela existe, e a ordem de criação acima segue as dependências.
-- ON DELETE SET NULL: a movimentação registra o que fisicamente saiu do
-- depósito. Se fosse apagada junto com o pedido (ao excluir um cliente, por
-- exemplo), o saldo do sistema deixaria de refletir o estoque real. Ver
-- migrations/003_estoque_preserva_movimento.sql.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'telegas_estoque_movimentos_pedido_id_fkey'
  ) THEN
    ALTER TABLE public.telegas_estoque_movimentos
      ADD CONSTRAINT telegas_estoque_movimentos_pedido_id_fkey
      FOREIGN KEY (pedido_id) REFERENCES public.telegas_pedidos(id)
      ON DELETE SET NULL;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- ⚠️  DÍVIDA 6 — há DUAS triggers de histórico no mesmo evento
--   trg_telegas_registrar_historico_status → fn_telegas_registrar_historico_status()
--   trg_registra_historico_status_pedido   → registra_historico_status_pedido()
-- Ambas AFTER INSERT OR UPDATE ON telegas_pedidos FOR EACH ROW. Se as duas
-- gravam em telegas_pedidos_status_history, cada mudança de status vira duas
-- linhas e a tela de histórico do pedido mostra tudo em duplicidade.
-- A segunda função ainda não foi inspecionada; ver migrations/002.
--
-- Também existem duas triggers BEFORE UPDATE mantendo updated_at:
--   update_telegas_pedidos_updated_at  ON telegas_pedidos
--   update_telegas_clientes_updated_at ON telegas_clientes
-- ambas chamando update_updated_at_column(). Por isso `updated_at` é confiável
-- nessas duas tabelas sem a aplicação precisar defini-lo.

CREATE OR REPLACE FUNCTION public.fn_telegas_registrar_historico_status()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status IS NOT NULL THEN
      INSERT INTO public.telegas_pedidos_status_history
        (pedido_id, status, changed_at, changed_by, observacao)
      VALUES
        (NEW.id, NEW.status,
         COALESCE(NEW.updated_at, NEW.created_at, now()),
         'system', 'Status inicial do pedido');
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.telegas_pedidos_status_history
        (pedido_id, status, changed_at, changed_by, observacao)
      VALUES
        (NEW.id, NEW.status,
         COALESCE(NEW.updated_at, now()),
         'system',
         CONCAT('Status alterado de ', COALESCE(OLD.status, 'null'),
                ' para ', COALESCE(NEW.status, 'null')));
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_telegas_registrar_historico_status ON public.telegas_pedidos;
CREATE TRIGGER trg_telegas_registrar_historico_status
  AFTER INSERT OR UPDATE ON public.telegas_pedidos
  FOR EACH ROW EXECUTE FUNCTION public.fn_telegas_registrar_historico_status();

-- NOTA: update_updated_at_column() e as triggers que a usam não estão
-- reproduzidas aqui — a definição da função ainda não foi capturada.


-- ---------------------------------------------------------------------------
-- View: telegas_pedidos_completos
-- ---------------------------------------------------------------------------
-- Legado: projeta apenas as colunas da geração 1 (produto/quantidade/
-- valor_total), ignorando produtos/total da geração 2. Um pedido criado pela
-- portaria aparece aqui sem itens e sem valor. Nenhuma rota da API a usa.
CREATE OR REPLACE VIEW public.telegas_pedidos_completos AS
SELECT p.id,
       p.telefone,
       p.nome_cliente,
       p.endereco,
       p.produto,
       p.quantidade,
       p.forma_pagamento,
       p.valor_total,
       p.mensagem_ia,
       p.status,
       p.created_at,
       p.updated_at,
       c.nome          AS cliente_nome_cadastrado,
       c.total_pedidos AS total_pedidos_cliente,
       c.created_at    AS cliente_desde
  FROM public.telegas_pedidos p
  LEFT JOIN public.telegas_clientes c
    ON p.telefone::text = c.telefone::text;
