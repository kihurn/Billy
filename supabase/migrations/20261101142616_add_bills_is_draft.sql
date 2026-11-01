-- Bills are saved as you go; ones that never reached the split screen are drafts.
alter table public.bills add column is_draft boolean not null default false;
