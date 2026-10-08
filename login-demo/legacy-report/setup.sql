-- Run ONCE in a separate Supabase test project, AFTER creating both users.
-- It seeds invented notes, not passwords. No existing table is modified.
begin;
do $$
begin
  if (select count(*) from auth.users where lower(email) in ('alice@test.invalid','bob@test.invalid') and email_confirmed_at is not null) <> 2 then
    raise exception 'Create and confirm alice@test.invalid and bob@test.invalid in Authentication > Users first.';
  end if;
end $$;
create table public.team3_supabase_demo_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null
);
create index team3_demo_notes_owner_idx on public.team3_supabase_demo_notes (user_id);
alter table public.team3_supabase_demo_notes enable row level security;
revoke all on public.team3_supabase_demo_notes from anon, authenticated;
grant select on public.team3_supabase_demo_notes to anon, authenticated;
create policy "Owner reads own notes"
  on public.team3_supabase_demo_notes for select to authenticated
  using ((select auth.uid()) = user_id);
insert into public.team3_supabase_demo_notes (user_id,title,body)
select id, 'Alice''s private note', 'My presentation rehearsal is at 10:00. This is invented teaching data.'
from auth.users where lower(email) = 'alice@test.invalid';
insert into public.team3_supabase_demo_notes (user_id,title,body)
select id, 'Bob''s private note', 'My favourite colour is blue. Alice should not be able to read this invented note.'
from auth.users where lower(email) = 'bob@test.invalid';
create function public.team3_download_private_report()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner uuid := auth.uid();
  report_notes jsonb;
begin
  if owner is null then
    raise insufficient_privilege using message = 'Sign in to download your private report.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', n.id, 'user_id', n.user_id, 'title', n.title, 'body', n.body
  ) order by n.title, n.id), '[]'::jsonb)
  into report_notes
  from public.team3_supabase_demo_notes as n
  where n.user_id = owner;
  return jsonb_build_object('owner_id', owner, 'generated_at', now(), 'notes', report_notes);
end;
$$;
revoke all on function public.team3_download_private_report() from public;
-- anon can enter the function ONLY to receive its explicit authentication denial.
-- No user ID is accepted from the caller; the verified JWT determines auth.uid().
grant execute on function public.team3_download_private_report() to anon, authenticated;
commit;
-- anon may SELECT but has no matching policy, so it sees zero rows.
-- No INSERT/UPDATE/DELETE grants are given to browser users in this read-only lab.
-- A table-name collision causes an error. Do not delete or rerun blindly.
