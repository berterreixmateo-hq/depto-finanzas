-- ============================================================
-- Ingresos por persona.
--
-- Mismo patrón histórico que `budgets`: se inserta una fila nueva solo
-- cuando el monto cambia, y el vigente para un mes es la fila más reciente
-- con `effective_month <= mes`. Un sueldo que no cambia se carga una vez y
-- vale para todos los meses siguientes; cuando hay aumento, se agrega una
-- fila y los meses anteriores conservan el valor que tenían.
--
-- Visible para los dos miembros del hogar, como el resto del esquema: cada
-- uno carga los propios (RLS de escritura por user_id) pero ambos leen todo,
-- que es lo que permite mostrar el ahorro conjunto.
-- ============================================================

create table incomes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  effective_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  note text,
  created_at timestamptz not null default now(),
  unique (user_id, effective_month)
);

create index incomes_household_id_idx on incomes (household_id);

-- effective_month es un mes, no una fecha: el día 1 mantiene comparable el
-- "más reciente <= mes" sin que un día 15 desordene el cálculo.
alter table incomes
  add constraint incomes_effective_month_is_first_day
  check (extract(day from effective_month) = 1);

alter table incomes enable row level security;

-- Lectura: cualquier miembro del hogar.
create policy "incomes_select_members" on incomes
  for select to authenticated
  using (is_household_member(household_id));

-- Escritura: solo sobre los propios. Que se vean no significa que se editen.
create policy "incomes_insert_self" on incomes
  for insert to authenticated
  with check (user_id = auth.uid() and is_household_member(household_id));

create policy "incomes_update_self" on incomes
  for update to authenticated
  using (user_id = auth.uid() and is_household_member(household_id))
  with check (user_id = auth.uid() and is_household_member(household_id));

create policy "incomes_delete_self" on incomes
  for delete to authenticated
  using (user_id = auth.uid() and is_household_member(household_id));
