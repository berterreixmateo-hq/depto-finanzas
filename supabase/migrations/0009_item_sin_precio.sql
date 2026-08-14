-- ============================================================
-- "No sé cuánto costó" deja de escribirse como cero.
--
-- Al cerrar una compra, los productos sin precio de Coto se guardaban con
-- amount 0 porque la columna era not null. Un cero dice "salió gratis", que
-- es una afirmación distinta de "no lo sabemos", y cualquier suma sobre
-- expense_items daría de menos sin ninguna señal de que falta información.
--
-- Los tickets escaneados sí traen importe por línea y no se ven afectados.
-- ============================================================

alter table expense_items alter column amount drop not null;

-- Los ceros que ya se guardaron por esta causa vienen de compras cerradas
-- desde la lista; en un ticket un renglón de 0 no existe.
update expense_items
set amount = null
where amount = 0
  and expense_id in (select id from expenses where source = 'shopping');
