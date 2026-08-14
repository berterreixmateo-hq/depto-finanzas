-- ============================================================
-- Lector de tickets.
--
-- Un ticket escaneado produce un gasto (el total) más el detalle de lo que
-- se compró. El detalle vive aparte y no en el gasto: sirve para mirar qué
-- se compró, pero los presupuestos y el balance siguen leyendo `expenses`
-- como única fuente de verdad del monto.
-- ============================================================

-- Dónde se compró. `description` queda para lo que escribe una persona;
-- esto lo completa el OCR y permite agrupar por comercio más adelante.
alter table expenses add column merchant text;

-- El origen ya distinguía manual / recurring / shopping; los tickets son
-- un cuarto camino de entrada y conviene poder filtrarlos.
alter table expenses drop constraint expenses_source_check;
alter table expenses add constraint expenses_source_check
  check (source in ('manual', 'recurring', 'shopping', 'ticket'));

create table expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  quantity numeric(10, 3),
  unit_price numeric(12, 2),
  -- Lo que efectivamente se pagó por esa línea. Es el único campo obligatorio
  -- de los tres: muchos tickets no discriminan cantidad ni precio unitario.
  amount numeric(12, 2) not null,
  created_at timestamptz not null default now()
);

create index expense_items_expense_id_idx on expense_items (expense_id);

alter table expense_items enable row level security;

create policy "expense_items_all_members" on expense_items
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
