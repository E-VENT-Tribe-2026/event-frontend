-- App-wide Realtime + RLS (run in the Supabase SQL editor).
-- Safe to re-run. Policies use whichever user-id columns actually exist
-- (this project's friend_requests table does not have sender_id).

do $$
declare
  t text;
begin
  foreach t in array array['friend_requests', 'messages', 'notifications', 'posts', 'events', 'participants']
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      execute format('alter table public.%I enable row level security', t);
      begin
        execute format('alter publication supabase_realtime add table public.%I', t);
      exception
        when duplicate_object then null;
      end;
    end if;
  end loop;
end $$;

-- Resolve the first column on a table that exists from a candidate list.
create or replace function public._evt_first_col(p_table text, p_candidates text[])
returns text
language plpgsql
as $$
declare
  c text;
begin
  foreach c in array p_candidates
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = p_table and column_name = c
    ) then
      return c;
    end if;
  end loop;
  return null;
end;
$$;

-- auth.uid() compared as text so uuid and text id columns both work.
create or replace function public._evt_uid_eq(p_col text)
returns text
language sql
immutable
as $$
  select format('auth.uid()::text = %I::text', p_col);
$$;

do $$
declare
  from_col text;
  to_col text;
  select_pred text;
  insert_pred text;
  cols text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'friend_requests'
  ) then
    return;
  end if;

  -- Actual columns: initiator_id (sender), receiver_id (recipient).
  from_col := public._evt_first_col(
    'friend_requests',
    array['initiator_id', 'from_user_id', 'requester_id', 'requestor_id', 'sender_id', 'from_id', 'user_id']
  );
  to_col := public._evt_first_col(
    'friend_requests',
    array['receiver_id', 'reciever_id', 'to_user_id', 'addressee_id', 'to_id', 'friend_id']
  );

  if from_col is null and to_col is null then
    select string_agg(column_name, ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'friend_requests';
    raise notice 'Skipping friend_requests policies; no user-id column matched. Columns: %', cols;
  else
    select_pred := concat_ws(
      ' or ',
      case when from_col is not null then public._evt_uid_eq(from_col) end,
      case when to_col is not null then public._evt_uid_eq(to_col) end
    );
    insert_pred := public._evt_uid_eq(coalesce(from_col, to_col));

    execute 'drop policy if exists "Users can view their own friend requests" on public.friend_requests';
    execute format(
      'create policy "Users can view their own friend requests" on public.friend_requests for select using (%s)',
      select_pred
    );

    execute 'drop policy if exists "Users can send friend requests" on public.friend_requests';
    execute format(
      'create policy "Users can send friend requests" on public.friend_requests for insert with check (%s)',
      insert_pred
    );

    raise notice 'friend_requests policies use from=% to=%', from_col, to_col;
  end if;
end $$;

do $$
declare
  from_col text;
  to_col text;
  event_col text;
  part_event text;
  part_user text;
  evt_owner text;
  select_pred text;
  insert_pred text;
  cols text;
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'messages'
  ) then
    return;
  end if;

  from_col := public._evt_first_col(
    'messages',
    array['sender_id', 'user_id', 'author_id', 'from_user_id', 'created_by']
  );
  to_col := public._evt_first_col(
    'messages',
    array['recipient_id', 'reciever_id', 'receiver_id', 'to_user_id', 'addressee_id']
  );
  event_col := public._evt_first_col('messages', array['event_id', 'chat_id']);
  part_event := public._evt_first_col('participants', array['event_id', 'chat_id']);
  part_user := public._evt_first_col(
    'participants',
    array['user_id', 'participant_id', 'profile_id', 'auth_user_id']
  );
  evt_owner := public._evt_first_col('events', array['created_by', 'organizer_id', 'owner_id']);

  begin
    execute 'alter table public.messages replica identity full';
  exception
    when others then null;
  end;

  -- Event chats are rooms, not DMs: every participant must SELECT the row
  -- or Realtime never delivers someone else's message.
  select_pred := concat_ws(
    ' or ',
    case when from_col is not null then public._evt_uid_eq(from_col) end,
    case when to_col is not null then public._evt_uid_eq(to_col) end,
    case
      when event_col is not null and part_event is not null and part_user is not null then
        format(
          'exists (select 1 from public.participants p where p.%I::text = public.messages.%I::text and p.%I::text = auth.uid()::text)',
          part_event, event_col, part_user
        )
    end,
    case
      when event_col is not null and evt_owner is not null then
        format(
          'exists (select 1 from public.events e where e.id::text = public.messages.%I::text and e.%I::text = auth.uid()::text)',
          event_col, evt_owner
        )
    end
  );

  if select_pred is null or select_pred = '' then
    select string_agg(column_name, ', ' order by ordinal_position) into cols
    from information_schema.columns
    where table_schema = 'public' and table_name = 'messages';
    raise notice 'Skipping messages policies; no viewer match. Columns: %', cols;
  else
    insert_pred := public._evt_uid_eq(coalesce(from_col, to_col, event_col));

    execute 'drop policy if exists "Users can view their messages" on public.messages';
    execute format(
      'create policy "Users can view their messages" on public.messages for select using (%s)',
      select_pred
    );

    execute 'drop policy if exists "Users can insert messages" on public.messages';
    execute format(
      'create policy "Users can insert messages" on public.messages for insert with check (%s)',
      coalesce(insert_pred, 'auth.role() = ''authenticated''')
    );

    raise notice 'messages policies use from=% to=% event=%', from_col, to_col, event_col;
  end if;
end $$;

drop function if exists public._evt_first_col(text, text[]);
drop function if exists public._evt_uid_eq(text);

-- Homepage live updates: Realtime only delivers rows the JWT can SELECT.
-- Add a SELECT policy only when the table has none, so existing tighter
-- policies are not OR'd with a public read.
do $$
declare
  t text;
begin
  foreach t in array array['events', 'posts', 'participants']
  loop
    if not exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = t
    ) then
      continue;
    end if;

    begin
      execute format('alter table public.%I replica identity full', t);
    exception
      when others then null;
    end;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public' and tablename = t and cmd = 'SELECT'
    ) then
      execute format(
        'create policy "Authenticated can read %I for realtime" on public.%I for select to authenticated using (true)',
        t, t
      );
    end if;
  end loop;
end $$;
