-- ============================================================
-- Una cuota no puede figurar pagada sin el gasto que la pagó.
--
-- `recurring_expense_instances` guarda dos cosas que dicen lo mismo:
-- `status` y `expense_id`. La FK de `expense_id` es `on delete set null`,
-- así que al borrar un gasto la base limpiaba el vínculo y **dejaba
-- `status` en 'paid'**. Resultado: cuotas marcadas como pagadas sin nada
-- detrás. Pasó de verdad con el alquiler de agosto de 2026.
--
-- Es la misma familia de huérfano que el saldo de $910.000 sobre un hogar
-- sin gastos, pero acá la inconsistencia la produce la propia base, no la
-- app: arreglarlo solo en el cliente lo dejaría igual de roto si alguien
-- borra desde el SQL Editor. Por eso va abajo, en tres capas.
-- ============================================================

-- 1. Arreglar lo que ya está torcido.
update recurring_expense_instances
set status = 'pending'
where status = 'paid'
  and expense_id is null;

-- 2. Que borrar el gasto devuelva la cuota a pendiente.
--
-- Va BEFORE DELETE a propósito: para cuando corre el AFTER, la FK ya puso
-- `expense_id` en null y el `where` no encontraría nada que actualizar.
--
-- Queda como SECURITY INVOKER (el default): quien borra el gasto es
-- miembro del hogar y la política `recurring_expense_instances_all_members`
-- ya le permite tocar esa fila. No hace falta elevar privilegios.
create or replace function reset_instancia_al_borrar_gasto()
returns trigger
language plpgsql
as $$
begin
  update recurring_expense_instances
  set status = 'pending',
      expense_id = null
  where expense_id = old.id;
  return old;
end;
$$;

create trigger expenses_reset_instancia
  before delete on expenses
  for each row
  execute function reset_instancia_al_borrar_gasto();

-- 3. Que el estado inconsistente sea imposible de escribir.
--
-- El único camino que marca 'paid' es `pay-form.tsx`, y crea el gasto antes
-- de actualizar la cuota, así que nunca queda del lado prohibido. Cualquier
-- camino futuro que lo intente va a fallar acá en vez de corromper el dato
-- en silencio.
alter table recurring_expense_instances
  add constraint recurring_instance_pagada_tiene_gasto
  check (status = 'pending' or expense_id is not null);

comment on constraint recurring_instance_pagada_tiene_gasto
  on recurring_expense_instances is
  'Una cuota en "paid" siempre tiene su expense_id. Si el gasto se borra, el trigger expenses_reset_instancia la devuelve a "pending".';
