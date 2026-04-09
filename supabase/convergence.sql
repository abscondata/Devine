-- ============================================================================
-- DEVINE COLLEGE CORE — LIVE DATABASE CONVERGENCE
-- ============================================================================
-- Purpose: Bring the live Supabase database to match the current codebase.
--
-- What this does:
--   1. Creates missing tables (review_links, thesis_projects, thesis_milestones,
--      submission_evaluations, concepts, academic_terms, term_courses,
--      term_assignment_schedule)
--   2. Adds missing columns (program_members.current_course_id)
--   3. Creates missing functions, triggers, indexes
--   4. Applies RLS policies
--   5. Seeds initial academic term, term courses, enrollment state
--   6. Materializes term assignment schedule
--   7. Applies THEO 510 Module 4 densification
--
-- Safety: All statements are idempotent. Safe to run multiple times.
--
-- Run in: Supabase SQL Editor
--   https://supabase.com/dashboard/project/svaszepvxchsrzqwadii/sql
-- ============================================================================

-- ────────────────────────────────────────────────────────────────────────────
-- PART 1: MISSING TABLES
-- ────────────────────────────────────────────────────────────────────────────

-- Review links (external review token system)
create table if not exists review_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  program_id uuid not null references programs(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  last_accessed_at timestamptz,
  note text
);

create index if not exists idx_review_links_program_id on review_links(program_id);
create index if not exists idx_review_links_expires_at on review_links(expires_at);

-- Thesis projects
create table if not exists thesis_projects (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  research_question text not null,
  governing_problem text not null,
  thesis_claim text,
  scope_statement text not null,
  status text not null default 'not_started',
  opened_at timestamptz,
  candidacy_established_at timestamptz,
  prospectus_locked_at timestamptz,
  final_submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table thesis_projects add column if not exists created_by uuid references auth.users(id);
alter table thesis_projects add column if not exists thesis_claim text;
alter table thesis_projects add column if not exists status text;
alter table thesis_projects add column if not exists opened_at timestamptz;
alter table thesis_projects add column if not exists candidacy_established_at timestamptz;
alter table thesis_projects add column if not exists prospectus_locked_at timestamptz;
alter table thesis_projects add column if not exists final_submitted_at timestamptz;
alter table thesis_projects add column if not exists created_at timestamptz;
alter table thesis_projects add column if not exists updated_at timestamptz;
alter table thesis_projects alter column created_by set default auth.uid();
alter table thesis_projects alter column created_by set not null;
alter table thesis_projects alter column status set default 'not_started';
alter table thesis_projects alter column status set not null;
alter table thesis_projects alter column created_at set default now();
alter table thesis_projects alter column created_at set not null;
alter table thesis_projects alter column updated_at set default now();
alter table thesis_projects alter column updated_at set not null;

alter table thesis_projects drop constraint if exists thesis_projects_status_check;
alter table thesis_projects
  add constraint thesis_projects_status_check
  check (
    status in (
      'not_started',
      'question_defined',
      'scope_defined',
      'bibliography_in_progress',
      'candidacy_established',
      'prospectus_complete',
      'draft_submitted',
      'final_submitted',
      'complete'
    )
  );

create unique index if not exists idx_thesis_projects_program_course
  on thesis_projects(program_id, course_id);
create index if not exists idx_thesis_projects_program_id on thesis_projects(program_id);
create index if not exists idx_thesis_projects_course_id on thesis_projects(course_id);

-- Thesis milestones
create table if not exists thesis_milestones (
  id uuid primary key default gen_random_uuid(),
  thesis_project_id uuid not null references thesis_projects(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  milestone_key text not null,
  title text not null,
  position integer not null default 0,
  required boolean not null default true,
  completed_at timestamptz,
  submission_id uuid references submissions(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table thesis_milestones add column if not exists created_by uuid references auth.users(id);
alter table thesis_milestones add column if not exists milestone_key text;
alter table thesis_milestones add column if not exists position integer;
alter table thesis_milestones add column if not exists required boolean;
alter table thesis_milestones add column if not exists completed_at timestamptz;
alter table thesis_milestones add column if not exists submission_id uuid references submissions(id);
alter table thesis_milestones add column if not exists created_at timestamptz;
alter table thesis_milestones alter column created_by set default auth.uid();
alter table thesis_milestones alter column created_by set not null;
alter table thesis_milestones alter column position set default 0;
alter table thesis_milestones alter column position set not null;
alter table thesis_milestones alter column required set default true;
alter table thesis_milestones alter column required set not null;
alter table thesis_milestones alter column created_at set default now();
alter table thesis_milestones alter column created_at set not null;

alter table thesis_milestones drop constraint if exists thesis_milestones_position_check;
alter table thesis_milestones
  add constraint thesis_milestones_position_check
  check (position >= 0);

alter table thesis_milestones drop constraint if exists thesis_milestones_key_check;
alter table thesis_milestones
  add constraint thesis_milestones_key_check
  check (
    milestone_key in (
      'question_problem',
      'scope_boundaries',
      'preliminary_bibliography',
      'method_architecture_memo',
      'prospectus',
      'draft_thesis',
      'final_thesis',
      'final_synthesis_reflection'
    )
  );

create unique index if not exists idx_thesis_milestones_project_key
  on thesis_milestones(thesis_project_id, milestone_key);
create index if not exists idx_thesis_milestones_project_id on thesis_milestones(thesis_project_id);

-- Submission evaluations (RSYN 720 stage gating)
create table if not exists submission_evaluations (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null,
  submission_version integer not null,
  assignment_id uuid not null,
  user_id uuid not null,
  evaluator_id uuid,
  stage_result text not null,
  provisional_status text not null default 'none',
  overall_score numeric,
  rubric_json jsonb not null default '{}'::jsonb,
  fail_override_codes text[] not null default '{}',
  revision_notes text,
  evaluated_at timestamptz not null default now(),
  revision_satisfied_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (submission_id, submission_version),
  constraint submission_evaluations_submission_fk
    foreign key (submission_id, submission_version)
    references submissions(id, version)
    on delete restrict,
  constraint submission_evaluations_assignment_fk
    foreign key (assignment_id)
    references assignments(id)
    on delete restrict,
  constraint submission_evaluations_user_fk
    foreign key (user_id)
    references auth.users(id)
    on delete restrict,
  constraint submission_evaluations_evaluator_fk
    foreign key (evaluator_id)
    references auth.users(id)
    on delete set null,
  constraint submission_evaluations_stage_result_check
    check (stage_result in ('pass', 'provisional', 'resubmit')),
  constraint submission_evaluations_provisional_status_check
    check (provisional_status in ('none', 'pending_revision', 'revision_satisfied')),
  constraint submission_evaluations_score_check
    check (overall_score is null or (overall_score >= 0 and overall_score <= 100)),
  constraint submission_evaluations_fail_codes_check
    check (
      fail_override_codes <@ array[
        'missing_primary_sources',
        'missing_magisterial_sources',
        'missing_required_structure',
        'insufficient_lane_integration',
        'misrepresentation_or_plagiarism',
        'missing_required_objections',
        'defense_failure'
      ]::text[]
    ),
  constraint submission_evaluations_fail_override_gate_check
    check (
      cardinality(fail_override_codes) = 0
      or (
        stage_result = 'resubmit'
        and provisional_status = 'none'
        and revision_satisfied_at is null
      )
    ),
  constraint submission_evaluations_stage_coherence_check
    check (
      (stage_result = 'pass' and provisional_status = 'none' and revision_satisfied_at is null)
      or (stage_result = 'resubmit' and provisional_status = 'none' and revision_satisfied_at is null)
      or (
        stage_result = 'provisional'
        and provisional_status in ('pending_revision', 'revision_satisfied')
        and (
          (provisional_status = 'pending_revision' and revision_satisfied_at is null)
          or (provisional_status = 'revision_satisfied' and revision_satisfied_at is not null)
        )
      )
    )
);

-- Concepts
create table if not exists concepts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  type text not null default 'term',
  description text,
  related_course_id uuid references courses(id) on delete set null,
  related_module_id uuid references modules(id) on delete set null,
  status text not null default 'active',
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table concepts add column if not exists created_by uuid references auth.users(id);
alter table concepts add column if not exists status text;
alter table concepts add column if not exists type text;
alter table concepts alter column created_by set default auth.uid();
alter table concepts alter column created_by set not null;
alter table concepts alter column status set default 'active';
alter table concepts alter column status set not null;
alter table concepts alter column type set default 'term';
alter table concepts alter column type set not null;

alter table concepts drop constraint if exists concepts_type_check;
alter table concepts
  add constraint concepts_type_check
  check (type in ('term', 'thinker', 'council', 'doctrine', 'debate', 'distinction', 'other'));

alter table concepts drop constraint if exists concepts_status_check;
alter table concepts
  add constraint concepts_status_check
  check (status in ('active', 'draft', 'archived'));

create index if not exists idx_concepts_course_id on concepts(related_course_id);
create index if not exists idx_concepts_module_id on concepts(related_module_id);

-- Academic terms
create table if not exists academic_terms (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  title text not null,
  starts_at date,
  ends_at date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_academic_terms_program on academic_terms(program_id);

-- Term courses
create table if not exists term_courses (
  term_id uuid not null references academic_terms(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (term_id, course_id)
);

-- Term assignment schedule
create table if not exists term_assignment_schedule (
  term_id uuid not null references academic_terms(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  default_due_at timestamptz not null,
  current_due_at timestamptz not null,
  revised_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (term_id, assignment_id)
);

-- ────────────────────────────────────────────────────────────────────────────
-- PART 2: MISSING COLUMNS
-- ────────────────────────────────────────────────────────────────────────────

-- Enrollment state
alter table program_members
  add column if not exists current_course_id uuid references courses(id) on delete set null;

-- Role constraint (safe to re-apply)
alter table program_members drop constraint if exists program_members_role_check;
alter table program_members
  add constraint program_members_role_check
  check (role in ('owner', 'admin', 'staff', 'member'));

create index if not exists idx_program_members_user on program_members(user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- PART 3: FUNCTIONS AND TRIGGERS
-- ────────────────────────────────────────────────────────────────────────────

-- Private schema for security-definer helpers
create schema if not exists private;
revoke all on schema private from public;

-- Thesis course guard
create or replace function private.enforce_thesis_course()
returns trigger
language plpgsql
as $$
declare
  v_course_code text;
  v_program_id uuid;
begin
  select code, program_id into v_course_code, v_program_id
  from courses
  where id = new.course_id;

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

-- Thesis project creation + canonical milestones
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
    program_id,
    course_id,
    created_by,
    title,
    research_question,
    governing_problem,
    thesis_claim,
    scope_statement,
    opened_at
  )
  values (
    p_program_id,
    p_course_id,
    auth.uid(),
    p_title,
    p_research_question,
    p_governing_problem,
    nullif(p_thesis_claim, ''),
    p_scope_statement,
    now()
  )
  returning id into v_project_id;

  insert into thesis_milestones (
    thesis_project_id,
    created_by,
    milestone_key,
    title,
    position,
    required
  )
  values
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

-- RLS helper functions
drop function if exists private.is_program_owner(uuid, uuid);
drop function if exists private.is_program_member(uuid, uuid);

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
    where p.id = p_program_id
      and p.owner_id = p_user_id
  );
end;
$$;

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
    where pm.program_id = p_program_id
      and pm.user_id = p_user_id
  );
end;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- PART 4: RLS POLICIES
-- ────────────────────────────────────────────────────────────────────────────

-- Enable RLS on new tables
alter table review_links enable row level security;
alter table thesis_projects enable row level security;
alter table thesis_milestones enable row level security;
alter table submission_evaluations enable row level security;
alter table concepts enable row level security;

-- Disable RLS on programs/program_members (bypass recursive policy errors)
alter table programs disable row level security;
alter table program_members disable row level security;
alter table programs no force row level security;
alter table program_members no force row level security;

-- Drop any stale policies (safe, idempotent)
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

-- Programs policies
Drop policy if exists "Programs select" on programs;
Drop policy if exists "Programs insert" on programs;
Drop policy if exists "Programs update" on programs;
Drop policy if exists "Programs delete" on programs;

create policy "Programs select" on programs
  for select to authenticated
  using (
    owner_id = auth.uid()
    or private.is_program_member(programs.id, auth.uid())
  );

create policy "Programs insert" on programs
  for insert to authenticated
  with check (owner_id = auth.uid());

create policy "Programs update" on programs
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Programs delete" on programs
  for delete to authenticated
  using (owner_id = auth.uid());

-- Program members policies
Drop policy if exists "Program members select" on program_members;
Drop policy if exists "Program members insert" on program_members;
Drop policy if exists "Program members update" on program_members;
Drop policy if exists "Program members delete" on program_members;

create policy "Program members select" on program_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or private.is_program_owner(program_members.program_id, auth.uid())
  );

create policy "Program members insert" on program_members
  for insert to authenticated
  with check (
    private.is_program_owner(program_members.program_id, auth.uid())
  );

create policy "Program members update" on program_members
  for update to authenticated
  using (
    private.is_program_owner(program_members.program_id, auth.uid())
  )
  with check (
    private.is_program_owner(program_members.program_id, auth.uid())
  );

create policy "Program members delete" on program_members
  for delete to authenticated
  using (
    private.is_program_owner(program_members.program_id, auth.uid())
  );

-- Review links: service role only (RLS enabled, no policies = blocked for non-service)
Drop policy if exists "Review links select" on review_links;
Drop policy if exists "Review links insert" on review_links;
Drop policy if exists "Review links update" on review_links;
Drop policy if exists "Review links delete" on review_links;

-- Thesis projects policies
Drop policy if exists "Thesis projects select" on thesis_projects;
Drop policy if exists "Thesis projects insert" on thesis_projects;
Drop policy if exists "Thesis projects update" on thesis_projects;
Drop policy if exists "Thesis projects delete" on thesis_projects;

create policy "Thesis projects select" on thesis_projects
  for select to authenticated
  using (
    created_by = auth.uid()
    or private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

create policy "Thesis projects insert" on thesis_projects
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

create policy "Thesis projects update" on thesis_projects
  for update to authenticated
  using (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
  )
  with check (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

create policy "Thesis projects delete" on thesis_projects
  for delete to authenticated
  using (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

-- Thesis milestones policies
Drop policy if exists "Thesis milestones select" on thesis_milestones;
Drop policy if exists "Thesis milestones insert" on thesis_milestones;
Drop policy if exists "Thesis milestones update" on thesis_milestones;
Drop policy if exists "Thesis milestones delete" on thesis_milestones;

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
  with check (
    created_by = auth.uid()
  );

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

-- ────────────────────────────────────────────────────────────────────────────
-- PART 5: SEED ACADEMIC TERM
-- ────────────────────────────────────────────────────────────────────────────

-- Create Term 1 if no terms exist
insert into academic_terms (program_id, title, starts_at, ends_at, is_current)
select
  p.id,
  'Term 1',
  current_date,
  current_date + interval '16 weeks',
  true
from programs p
where p.title = 'Devine College Core'
  and not exists (
    select 1 from academic_terms at where at.program_id = p.id
  );

-- Assign PHIL 501 and HIST 520 to current term
insert into term_courses (term_id, course_id)
select at.id, c.id
from academic_terms at
join programs p on p.id = at.program_id
join courses c on c.program_id = p.id
where p.title = 'Devine College Core'
  and at.is_current = true
  and c.code in ('PHIL 501', 'HIST 520')
  and not exists (
    select 1 from term_courses tc where tc.term_id = at.id and tc.course_id = c.id
  );

-- ────────────────────────────────────────────────────────────────────────────
-- PART 6: SEED ENROLLMENT STATE
-- ────────────────────────────────────────────────────────────────────────────

-- Backfill current_course_id to PHIL 501 for any owner with NULL
update program_members
set current_course_id = (
  select c.id from courses c
  where c.code = 'PHIL 501'
    and c.program_id = program_members.program_id
  limit 1
)
where current_course_id is null
  and role = 'owner';

-- ────────────────────────────────────────────────────────────────────────────
-- PART 7: MATERIALIZE TERM SCHEDULE
-- ────────────────────────────────────────────────────────────────────────────

with current_term as (
  select at.id as term_id, at.starts_at, at.ends_at,
         extract(epoch from (at.ends_at::timestamp - at.starts_at::timestamp)) / 86400 as total_days
  from academic_terms at
  where at.is_current = true
  limit 1
),
term_course_ids as (
  select tc.course_id
  from term_courses tc
  join current_term ct on ct.term_id = tc.term_id
),
course_modules as (
  select m.id as module_id, m.course_id, m.position,
         count(*) over (partition by m.course_id) as total_modules
  from modules m
  join term_course_ids tci on tci.course_id = m.course_id
),
module_due_dates as (
  select cm.module_id,
         ct.starts_at::timestamp + ((cm.position + 1)::float / cm.total_modules * ct.total_days) * interval '1 day' as computed_due
  from course_modules cm
  cross join current_term ct
)
insert into term_assignment_schedule (term_id, assignment_id, default_due_at, current_due_at)
select ct.term_id, a.id, md.computed_due, md.computed_due
from assignments a
join module_due_dates md on md.module_id = a.module_id
cross join current_term ct
where not exists (
  select 1 from term_assignment_schedule tas
  where tas.term_id = ct.term_id and tas.assignment_id = a.id
);

-- Clear canonical due_at on scheduled assignments
update assignments a
set due_at = null
from term_assignment_schedule tas
join (select id as term_id from academic_terms where is_current = true limit 1) ct on ct.term_id = tas.term_id
where a.id = tas.assignment_id
  and a.due_at is not null;

-- ────────────────────────────────────────────────────────────────────────────
-- PART 8: THEO 510 MODULE 4 DENSIFICATION
-- ────────────────────────────────────────────────────────────────────────────

-- Insert Module 4 (if not already present)
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
course as (
  select id from courses where code = 'THEO 510' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id,
       'The Act of Faith and the Obedience of Reason',
       'The nature of faith as intellectual assent under grace, the obedience of reason, and the relation of philosophical preparation to theological reception.',
       3
from course
cross join actor
where not exists (
  select 1 from modules m
  where m.course_id = course.id
    and m.title = 'The Act of Faith and the Obedience of Reason'
);

-- Insert 3 readings for Module 4
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'The Act of Faith and the Obedience of Reason'
  limit 1
)
insert into readings (
  module_id, created_by, title, author, source_type, primary_or_secondary,
  tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
)
select module_id, actor.user_id, title, author, source_type, primary_or_secondary,
       tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position
from actor
cross join (
  values
    ((select id from module_4), 'Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3', 'Thomas Aquinas', 'Primary text', 'Primary', 'Medieval', 'ST II-II q.1 a.1-5; q.2 a.1-3', 2.5, 'Aquinas, Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3.', 0),
    ((select id from module_4), 'Dei Filius (chapter 3: On Faith)', 'First Vatican Council', 'Magisterial text', 'Primary', 'Modern', 'Chapter 3', 1, 'Dei Filius, Vatican I, ch. 3.', 1),
    ((select id from module_4), 'Catechism of the Catholic Church 142-175', 'Catechism of the Catholic Church', 'Magisterial text', 'Primary', 'Modern', 'CCC 142-175', 1.5, 'Catechism of the Catholic Church, 142-175.', 2)
) as seed(module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position)
where module_id is not null
  and not exists (
    select 1 from readings r
    where r.module_id = seed.module_id and r.title = seed.title
  );

-- Insert assignment for Module 4
with actor as (
  select id as user_id
  from auth.users
  order by created_at
  limit 1
),
module_4 as (
  select m.id
  from modules m
  join courses c on c.id = m.course_id
  where c.code = 'THEO 510'
    and m.title = 'The Act of Faith and the Obedience of Reason'
  limit 1
)
insert into assignments (module_id, created_by, title, instructions, assignment_type)
select module_4.id, actor.user_id,
       'Essay: The Act of Faith and the Obedience of Reason',
       'Write 900-1200 words explaining the Catholic understanding of the act of faith as both reasonable and supernatural. Engage Aquinas (Summa Theologiae II-II, q.1, a.1-5; q.2, a.1-3), Dei Filius ch. 3, and CCC 142-175 with explicit citations. Show how the philosophical foundations established in PHIL 501 prepare for but do not determine the act of faith.',
       'essay'
from module_4
cross join actor
where module_4.id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = module_4.id
      and a.title = 'Essay: The Act of Faith and the Obedience of Reason'
  );

-- Update THEO 510 syllabus and learning outcomes
update courses
set
  learning_outcomes = 'Explain Catholic doctrine of revelation and faith; distinguish Scripture and Tradition as sources of theology; evaluate patristic witness to the rule of faith; articulate the Magisterium''s role and a disciplined theological method; analyze the act of faith as both reasonable and supernatural in light of Aquinas and magisterial teaching.',
  syllabus = 'Unit 1: Revelation and the act of faith (Dei Verbum, Dei Filius, CCC).' || chr(10) ||
             'Unit 2: Scripture, Tradition, and the rule of faith (Dei Verbum 7-16, Irenaeus).' || chr(10) ||
             'Unit 3: Magisterium and theological method (Dei Verbum 10, Lumen Gentium 25, Donum Veritatis).' || chr(10) ||
             'Unit 4: The act of faith and the obedience of reason (Aquinas II-II q.1-2; Dei Filius ch. 3; CCC 142-175).' || chr(10) ||
             'Assessment: one doctrinal reflection, one exegesis, one magisterial-method analysis, and one synthesis essay grounded in primary texts.'
where code = 'THEO 510';

-- ============================================================================
-- CONVERGENCE COMPLETE
-- ============================================================================
-- After running, verify with:
--   select count(*) from academic_terms where is_current = true;    -- should be 1
--   select count(*) from term_courses;                               -- should be 2
--   select count(*) from term_assignment_schedule;                   -- should be > 0
--   select current_course_id from program_members where role = 'owner'; -- should not be null
--   select count(*) from thesis_projects;                            -- 0 (none created yet, but table exists)
--   select count(*) from review_links;                               -- 0 (none created yet, but table exists)
-- ============================================================================
