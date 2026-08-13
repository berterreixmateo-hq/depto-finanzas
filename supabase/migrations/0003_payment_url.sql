-- ============================================================
-- Link de pago en los gastos fijos.
--
-- Un servicio (luz, gas, internet) es un gasto fijo con una página donde
-- se paga. Va acá y no en una tabla aparte: comparte monto estimado, día
-- de vencimiento, categoría y el ciclo mensual de instancias.
--
-- El CHECK limita el esquema a http/https. La URL se renderiza en un
-- href, y sin esto un `javascript:` guardado en la base se convertiría
-- en ejecución de código al hacer click.
-- ============================================================

alter table recurring_expenses
  add column payment_url text
  check (payment_url is null or payment_url ~* '^https?://');

-- Número de cliente, de contrato, con qué tarjeta se paga: lo que hace falta
-- tener a mano justo cuando entrás a pagar y nunca te acordás dónde estaba.
alter table recurring_expenses add column notes text;
