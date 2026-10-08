-- Run ONCE in a separate test project after creating and confirming Alice and Bob.
-- Additive: the earlier notes/report exercise is preserved.
begin;

do $$
begin
  if (select count(*) from auth.users
      where lower(email) in ('alice@test.invalid', 'bob@test.invalid')
        and email_confirmed_at is not null) <> 2 then
    raise exception 'Create and confirm alice@test.invalid and bob@test.invalid first.';
  end if;
end $$;

create table public.team3_demo_contacts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email in ('alice@test.invalid', 'bob@test.invalid')),
  display_name text not null check (display_name in ('Alice', 'Bob'))
);

insert into public.team3_demo_contacts (user_id, email, display_name)
select id, lower(email), case lower(email) when 'alice@test.invalid' then 'Alice' else 'Bob' end
from auth.users
where lower(email) in ('alice@test.invalid', 'bob@test.invalid');

alter table public.team3_demo_contacts enable row level security;
revoke all on public.team3_demo_contacts from public, anon, authenticated;
grant select on public.team3_demo_contacts to authenticated;

create policy "Signed-in users see invented demo contacts"
on public.team3_demo_contacts for select to authenticated
using (true);

create table public.team3_demo_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.team3_demo_contacts(user_id),
  recipient_id uuid not null references public.team3_demo_contacts(user_id),
  subject text not null check (char_length(btrim(subject)) between 1 and 120),
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index team3_messages_inbox_idx
on public.team3_demo_messages (recipient_id, created_at desc, id);

create index team3_messages_sender_idx
on public.team3_demo_messages (sender_id);

alter table public.team3_demo_messages enable row level security;
revoke all on public.team3_demo_messages from public, anon, authenticated;
grant select on public.team3_demo_messages to authenticated;
grant insert (sender_id, recipient_id, subject, body)
on public.team3_demo_messages to authenticated;

create policy "Recipient reads own inbox"
on public.team3_demo_messages for select to authenticated
using ((select auth.uid()) = recipient_id);

create policy "Sender writes as own identity"
on public.team3_demo_messages for insert to authenticated
with check ((select auth.uid()) = sender_id);

create function public.team3_read_inbox()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reader uuid := auth.uid();
  messages jsonb;
begin
  if reader is null then
    raise insufficient_privilege using message = 'Sign in to read your inbox.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at desc, m.id), '[]'::jsonb)
  into messages
  from (
    select n.id, n.sender_id, n.recipient_id, c.display_name as sender_name,
           c.email as sender_email, n.subject, n.body, n.created_at
    from public.team3_demo_messages n
    join public.team3_demo_contacts c on c.user_id = n.sender_id
    where n.recipient_id = reader
    order by n.created_at desc, n.id
    limit 100
  ) m;

  return jsonb_build_object('owner_id', reader, 'messages', messages);
end;
$$;

create function public.team3_send_message(p_recipient_id uuid, p_subject text, p_body text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  sender uuid := auth.uid();
begin
  if sender is null then
    raise insufficient_privilege using message = 'Sign in to send a note.';
  end if;

  if not exists (select 1 from public.team3_demo_contacts where user_id = sender) then
    raise insufficient_privilege using message = 'Only the two demo accounts can send notes.';
  end if;

  if p_recipient_id is null or p_recipient_id = sender
     or not exists (select 1 from public.team3_demo_contacts where user_id = p_recipient_id) then
    raise invalid_parameter_value using message = 'Choose the other demo account.';
  end if;

  if p_subject is null or char_length(btrim(p_subject)) not between 1 and 120
     or p_body is null or char_length(btrim(p_body)) not between 1 and 4000 then
    raise invalid_parameter_value using message = 'Use a subject (1–120 characters) and a note (1–4000 characters).';
  end if;

  -- No caller-controlled sender, timestamp or id. No SELECT/RETURNING on another inbox.
  insert into public.team3_demo_messages (sender_id, recipient_id, subject, body)
  values (sender, p_recipient_id, btrim(p_subject), btrim(p_body));

  return jsonb_build_object('sent', true, 'sender_id', sender, 'recipient_id', p_recipient_id);
end;
$$;

revoke all on function public.team3_read_inbox() from public;
revoke all on function public.team3_send_message(uuid, text, text) from public;
-- anon can enter only to receive an explicit authentication denial.
grant execute on function public.team3_read_inbox() to anon, authenticated;
grant execute on function public.team3_send_message(uuid, text, text) to anon, authenticated;

commit;
-- Contacts are a directory of two invented accounts, not access to auth.users.
-- Only the recipient can SELECT a message. There is no outbox in this demo.
-- No UPDATE/DELETE grants or policies. Do not rerun or drop tables on a name collision.
