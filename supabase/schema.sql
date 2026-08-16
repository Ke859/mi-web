create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  email text not null,
  whatsapp text not null,
  visit_date date not null,
  visit_time time not null,
  people integer not null check (people >= 5 and people <= 50),
  lunch text not null default 'no'
    check (lunch in ('yes', 'no')),
  comments text,
  total_cop integer not null check (total_cop > 0),
  price_per_cop integer,
  deposit_rate numeric not null default 0.10,
  deposit_cop integer not null default 0,
  receipt_path text not null,
  payment_status text not null default 'pending_confirmation'
    check (payment_status in ('pending_confirmation', 'approved', 'rejected', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'draft', 'awaiting_confirm')),
  created_at timestamptz not null default now(),
  updated_at timestamptz default now(),
  source_id uuid
);

alter table public.bookings enable row level security;

create policy "Anyone can create pending bookings"
on public.bookings for insert to anon
with check (payment_status = 'pending_confirmation');

create policy "Anyone can read bookings for verification"
on public.bookings for select to anon
using (true);

create policy "Anyone can update booking status"
on public.bookings for update to anon
using (true)
with check (true);

create policy "Anyone can delete bookings"
on public.bookings for delete to anon
using (true);

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false);

create policy "Anyone can upload payment receipts"
on storage.objects for insert to anon
with check (bucket_id = 'payment-receipts' and name like 'pending/%');
