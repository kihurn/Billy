-- Frequent people, so they can be added to a bill with one tap.
create table public.friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index friends_user_name_idx on public.friends (user_id, lower(name));
create index friends_user_used_idx on public.friends (user_id, last_used_at desc);

alter table public.friends enable row level security;

create policy "Users can read their own friends"
  on public.friends for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their own friends"
  on public.friends for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update their own friends"
  on public.friends for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete their own friends"
  on public.friends for delete to authenticated
  using ((select auth.uid()) = user_id);
