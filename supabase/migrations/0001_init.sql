-- Finanzas del depto — esquema inicial
-- Pegar completo en el SQL Editor de Supabase y ejecutar una sola vez.

-- ============================================================
-- Tablas
-- ============================================================

create table households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  color text not null,
  icon text not null,
  created_at timestamptz not null default now(),
  unique (household_id, name)
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  effective_month date not null,
  amount numeric(12, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (category_id, effective_month)
);

create table recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  category_id uuid not null references categories (id) on delete restrict,
  estimated_amount numeric(12, 2) not null check (estimated_amount >= 0),
  day_of_month smallint not null check (day_of_month between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table recurring_expense_instances (
  id uuid primary key default gen_random_uuid(),
  recurring_expense_id uuid not null references recurring_expenses (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  month date not null,
  due_date date not null,
  estimated_amount numeric(12, 2) not null,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  expense_id uuid, -- FK agregada más abajo, después de crear "expenses"
  invoice_url text,
  created_at timestamptz not null default now(),
  unique (recurring_expense_id, month)
);

create table expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  category_id uuid not null references categories (id) on delete restrict,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  expense_date date not null,
  paid_by uuid not null references auth.users (id),
  payer_share_percentage numeric(5, 2) not null default 50 check (payer_share_percentage between 0 and 100),
  split_type text not null default '50_50' check (split_type in ('50_50', 'custom', 'only_payer')),
  source text not null default 'manual' check (source in ('manual', 'recurring', 'shopping')),
  recurring_instance_id uuid references recurring_expense_instances (id) on delete set null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table recurring_expense_instances
  add constraint recurring_expense_instances_expense_id_fkey
  foreign key (expense_id) references expenses (id) on delete set null;

create table settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  settled_by uuid not null references auth.users (id),
  note text,
  created_at timestamptz not null default now()
);

create table shopping_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  list_type text not null check (list_type in ('faltantes', 'super')),
  name text not null,
  quantity text,
  is_checked boolean not null default false,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- Índices
-- ============================================================

create index expenses_household_date_idx on expenses (household_id, expense_date desc);
create index expenses_household_category_idx on expenses (household_id, category_id);
create index shopping_items_household_list_idx on shopping_items (household_id, list_type);
create index recurring_instances_household_month_idx on recurring_expense_instances (household_id, month);

-- ============================================================
-- updated_at automático en expenses
-- ============================================================

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_set_updated_at
  before update on expenses
  for each row
  execute function set_updated_at();

-- ============================================================
-- Helper de RLS: ¿el usuario logueado pertenece a este hogar?
-- security definer para no recursar sobre la RLS de household_members.
-- ============================================================

create function is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from household_members
    where household_id = target_household_id
      and user_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table households enable row level security;
alter table household_members enable row level security;
alter table categories enable row level security;
alter table budgets enable row level security;
alter table recurring_expenses enable row level security;
alter table recurring_expense_instances enable row level security;
alter table expenses enable row level security;
alter table settlements enable row level security;
alter table shopping_items enable row level security;

-- households: cualquier usuario logueado puede buscar un hogar por
-- invite_code (para poder unirse) y crear uno nuevo. El resto de las
-- tablas sí quedan estrictamente limitadas a miembros del hogar.
create policy "households_select_authenticated" on households
  for select to authenticated using (true);

create policy "households_insert_authenticated" on households
  for insert to authenticated with check (true);

create policy "households_update_members" on households
  for update to authenticated using (is_household_member(id));

-- household_members: cada uno ve su propia fila y las de su hogar;
-- se inserta a sí mismo (crear hogar o unirse con código).
create policy "household_members_select" on household_members
  for select to authenticated
  using (user_id = auth.uid() or is_household_member(household_id));

create policy "household_members_insert_self" on household_members
  for insert to authenticated with check (user_id = auth.uid());

create policy "household_members_update_self" on household_members
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Resto de tablas: acceso total (select/insert/update/delete) solo
-- para miembros del hogar dueño de la fila.
create policy "categories_all_members" on categories
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "budgets_all_members" on budgets
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "recurring_expenses_all_members" on recurring_expenses
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "recurring_expense_instances_all_members" on recurring_expense_instances
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "expenses_all_members" on expenses
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "settlements_all_members" on settlements
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

create policy "shopping_items_all_members" on shopping_items
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));

-- ============================================================
-- Realtime para las listas compartidas
-- ============================================================

alter publication supabase_realtime add table shopping_items;
