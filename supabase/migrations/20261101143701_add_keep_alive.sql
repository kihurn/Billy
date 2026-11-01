-- Tiny function a daily Vercel cron calls, so the free project never pauses for inactivity.
create or replace function public.keep_alive()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

grant execute on function public.keep_alive() to anon, authenticated;
