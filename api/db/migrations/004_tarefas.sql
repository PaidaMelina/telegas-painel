-- 004 — Tarefas do gerente
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- A área de trabalho do gerente: tarefas criadas por ele, pelo administrador
-- ou geradas pelo sistema (queda de compras, cliente novo sem recompra etc.),
-- que ele vai atualizando até concluir.

BEGIN;

-- ---------------------------------------------------------------------------
-- Papel do usuário
-- ---------------------------------------------------------------------------
-- Gerente executa as tarefas; administrador cria, acompanha e fiscaliza.
-- DEFAULT 'admin' de propósito: os usuários que já existem continuam com
-- acesso total, então ninguém perde o login ao aplicar esta migração.
ALTER TABLE public.telegas_usuarios
  ADD COLUMN IF NOT EXISTS papel VARCHAR(20) NOT NULL DEFAULT 'admin';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegas_usuarios_papel_check'
  ) THEN
    ALTER TABLE public.telegas_usuarios
      ADD CONSTRAINT telegas_usuarios_papel_check
      CHECK (papel IN ('admin', 'gerente'));
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- Tarefas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.telegas_tarefas (
  id            SERIAL PRIMARY KEY,

  -- Nem toda tarefa é sobre um cliente ("cotar frete", por exemplo).
  -- SET NULL: excluir um cliente não deve apagar o registro do trabalho feito.
  cliente_id    INTEGER REFERENCES public.telegas_clientes(id) ON DELETE SET NULL,

  -- visita | cobranca | cadastro | follow_up | oportunidade | outro
  tipo          VARCHAR(30) NOT NULL DEFAULT 'visita',

  -- sistema | admin | gerente — permite ao administrador distinguir o que a
  -- máquina pediu, o que ele pediu e o que o gerente se atribuiu sozinho.
  origem        VARCHAR(20) NOT NULL DEFAULT 'admin',

  -- Qual gatilho gerou (só quando origem = 'sistema'). Guardar isso é o que
  -- vai permitir, mais adiante, medir quais regras realmente recuperam cliente
  -- e desligar as que só geram ruído.
  regra         VARCHAR(50),

  titulo        VARCHAR(200) NOT NULL,
  descricao     TEXT,

  -- 0 a 100. A lista é ordenada por aqui, e não por data: uma revenda grande
  -- caindo importa mais que um cliente pequeno parado há mais tempo.
  prioridade    INTEGER NOT NULL DEFAULT 50 CHECK (prioridade BETWEEN 0 AND 100),

  -- Quanto se perde por mês se este cliente for embora. Alimenta a prioridade.
  valor_risco   NUMERIC(10,2),

  status        VARCHAR(20) NOT NULL DEFAULT 'pendente'
                  CHECK (status IN ('pendente', 'em_andamento', 'concluida',
                                    'adiada', 'descartada')),

  -- Preenchido ao concluir. Sem isto não há como saber se a visita adiantou
  -- alguma coisa — e é o dado que ensina quais gatilhos valem a pena.
  resultado     VARCHAR(30)
                  CHECK (resultado IS NULL OR resultado IN
                         ('recuperado', 'sem_sucesso', 'nao_estava',
                          'perdido', 'engano')),

  observacao    TEXT,
  adiada_para   DATE,

  criado_por    INTEGER REFERENCES public.telegas_usuarios(id) ON DELETE SET NULL,
  criado_em     TIMESTAMP NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMP NOT NULL DEFAULT NOW(),
  concluida_em  TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_telegas_tarefas_status
  ON public.telegas_tarefas (status, prioridade DESC);

CREATE INDEX IF NOT EXISTS idx_telegas_tarefas_cliente
  ON public.telegas_tarefas (cliente_id);

-- Impede que o gerador automático abra uma segunda tarefa para o mesmo cliente
-- pela mesma regra enquanto a anterior estiver aberta. Sem isto, a cada
-- verificação a lista encheria de repetições e o gerente pararia de olhar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_telegas_tarefas_sem_duplicata
  ON public.telegas_tarefas (cliente_id, regra)
  WHERE origem = 'sistema' AND status IN ('pendente', 'em_andamento');

-- Mantém atualizado_em sem depender da aplicação, como já acontece em
-- telegas_pedidos e telegas_clientes. Condicional: se a função não existir
-- neste banco, seguimos sem a trigger em vez de abortar a migração inteira.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_telegas_tarefas_updated_at ON public.telegas_tarefas;
    CREATE TRIGGER update_telegas_tarefas_updated_at
      BEFORE UPDATE ON public.telegas_tarefas
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  ELSE
    RAISE NOTICE 'update_updated_at_column() não existe: telegas_tarefas.atualizado_em não será preenchido automaticamente.';
  END IF;
END $$;

COMMIT;
