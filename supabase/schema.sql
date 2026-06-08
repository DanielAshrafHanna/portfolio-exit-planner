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

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_portfolios to authenticated;

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin', 'is_admin', true)
where lower(email) = lower('danielhanna0001@gmail.com');

notify pgrst, 'reload schema';
