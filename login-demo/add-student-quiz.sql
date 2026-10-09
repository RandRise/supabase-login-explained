-- Additive student exercise. Run once in the dedicated test project.
-- No existing exercises or security settings are changed.
create table public.team3_quiz_students (
  user_id uuid primary key references auth.users(id),
  display_name text not null
);

insert into public.team3_quiz_students (user_id, display_name)
select id, case email when 'alice@test.invalid' then 'Alice' else 'Bob' end
from auth.users where email in ('alice@test.invalid', 'bob@test.invalid');

alter table public.team3_quiz_students enable row level security;
revoke all on public.team3_quiz_students from anon, authenticated;
grant select on public.team3_quiz_students to authenticated;
create policy quiz_roster_read on public.team3_quiz_students
for select to authenticated using (true);

create table public.team3_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.team3_quiz_students(user_id),
  answers integer[] not null check (
    coalesce(array_ndims(answers) = 1 and array_length(answers, 1) = 3
      and array_lower(answers, 1) = 1 and array_position(answers, null) is null
      and 0 <= all(answers) and 2 >= all(answers), false)
  ),
  score integer generated always as (
    (case when answers[1] = 1 then 1 else 0 end) +
    (case when answers[2] = 2 then 1 else 0 end) +
    (case when answers[3] = 0 then 1 else 0 end)
  ) stored,
  submitted_at timestamptz not null default now()
);

create index quiz_attempts_student_time on public.team3_quiz_attempts
(student_id, submitted_at desc, id);
alter table public.team3_quiz_attempts enable row level security;
revoke all on public.team3_quiz_attempts from anon, authenticated;
grant select on public.team3_quiz_attempts to authenticated;
grant insert (student_id, answers) on public.team3_quiz_attempts to authenticated;
create policy quiz_own_results on public.team3_quiz_attempts
for select to authenticated using (student_id = (select auth.uid()));
create policy quiz_own_submission on public.team3_quiz_attempts
for insert to authenticated with check (student_id = (select auth.uid()));

create function public.team3_get_quiz() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select '{"title":"Login essentials","questions":[
    {"id":1,"text":"Where does this demo save the login session?","options":["In the password field","In this browser’s localStorage","In the page’s CSS"]},
    {"id":2,"text":"What does a valid access token tell the server?","options":["Your original password","Your laptop’s screen size","Which authenticated user the request represents"]},
    {"id":3,"text":"Does decoding a JWT verify its signature?","options":["No. The server must verify it","Yes, readable means trusted","Only if the email matches"]}
  ]}'::jsonb;
$$;

create function public.team3_submit_quiz(p_answers integer[]) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_attempt public.team3_quiz_attempts;
begin
  if auth.uid() is null then
    raise exception 'Sign in to submit your quiz.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team3_quiz_students where user_id = auth.uid()) then
    raise exception 'This account is not enrolled.' using errcode = '42501';
  end if;
  if not coalesce(array_ndims(p_answers) = 1 and array_length(p_answers,1) = 3
    and array_lower(p_answers,1) = 1 and array_position(p_answers,null) is null
    and 0 <= all(p_answers) and 2 >= all(p_answers), false) then
    raise exception 'Submit exactly three answers, each 0, 1 or 2.' using errcode = '22023';
  end if;
  insert into public.team3_quiz_attempts(student_id, answers)
  values (auth.uid(), p_answers) returning * into v_attempt;
  return jsonb_build_object('student_id', v_attempt.student_id, 'attempt_id', v_attempt.id,
    'score', v_attempt.score, 'total', 3, 'submitted_at', v_attempt.submitted_at);
end;
$$;

create function public.team3_get_result(p_student_id uuid default null) returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_latest jsonb; v_count bigint; v_name text;
begin
  if auth.uid() is null then
    raise exception 'Sign in to read your result.' using errcode = '42501';
  end if;
  if p_student_id is not null and p_student_id <> auth.uid() then
    raise exception 'You can only read your own result.' using errcode = '42501';
  end if;
  select display_name into v_name from public.team3_quiz_students where user_id = auth.uid();
  if v_name is null then
    raise exception 'This account is not enrolled.' using errcode = '42501';
  end if;
  select jsonb_build_object('attempt_id', id, 'score', score, 'total', 3, 'submitted_at', submitted_at)
  into v_latest from public.team3_quiz_attempts where student_id = auth.uid()
  order by submitted_at desc, id desc limit 1;
  select count(*) into v_count from public.team3_quiz_attempts where student_id = auth.uid();
  return jsonb_build_object('student_id', auth.uid(), 'student_name', v_name,
    'latest', v_latest, 'attempt_count', v_count);
end;
$$;

revoke all on function public.team3_get_quiz() from public;
revoke all on function public.team3_submit_quiz(integer[]) from public;
revoke all on function public.team3_get_result(uuid) from public;
grant execute on function public.team3_get_quiz() to anon, authenticated;
grant execute on function public.team3_submit_quiz(integer[]) to anon, authenticated;
grant execute on function public.team3_get_result(uuid) to anon, authenticated;
-- Anonymous calls can enter the protected RPCs only to receive an explicit denial.
notify pgrst, 'reload schema';
