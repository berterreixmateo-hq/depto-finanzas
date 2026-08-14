-- ============================================================
-- Gastos que no generan deuda.
--
-- El alquiler lo paga uno y el otro le transfiere su parte en el momento.
-- Hasta ahora eso quedaba como "uno adelantó, el otro debe la mitad", y el
-- balance mostraba una deuda que en la vida real ya estaba saldada.
--
-- No se resuelve con un settlement automático: un settlement es un evento
-- de "nos pusimos al día" y ensuciarlo con una fila por cada alquiler haría
-- ilegible ese historial. Acá directamente no hubo deuda que saldar.
--
-- `paid_by` sigue significando lo mismo —la persona a la que se refiere
-- `payer_share_percentage`— porque de eso depende cuánto consumió cada uno.
-- Lo único que cambia es que el balance ignora estos gastos.
-- ============================================================

alter table expenses
  add column settled_on_payment boolean not null default false;

comment on column expenses.settled_on_payment is
  'Cada uno puso su parte al momento de pagar: el gasto no genera deuda entre los miembros. El reparto para "cuánto gastó cada uno" sigue saliendo de payer_share_percentage.';
