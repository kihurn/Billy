-- Saved bills. Each device signs in anonymously, so every bill belongs to that device's user.
create table public.bills (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '',
  total_cents integer not null default 0,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index bills_user_created_idx on public.bills (user_id, created_at desc);

alter table public.bills enable row level security;

create policy "Users can read their own bills"
  on public.bills for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own bills"
  on public.bills for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own bills"
  on public.bills for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own bills"
  on public.bills for delete to authenticated
  using ((select auth.uid()) = user_id);
