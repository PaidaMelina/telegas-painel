-- 001 — Corrige problemas de integridade encontrados no levantamento de 2026-08-07
--
-- Como rodar: cole o arquivo inteiro no pgweb e execute.
--
-- É seguro: cada bloco confere a situação antes de agir. Onde existirem dados
-- conflitantes, o script NÃO força a mudança — ele apenas avisa, para você
-- decidir. Rodar duas vezes não causa problema.
--
-- Depois de executar, leia as mensagens da aba de notices/mensagens. Tudo que
-- exigir sua decisão aparece como AVISO.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. status: o valor padrão é inválido perante a própria regra da coluna
-- ---------------------------------------------------------------------------
-- A coluna aceita apenas: novo, confirmado, atribuido, saiu_para_entrega,
-- entregue, cancelado. Mas o padrão era 'pendente', que não está na lista.
-- Consequência: qualquer inserção que não informe o status explicitamente
-- falha. Hoje só funciona porque todo o código informa. Passa a ser 'novo'.
ALTER TABLE public.telegas_pedidos
  ALTER COLUMN status SET DEFAULT 'novo';


-- ---------------------------------------------------------------------------
-- 2. Estoque: garantir uma única linha por produto
-- ---------------------------------------------------------------------------
-- O código faz "UPDATE telegas_estoque ... WHERE produto_id = X" e lê o
-- primeiro resultado, assumindo uma linha por produto. Nada garantia isso:
-- duas linhas para o mesmo produto fariam o saldo exibido divergir do real.
DO $$
DECLARE
  duplicados INTEGER;
  nulos      INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT produto_id FROM public.telegas_estoque
     WHERE produto_id IS NOT NULL
     GROUP BY produto_id HAVING COUNT(*) > 1
  ) d;

  SELECT COUNT(*) INTO nulos
    FROM public.telegas_estoque WHERE produto_id IS NULL;

  IF duplicados > 0 OR nulos > 0 THEN
    RAISE NOTICE 'AVISO: estoque não pôde receber a regra de unicidade — % produto(s) com linha duplicada, % linha(s) sem produto. Resolva e rode de novo.', duplicados, nulos;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegas_estoque_produto_id_key'
  ) THEN
    RAISE NOTICE 'OK: estoque já possuía a regra de unicidade.';
  ELSE
    ALTER TABLE public.telegas_estoque
      ADD CONSTRAINT telegas_estoque_produto_id_key UNIQUE (produto_id);
    RAISE NOTICE 'OK: estoque agora aceita apenas uma linha por produto.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 3. Entregadores: impedir telefone repetido
-- ---------------------------------------------------------------------------
-- A API já responde "Telefone já cadastrado" ao erro de duplicidade, mas esse
-- erro nunca acontecia porque o banco permitia repetir. Dois entregadores com
-- o mesmo telefone quebram o login do app (a consulta traz mais de um).
DO $$
DECLARE
  duplicados INTEGER;
BEGIN
  SELECT COUNT(*) INTO duplicados FROM (
    SELECT telefone FROM public.telegas_entregadores
     GROUP BY telefone HAVING COUNT(*) > 1
  ) d;

  IF duplicados > 0 THEN
    RAISE NOTICE 'AVISO: % telefone(s) repetido(s) entre entregadores. A regra de unicidade NÃO foi aplicada. Veja quais com a consulta indicada no fim do arquivo.', duplicados;
  ELSIF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telegas_entregadores_telefone_key'
  ) THEN
    RAISE NOTICE 'OK: entregadores já possuíam a regra de unicidade.';
  ELSE
    ALTER TABLE public.telegas_entregadores
      ADD CONSTRAINT telegas_entregadores_telefone_key UNIQUE (telefone);
    RAISE NOTICE 'OK: telefone de entregador agora é único.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4. Índice para a tela de conversas
-- ---------------------------------------------------------------------------
-- /api/conversas ordena e filtra por session_id + id, sem índice para isso.
-- Com o volume atual não pesa, mas passa a pesar conforme o histórico cresce.
CREATE INDEX IF NOT EXISTS idx_telegas_memoria_chat_session
  ON public.telegas_memoria_chat (session_id, id DESC);

COMMIT;


-- ---------------------------------------------------------------------------
-- Consultas de apoio — rode separadamente se algum AVISO apareceu acima
-- ---------------------------------------------------------------------------
-- Entregadores com telefone repetido:
--   SELECT telefone, COUNT(*), string_agg(nome || ' (id ' || id || ')', ', ')
--     FROM public.telegas_entregadores
--    GROUP BY telefone HAVING COUNT(*) > 1;
--
-- Produtos com mais de uma linha de estoque:
--   SELECT produto_id, COUNT(*), string_agg(id::text, ', ')
--     FROM public.telegas_estoque
--    GROUP BY produto_id HAVING COUNT(*) > 1;
