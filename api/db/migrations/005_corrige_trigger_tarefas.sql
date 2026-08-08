-- 005 — Corrige a trigger de telegas_tarefas
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- O problema:
--   A migração 004 reaproveitou update_updated_at_column(), a função já usada
--   por telegas_pedidos e telegas_clientes. Só que essa função preenche uma
--   coluna chamada `updated_at`, e telegas_tarefas nomeou o campo como
--   `atualizado_em`. A trigger então falha com:
--
--     record "new" has no field "updated_at"
--
--   e, por ser BEFORE UPDATE, derruba QUALQUER alteração de tarefa — iniciar,
--   concluir, adiar e descartar. Inserir funciona, porque a trigger não age
--   em INSERT: por isso criar tarefa parecia normal.
--
-- A correção:
--   Uma função própria para as tabelas novas, que usam nomes em português.
--   Renomear as colunas seria a alternativa, mas mexeria em telegas_tarefas e
--   telegas_cliente_metas, que já estão em produção.

BEGIN;

CREATE OR REPLACE FUNCTION public.telegas_set_atualizado_em()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

-- Remove a trigger defeituosa criada pela 004.
DROP TRIGGER IF EXISTS update_telegas_tarefas_updated_at ON public.telegas_tarefas;

DROP TRIGGER IF EXISTS trg_telegas_tarefas_atualizado ON public.telegas_tarefas;
CREATE TRIGGER trg_telegas_tarefas_atualizado
  BEFORE UPDATE ON public.telegas_tarefas
  FOR EACH ROW EXECUTE FUNCTION public.telegas_set_atualizado_em();

-- Mesma proteção para as metas de compra, que ainda não tinham trigger.
DROP TRIGGER IF EXISTS trg_telegas_cliente_metas_atualizado ON public.telegas_cliente_metas;
CREATE TRIGGER trg_telegas_cliente_metas_atualizado
  BEFORE UPDATE ON public.telegas_cliente_metas
  FOR EACH ROW EXECUTE FUNCTION public.telegas_set_atualizado_em();

COMMIT;
