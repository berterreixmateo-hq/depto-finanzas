-- ============================================================
-- Cierra el agujero del onboarding.
--
-- Antes: `households` era legible por cualquier usuario autenticado
-- (invite_code incluido) y `household_members_insert_self` solo validaba
-- que te insertaras a vos mismo. Encadenado, cualquiera con una cuenta
-- podía listar los hogares, meterse como miembro de uno ajeno y, vía
-- is_household_member(), leer y escribir todos los datos financieros.
-- El código de invitación se validaba únicamente en el cliente, así que
-- un insert directo contra la API se salteaba el chequeo.
--
-- Ahora: crear un hogar y unirse a uno pasan por funciones security
-- definer que validan del lado del servidor. Las políticas permisivas
-- desaparecen; `households` solo es visible para sus miembros.
-- ============================================================

-- ------------------------------------------------------------
-- Alta de hogar
-- ------------------------------------------------------------
create function create_household(p_name text, p_display_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household public.households;
  v_code text;
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_attempts int := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0
     or length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Falta el nombre del hogar o el tuyo';
  end if;

  -- `user_id` es unique en household_members, así que un insert duplicado
  -- fallaría igual; el chequeo explícito da un mensaje entendible.
  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya pertenecés a un hogar';
  end if;

  -- Mismo alfabeto sin caracteres ambiguos que lib/utils/invite-code.ts.
  -- Generar acá y no en el cliente elimina la carrera por códigos repetidos.
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    exit when not exists (select 1 from public.households where invite_code = v_code);

    v_attempts := v_attempts + 1;
    if v_attempts >= 20 then
      raise exception 'No pudimos generar un código de invitación';
    end if;
  end loop;

  insert into public.households (name, invite_code)
  values (trim(p_name), v_code)
  returning * into v_household;

  insert into public.household_members (household_id, user_id, display_name)
  values (v_household.id, auth.uid(), trim(p_display_name));

  return v_household;
end;
$$;

-- ------------------------------------------------------------
-- Ingreso con código
-- ------------------------------------------------------------
create function join_household(p_invite_code text, p_display_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household public.households;
  v_members int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if length(trim(coalesce(p_display_name, ''))) = 0 then
    raise exception 'Falta tu nombre';
  end if;

  if exists (select 1 from public.household_members where user_id = auth.uid()) then
    raise exception 'Ya pertenecés a un hogar';
  end if;

  select * into v_household
  from public.households
  where invite_code = upper(trim(coalesce(p_invite_code, '')));

  if not found then
    raise exception 'Código inválido';
  end if;

  -- El producto es para dos personas. Sin este tope, un código filtrado
  -- deja entrar a cualquier cantidad de gente.
  select count(*) into v_members
  from public.household_members
  where household_id = v_household.id;

  if v_members >= 2 then
    raise exception 'Ese hogar ya está completo';
  end if;

  insert into public.household_members (household_id, user_id, display_name)
  values (v_household.id, auth.uid(), trim(p_display_name));

  return v_household;
end;
$$;

-- Las funciones son el único camino de entrada: nadie anónimo las ejecuta.
revoke execute on function create_household(text, text) from public, anon;
revoke execute on function join_household(text, text) from public, anon;
grant execute on function create_household(text, text) to authenticated;
grant execute on function join_household(text, text) to authenticated;

-- ------------------------------------------------------------
-- Políticas: se cierran las dos que abrían el hogar a cualquiera
-- ------------------------------------------------------------
drop policy "households_select_authenticated" on households;
drop policy "households_insert_authenticated" on households;
drop policy "household_members_insert_self" on household_members;

-- Ya no hace falta ver hogares ajenos: la búsqueda por invite_code vive
-- dentro de join_household, que corre como definer.
create policy "households_select_members" on households
  for select to authenticated using (is_household_member(id));
