-- ============================================================
-- DARKBAT · Activar RLS y políticas de seguridad
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1) Activar RLS en las tablas
alter table public.bookings enable row level security;
alter table public.wa_contacts enable row level security;

-- 2) Eliminar políticas antiguas (si existen) para evitar conflictos
drop policy if exists "anon_insert_bookings" on public.bookings;
drop policy if exists "anon_select_bookings" on public.bookings;
drop policy if exists "service_full_bookings" on public.bookings;

-- 3) bookings: SIN acceso anónimo. Todas las operaciones (SELECT/INSERT/
--    UPDATE/DELETE) las hacen las Cloudflare Functions con la service role
--    key, que ignora RLS. Cualquier llamada directa desde el navegador
--    con la publishable key será rechazada.

-- 4) wa_contacts: sin acceso público (solo service role / backend)

-- 5) Storage: el público solo puede LEER comprobantes, no subir/borrar
drop policy if exists "public_read_comprobantes" on storage.objects;
create policy "public_read_comprobantes" on storage.objects
  for select to anon
  using (bucket_id = 'comprobantes-db');

-- NOTA: todas las operaciones (SELECT/INSERT/UPDATE/DELETE de reservas,
-- subida/borrado de comprobantes) las hacen las Cloudflare Functions con la
-- service role key, que ignora RLS. Sin esa key, el sitio deja de funcionar
-- a propósito (fail closed).

-- Verificar:
-- select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('bookings','wa_contacts');
