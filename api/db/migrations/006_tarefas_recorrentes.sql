-- 006 — Tarefas operacionais, prazo e repetição
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- O modelo da 004 foi desenhado em cima de um caso só — visitar cliente — e
-- ficou estreito. Não cabia uma tarefa como "fazer o pedido da Ultragaz até
-- sábado às 10h, toda semana":
--
--   1. Os resultados só descreviam visita (recuperado, perdido, não estava).
--   2. Não havia prazo, muito menos hora limite.
--   3. Não havia como repetir.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Resultados que servem a tarefas operacionais
-- ---------------------------------------------------------------------------
-- Os cinco primeiros descrevem o desfecho de uma visita a cliente; os três
-- novos descrevem o de uma tarefa interna. A tela mostra apenas o grupo que
-- corresponde ao tipo da tarefa.
ALTER TABLE public.telegas_tarefas
  DROP CONSTRAINT IF EXISTS telegas_tarefas_resultado_check;

ALTER TABLE public.telegas_tarefas
  ADD CONSTRAINT telegas_tarefas_resultado_check
  CHECK (resultado IS NULL OR resultado IN (
    -- desfecho de visita a cliente
    'recuperado', 'sem_sucesso', 'nao_estava', 'perdido', 'engano',
    -- desfecho de tarefa operacional
    'feito', 'nao_feito', 'nao_necessario'
  ));


-- ---------------------------------------------------------------------------
-- 2. Prazo
-- ---------------------------------------------------------------------------
-- TIMESTAMP e não DATE: "até as 10h de sábado" é um horário, e perder a hora
-- limite do pedido ao fornecedor custa a semana inteira de estoque.
ALTER TABLE public.telegas_tarefas
  ADD COLUMN IF NOT EXISTS prazo TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_telegas_tarefas_prazo
  ON public.telegas_tarefas (prazo)
  WHERE status IN ('pendente', 'em_andamento');


-- ---------------------------------------------------------------------------
-- 3. Repetição
-- ---------------------------------------------------------------------------
-- Ao concluir uma tarefa com recorrência, a API cria a ocorrência seguinte já
-- com o próximo prazo. Guardamos a origem em recorrencia_de para saber que as
-- ocorrências pertencem à mesma rotina.
ALTER TABLE public.telegas_tarefas
  ADD COLUMN IF NOT EXISTS recorrencia VARCHAR(20);

ALTER TABLE public.telegas_tarefas
  DROP CONSTRAINT IF EXISTS telegas_tarefas_recorrencia_check;

ALTER TABLE public.telegas_tarefas
  ADD CONSTRAINT telegas_tarefas_recorrencia_check
  CHECK (recorrencia IS NULL OR recorrencia IN ('semanal', 'quinzenal', 'mensal'));

ALTER TABLE public.telegas_tarefas
  ADD COLUMN IF NOT EXISTS recorrencia_de INTEGER
    REFERENCES public.telegas_tarefas(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- 4. Novos tipos
-- ---------------------------------------------------------------------------
-- Não havia CHECK em tipo, então nada a alterar no banco. Os tipos aceitos
-- pela API passam a incluir 'compra' (pedido a fornecedor) e 'operacional'
-- (rotina interna), além dos que já existiam.

COMMIT;
