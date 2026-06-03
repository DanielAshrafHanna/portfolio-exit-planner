create table if not exists public.user_portfolios (
  user_id uuid primary key references auth.users(id) on delete cascade,
  holdings jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_portfolios enable row level security;

drop policy if exists "Users can read own portfolio" on public.user_portfolios;
create policy "Users can read own portfolio"
on public.user_portfolios
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own portfolio" on public.user_portfolios;
create policy "Users can insert own portfolio"
on public.user_portfolios
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own portfolio" on public.user_portfolios;
create policy "Users can update own portfolio"
on public.user_portfolios
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own portfolio" on public.user_portfolios;
create policy "Users can delete own portfolio"
on public.user_portfolios
for delete
to authenticated
using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.user_portfolios to authenticated;
