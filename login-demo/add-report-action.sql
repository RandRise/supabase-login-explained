-- Existing demo project: run this once to add the report action.
-- For a fresh project, run setup.sql instead; it already includes this function.
-- No tables, users, notes or policies are deleted or replaced.
begin;
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
-- SQLSTATE 42501 maps to HTTP 401 for an anonymous PostgREST request.
-- SECURITY INVOKER keeps the caller's table grants and RLS in force.
