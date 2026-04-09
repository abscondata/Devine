-- ============================================================================
-- BLOCK 2: FUNCTIONS, TRIGGERS, RLS
-- Paste into Supabase SQL Editor and run AFTER Block 1.
-- Idempotent. Safe to run multiple times.
-- ============================================================================

-- 2a. Private schema for security-definer helpers
create schema if not exists private;
revoke all on schema private from public;

-- 2b. Thesis course guard trigger function
create or replace function private.enforce_thesis_course()
returns trigger
language plpgsql
as $$
declare
  v_course_code text;
  v_program_id uuid;
begin
  select code, program_id into v_course_code, v_program_id
  from courses where id = new.course_id;
  if v_course_code is null then
    raise exception 'Course not found for thesis project.';
  end if;
  if v_course_code <> 'RSYN 720' then
    raise exception 'Thesis projects are restricted to RSYN 720.';
  end if;
  if v_program_id <> new.program_id then
    raise exception 'Thesis project program/course mismatch.';
  end if;
  return new;
end;
$$;

drop trigger if exists thesis_projects_course_guard on thesis_projects;
create trigger thesis_projects_course_guard
before insert or update on thesis_projects
for each row execute function private.enforce_thesis_course();

-- 2c. Thesis project creation with canonical milestones
create or replace function create_thesis_project_with_milestones(
  p_program_id uuid,
  p_course_id uuid,
  p_title text,
  p_research_question text,
  p_governing_problem text,
  p_thesis_claim text,
  p_scope_statement text
)
returns uuid
language plpgsql
as $$
declare
  v_project_id uuid;
begin
  if not exists (
    select 1 from courses c
    where c.id = p_course_id
      and c.code = 'RSYN 720'
      and c.program_id = p_program_id
  ) then
    raise exception 'Thesis projects are only allowed for RSYN 720 in this program.';
  end if;

  insert into thesis_projects (
    program_id, course_id, created_by, title,
    research_question, governing_problem, thesis_claim,
    scope_statement, opened_at
  ) values (
    p_program_id, p_course_id, auth.uid(), p_title,
    p_research_question, p_governing_problem,
    nullif(p_thesis_claim, ''), p_scope_statement, now()
  )
  returning id into v_project_id;

  insert into thesis_milestones (
    thesis_project_id, created_by, milestone_key, title, position, required
  ) values
    (v_project_id, auth.uid(), 'question_problem', 'Question and Problem Statement', 0, true),
    (v_project_id, auth.uid(), 'scope_boundaries', 'Scope and Boundaries', 1, true),
    (v_project_id, auth.uid(), 'preliminary_bibliography', 'Preliminary Bibliography', 2, true),
    (v_project_id, auth.uid(), 'method_architecture_memo', 'Method / Architecture Memo', 3, true),
    (v_project_id, auth.uid(), 'prospectus', 'Prospectus', 4, true),
    (v_project_id, auth.uid(), 'draft_thesis', 'Draft Thesis', 5, true),
    (v_project_id, auth.uid(), 'final_thesis', 'Final Thesis', 6, true),
    (v_project_id, auth.uid(), 'final_synthesis_reflection', 'Final Synthesis Reflection', 7, true);

  return v_project_id;
end;
$$;

-- 2d. RLS helper functions (security definer, bypass recursion)
drop function if exists private.is_program_owner(uuid, uuid);
create or replace function private.is_program_owner(p_program_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1 from programs p
    where p.id = p_program_id and p.owner_id = p_user_id
  );
end;
$$;

drop function if exists private.is_program_member(uuid, uuid);
create or replace function private.is_program_member(p_program_id uuid, p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  return exists (
    select 1 from program_members pm
    where pm.program_id = p_program_id and pm.user_id = p_user_id
  );
end;
$$;

-- 2e. RLS on new tables
alter table review_links enable row level security;
alter table thesis_projects enable row level security;
alter table thesis_milestones enable row level security;

-- 2f. Disable RLS on programs/program_members (bypass recursive policy errors)
alter table programs disable row level security;
alter table program_members disable row level security;
alter table programs no force row level security;
alter table program_members no force row level security;

-- 2g. Clear stale policies on programs/program_members
do $$
declare r record;
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

-- 2h. Programs policies
drop policy if exists "Programs select" on programs;
drop policy if exists "Programs insert" on programs;
drop policy if exists "Programs update" on programs;
drop policy if exists "Programs delete" on programs;

create policy "Programs select" on programs
  for select to authenticated
  using (owner_id = auth.uid() or private.is_program_member(programs.id, auth.uid()));
create policy "Programs insert" on programs
  for insert to authenticated
  with check (owner_id = auth.uid());
create policy "Programs update" on programs
  for update to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "Programs delete" on programs
  for delete to authenticated
  using (owner_id = auth.uid());

-- 2i. Program members policies
drop policy if exists "Program members select" on program_members;
drop policy if exists "Program members insert" on program_members;
drop policy if exists "Program members update" on program_members;
drop policy if exists "Program members delete" on program_members;

create policy "Program members select" on program_members
  for select to authenticated
  using (user_id = auth.uid() or private.is_program_owner(program_members.program_id, auth.uid()));
create policy "Program members insert" on program_members
  for insert to authenticated
  with check (private.is_program_owner(program_members.program_id, auth.uid()));
create policy "Program members update" on program_members
  for update to authenticated
  using (private.is_program_owner(program_members.program_id, auth.uid()))
  with check (private.is_program_owner(program_members.program_id, auth.uid()));
create policy "Program members delete" on program_members
  for delete to authenticated
  using (private.is_program_owner(program_members.program_id, auth.uid()));

-- 2j. Review links: RLS enabled, no policies = service-role only
drop policy if exists "Review links select" on review_links;
drop policy if exists "Review links insert" on review_links;
drop policy if exists "Review links update" on review_links;
drop policy if exists "Review links delete" on review_links;

-- 2k. Thesis projects policies
drop policy if exists "Thesis projects select" on thesis_projects;
drop policy if exists "Thesis projects insert" on thesis_projects;
drop policy if exists "Thesis projects update" on thesis_projects;
drop policy if exists "Thesis projects delete" on thesis_projects;

create policy "Thesis projects select" on thesis_projects
  for select to authenticated
  using (created_by = auth.uid() or private.is_program_owner(thesis_projects.program_id, auth.uid()));
create policy "Thesis projects insert" on thesis_projects
  for insert to authenticated
  with check (created_by = auth.uid() and private.is_program_owner(thesis_projects.program_id, auth.uid()));
create policy "Thesis projects update" on thesis_projects
  for update to authenticated
  using (private.is_program_owner(thesis_projects.program_id, auth.uid()))
  with check (private.is_program_owner(thesis_projects.program_id, auth.uid()));
create policy "Thesis projects delete" on thesis_projects
  for delete to authenticated
  using (private.is_program_owner(thesis_projects.program_id, auth.uid()));

-- 2l. Thesis milestones policies
drop policy if exists "Thesis milestones select" on thesis_milestones;
drop policy if exists "Thesis milestones insert" on thesis_milestones;
drop policy if exists "Thesis milestones update" on thesis_milestones;
drop policy if exists "Thesis milestones delete" on thesis_milestones;

create policy "Thesis milestones select" on thesis_milestones
  for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and private.is_program_owner(tp.program_id, auth.uid())
    )
  );
create policy "Thesis milestones insert" on thesis_milestones
  for insert to authenticated
  with check (created_by = auth.uid());
create policy "Thesis milestones update" on thesis_milestones
  for update to authenticated
  using (
    exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and private.is_program_owner(tp.program_id, auth.uid())
    )
  );
create policy "Thesis milestones delete" on thesis_milestones
  for delete to authenticated
  using (
    exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and private.is_program_owner(tp.program_id, auth.uid())
    )
  );

-- ============================================================================
-- BLOCK 2 COMPLETE. Proceed to Block 3.
-- ============================================================================
