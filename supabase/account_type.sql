-- Add account_type (basic | pro) on the accounts table.
-- Run in the Supabase SQL editor. Safe to re-run.
-- Existing rows with no value become basic. New rows default to basic.
-- Does not overwrite a row that is already pro.

do $$
declare
  candidate text;
  tbl text := null;
  constraint_name text;
begin
  foreach candidate in array array['profiles', 'users']
  loop
    if exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = candidate
    ) then
      tbl := candidate;
      exit;
    end if;
  end loop;

  if tbl is null then
    raise exception 'No public.profiles or public.users table found.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = tbl and column_name = 'account_type'
  ) then
    execute format(
      'alter table public.%I add column account_type text not null default ''basic''',
      tbl
    );
  else
    execute format(
      'alter table public.%I alter column account_type set default ''basic''',
      tbl
    );
    execute format(
      'update public.%I
          set account_type = ''basic''
        where account_type is null
           or btrim(account_type) = ''''',
      tbl
    );
    execute format(
      'alter table public.%I alter column account_type set not null',
      tbl
    );
  end if;

  constraint_name := tbl || '_account_type_check';
  execute format('alter table public.%I drop constraint if exists %I', tbl, constraint_name);
  execute format(
    'alter table public.%I add constraint %I check (account_type in (''basic'', ''pro''))',
    tbl,
    constraint_name
  );

  execute format(
    'comment on column public.%I.account_type is ''Account plan: basic (default) or pro.''',
    tbl
  );
end $$;
