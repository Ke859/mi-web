create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  whatsapp text not null,
  visit_date date not null,
  visit_time time not null,
  people integer not null check (people >= 5 and people <= 50),
  comments text,
  total_cop integer not null check (total_cop > 0),
  receipt_path text not null,
  payment_status text not null default 'pending_confirmation'
    check (payment_status in ('pending_confirmation', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

create policy "Anyone can create pending bookings"
on public.bookings for insert to anon
with check (payment_status = 'pending_confirmation');

insert into storage.buckets (id, name, public)
values ('payment-receipts', 'payment-receipts', false);

create policy "Anyone can upload payment receipts"
on storage.objects for insert to anon
with check (bucket_id = 'payment-receipts' and name like 'pending/%');
