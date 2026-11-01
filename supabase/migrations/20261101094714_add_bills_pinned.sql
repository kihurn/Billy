-- Pinned bills stay at the top of the home page.
alter table public.bills add column pinned boolean not null default false;

drop index if exists public.bills_user_created_idx;
create index bills_user_pinned_created_idx on public.bills (user_id, pinned desc, created_at desc);
