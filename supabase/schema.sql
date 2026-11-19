-- Run this in the Supabase SQL Editor for project tfkmffdzymqckrjgvujr.
-- It creates the five tables the dashboard expects and allows the anon role
-- to read/write them, which is required because the app has no authentication.

create table if not exists public.incubator_batches (
  id uuid primary key default gen_random_uuid(),
  batch_name text not null,
  egg_type text not null check (egg_type in ('chicken', 'duck')),
  total_eggs integer not null check (total_eggs between 1 and 188),
  fertile_eggs integer,
  hatched_chicks integer,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'completed')),
  notes text
);

create table if not exists public.poultry_flocks (
  id uuid primary key default gen_random_uuid(),
  flock_name text not null,
  initial_count integer not null check (initial_count > 0),
  current_count integer not null default 0,
  start_date date not null default current_date,
  status text not null default 'active' check (status in ('active', 'sold_out'))
);

create table if not exists public.flock_logs (
  id uuid primary key default gen_random_uuid(),
  flock_id uuid not null references public.poultry_flocks (id) on delete cascade,
  log_date date not null default current_date,
  mortality_count integer not null default 0 check (mortality_count >= 0),
  vaccine_or_medicine text,
  notes text
);

create table if not exists public.feed_logs (
  id uuid primary key default gen_random_uuid(),
  feed_type text not null,
  action_type text not null check (action_type in ('purchase', 'consume')),
  quantity_kg numeric(10, 2) not null check (quantity_kg > 0),
  cost numeric(12, 2),
  log_date date not null default current_date
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  amount numeric(12, 2) not null check (amount > 0),
  description text,
  transaction_date date not null default current_date
);

create index if not exists incubator_batches_start_date_idx on public.incubator_batches (start_date desc);
create index if not exists poultry_flocks_start_date_idx on public.poultry_flocks (start_date desc);
create index if not exists flock_logs_date_idx on public.flock_logs (log_date desc);
create index if not exists feed_logs_date_idx on public.feed_logs (log_date desc);
create index if not exists transactions_date_idx on public.transactions (transaction_date desc);

alter table public.incubator_batches enable row level security;
alter table public.poultry_flocks enable row level security;
alter table public.flock_logs enable row level security;
alter table public.feed_logs enable row level security;
alter table public.transactions enable row level security;

drop policy if exists "farm_anon_all" on public.incubator_batches;
create policy "farm_anon_all" on public.incubator_batches
  for all to anon using (true) with check (true);

drop policy if exists "farm_anon_all" on public.poultry_flocks;
create policy "farm_anon_all" on public.poultry_flocks
  for all to anon using (true) with check (true);

drop policy if exists "farm_anon_all" on public.flock_logs;
create policy "farm_anon_all" on public.flock_logs
  for all to anon using (true) with check (true);

drop policy if exists "farm_anon_all" on public.feed_logs;
create policy "farm_anon_all" on public.feed_logs
  for all to anon using (true) with check (true);

drop policy if exists "farm_anon_all" on public.transactions;
create policy "farm_anon_all" on public.transactions
  for all to anon using (true) with check (true);

-- PostgREST caches the schema; force a reload after creating tables.
notify pgrst, 'reload schema';
