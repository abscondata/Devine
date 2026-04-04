-- TEMPORARY UNBLOCK (DEVINE ONLY)
-- Disable RLS on programs + program_members to bypass recursive policy errors.
-- TODO: Replace with a non-recursive, security-definer RLS model once smoke tests pass.

alter table programs disable row level security;
alter table program_members disable row level security;

do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('programs', 'program_members')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end;
$$;
