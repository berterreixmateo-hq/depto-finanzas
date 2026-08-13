-- ============================================================
-- Frecuencia no mensual y gastos en cuotas.
--
-- `recurring_expenses` asumía "todos los meses, para siempre". Eso deja
-- afuera dos casos reales: el gas que viene bimestral o un seguro anual,
-- y el electrodoméstico en 12 cuotas que tiene que dejar de aparecer
-- cuando se termina de pagar.
--
-- `start_month` es el ancla: a partir de ahí se cuenta cada cuántos meses
-- corresponde. Sin ancla no hay forma de saber si un bimestral cae en los
-- meses pares o impares.
-- ============================================================

alter table recurring_expenses
  add column frequency text not null default 'mensual'
  check (frequency in ('mensual', 'bimestral', 'trimestral', 'semestral', 'anual'));

alter table recurring_expenses
  add column start_month date not null default date_trunc('month', now());

-- Null = recurrente indefinido (alquiler, internet). Con valor = termina.
alter table recurring_expenses
  add column installments_total smallint
  check (installments_total is null or installments_total >= 1);

-- start_month tiene que ser el día 1: es un mes, no una fecha. El resto del
-- cálculo cuenta meses enteros desde acá y un día 15 lo desalinearía.
alter table recurring_expenses
  add constraint recurring_expenses_start_month_is_first_day
  check (extract(day from start_month) = 1);
