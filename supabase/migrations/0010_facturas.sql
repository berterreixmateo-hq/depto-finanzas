-- ============================================================
-- Facturas de gastos fijos (lo que faltaba de la Fase 4).
--
-- Bucket privado: una factura de luz trae nombre, dirección y número de
-- cliente. Con el bucket público, cualquiera con la URL la lee — y las URL
-- se filtran (historial, capturas, un mensaje reenviado). Al ser privado, la
-- app genera una URL firmada que vence, y quien no sea miembro del hogar no
-- puede leerla ni adivinando la ruta.
--
-- La ruta es `{household_id}/{instance_id}.{ext}`: el primer segmento es lo
-- que la política usa para decidir, así que la pertenencia se verifica contra
-- el mismo dato que ordena los archivos.
--
-- `recurring_expense_instances.invoice_url` guarda esa ruta, no una URL: una
-- URL firmada vence, guardarla dejaría enlaces muertos en la base.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('facturas', 'facturas', false)
on conflict (id) do nothing;

-- El cast a uuid explota si la carpeta no es un uuid, así que se filtra antes.
-- Sin esto, una ruta inventada daría un error de Postgres en vez de un no.
create or replace function public.factura_es_del_hogar(ruta text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(ruta))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_household_member(((storage.foldername(ruta))[1])::uuid)
    else false
  end;
$$;

revoke execute on function public.factura_es_del_hogar(text) from public, anon;
grant execute on function public.factura_es_del_hogar(text) to authenticated;

create policy "facturas_select_members" on storage.objects
  for select to authenticated
  using (bucket_id = 'facturas' and public.factura_es_del_hogar(name));

create policy "facturas_insert_members" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'facturas' and public.factura_es_del_hogar(name));

create policy "facturas_update_members" on storage.objects
  for update to authenticated
  using (bucket_id = 'facturas' and public.factura_es_del_hogar(name))
  with check (bucket_id = 'facturas' and public.factura_es_del_hogar(name));

create policy "facturas_delete_members" on storage.objects
  for delete to authenticated
  using (bucket_id = 'facturas' and public.factura_es_del_hogar(name));
