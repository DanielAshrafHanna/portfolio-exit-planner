create table if not exists public.user_portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  display_name text not null default 'Friend',
  share_holdings boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_portfolios
  add column if not exists display_name text not null default 'Friend',
  add column if not exists share_holdings boolean not null default false;

alter table public.user_portfolios enable row level security;

drop policy if exists "Users can read own portfolio" on public.user_portfolios;
drop policy if exists "Users can read shared portfolios" on public.user_portfolios;
drop policy if exists "Users can read own or shared portfolios" on public.user_portfolios;
create policy "Users can read own or shared portfolios"
on public.user_portfolios
for select
to authenticated
using ((select auth.uid()) = user_id or share_holdings = true);

drop policy if exists "Users can insert own portfolio" on public.user_portfolios;
create policy "Users can insert own portfolio"
on public.user_portfolios
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own portfolio" on public.user_portfolios;
create policy "Users can update own portfolio"
on public.user_portfolios
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete own portfolio" on public.user_portfolios;
create policy "Users can delete own portfolio"
on public.user_portfolios
for delete
to authenticated
using ((select auth.uid()) = user_id);

create table if not exists public.portfolio_daily_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  profile_id text not null,
  currency text not null check (currency in ('USD', 'EGP')),
  daily_profit_loss numeric not null default 0,
  daily_profit_loss_percent numeric not null default 0,
  portfolio_value numeric not null default 0,
  total_profit_loss numeric not null default 0,
  holdings_count integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date, profile_id)
);

alter table public.portfolio_daily_snapshots enable row level security;

drop policy if exists "Users can read own portfolio snapshots" on public.portfolio_daily_snapshots;
create policy "Users can read own portfolio snapshots"
on public.portfolio_daily_snapshots
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert own portfolio snapshots" on public.portfolio_daily_snapshots;
create policy "Users can insert own portfolio snapshots"
on public.portfolio_daily_snapshots
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own portfolio snapshots" on public.portfolio_daily_snapshots;
create policy "Users can update own portfolio snapshots"
on public.portfolio_daily_snapshots
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_portfolios to authenticated;
grant select, insert, update on public.portfolio_daily_snapshots to authenticated;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', true)
where lower(email) = lower('danielhanna0001@gmail.com');

notify pgrst, 'reload schema';
