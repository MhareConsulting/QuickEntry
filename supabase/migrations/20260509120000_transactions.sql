create extension if not exists "pgcrypto";

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  txn_date date not null,
  type text not null check (type in ('in', 'out')),
  category text not null,
  description text not null default '',
  amount_cents bigint not null check (amount_cents > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx
  on public.transactions (user_id, txn_date desc, created_at desc);

create or replace function public.set_transactions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists transactions_set_updated_at on public.transactions;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row
  execute function public.set_transactions_updated_at();

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using ((select auth.uid()) = user_id);
