-- 003 — Excluir cliente não pode ser bloqueado pelo histórico de estoque
--
-- Como rodar: cole no pgweb e execute. Pode rodar duas vezes sem problema.
--
-- O problema:
--   telegas_pedidos referencia telegas_clientes(telefone) ON DELETE CASCADE,
--   então apagar um cliente apaga os pedidos dele. Mas
--   telegas_estoque_movimentos.pedido_id aponta para telegas_pedidos sem regra
--   de exclusão, o que faz o banco recusar a operação inteira:
--
--     ERROR: update or delete on table "telegas_pedidos" violates foreign key
--     constraint "telegas_estoque_movimentos_pedido_id_fkey"
--
-- A decisão:
--   SET NULL em vez de CASCADE. A movimentação de estoque é um registro do que
--   fisicamente saiu do depósito — apagá-la junto com o cadastro do cliente
--   faria o saldo do sistema divergir do estoque real. O movimento permanece,
--   apenas sem apontar para um pedido que não existe mais.

BEGIN;

ALTER TABLE public.telegas_estoque_movimentos
  DROP CONSTRAINT IF EXISTS telegas_estoque_movimentos_pedido_id_fkey;

ALTER TABLE public.telegas_estoque_movimentos
  ADD CONSTRAINT telegas_estoque_movimentos_pedido_id_fkey
  FOREIGN KEY (pedido_id)
  REFERENCES public.telegas_pedidos(id)
  ON DELETE SET NULL;

COMMIT;
