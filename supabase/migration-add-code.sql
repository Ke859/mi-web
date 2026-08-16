-- Migración: código de reserva, precio por persona, actualización y modificación
-- Ejecutar en el SQL Editor de Supabase (una sola vez)

alter table public.bookings
  add column if not exists code text,
  add column if not exists price_per_cop integer,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists source_id uuid;

-- Generar códigos para reservas existentes (DB-XXXXX derivado del id)
update public.bookings
set code = 'DB-' || upper(substr(replace(id::text, '-', ''), 1, 5))
where code is null or code = '';

-- Precio por persona para reservas existentes (15.000)
update public.bookings
set price_per_cop = 15000
where price_per_cop is null;

-- Índice para búsquedas por código
create index if not exists bookings_code_idx on public.bookings (code);
