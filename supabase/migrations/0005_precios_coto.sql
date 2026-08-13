-- ============================================================
-- Precios de Coto sobre la lista de súper.
--
-- Un ítem de la lista es texto libre ("leche"). Para saber su precio hay
-- que decidir a qué producto del catálogo corresponde, y eso lo elige una
-- persona: "leche" devuelve más de mil resultados.
--
-- Esa elección se guarda dos veces, a propósito:
--  - en el ítem (`coto_ean`), para mostrar el precio de ese ítem;
--  - en `coto_links`, para que la próxima vez que alguien escriba "leche"
--    el vínculo ya esté resuelto y no haya que elegir de nuevo.
--
-- La idea del vínculo que se aprende con el uso está tomada del
-- auto-linking de orden_querido (guidoboronat).
-- ============================================================

alter table shopping_items add column coto_ean text;

create table coto_links (
  household_id uuid not null references households (id) on delete cascade,
  -- Nombre del ítem normalizado (minúsculas, sin espacios de más). Es la
  -- clave de búsqueda, por eso va en la PK y no el texto original.
  query text not null,
  ean text not null,
  product_name text not null,
  updated_at timestamptz not null default now(),
  primary key (household_id, query)
);

alter table coto_links enable row level security;

create policy "coto_links_all_members" on coto_links
  for all to authenticated
  using (is_household_member(household_id))
  with check (is_household_member(household_id));
