-- ============================================================================
-- BLOCK 1: TABLES AND COLUMNS
-- Paste into Supabase SQL Editor and run.
-- Idempotent. Safe to run multiple times.
-- Does NOT touch submission_evaluations or concepts (already exist live).
-- ============================================================================

-- 1a. review_links
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

-- 1b. thesis_projects
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

alter table thesis_projects drop constraint if exists thesis_projects_status_check;
alter table thesis_projects
  add constraint thesis_projects_status_check
  check (
    status in (
      'not_started','question_defined','scope_defined',
      'bibliography_in_progress','candidacy_established',
      'prospectus_complete','draft_submitted','final_submitted','complete'
    )
  );

create unique index if not exists idx_thesis_projects_program_course on thesis_projects(program_id, course_id);
create index if not exists idx_thesis_projects_program_id on thesis_projects(program_id);
create index if not exists idx_thesis_projects_course_id on thesis_projects(course_id);

-- 1c. thesis_milestones
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

alter table thesis_milestones drop constraint if exists thesis_milestones_position_check;
alter table thesis_milestones
  add constraint thesis_milestones_position_check check (position >= 0);

alter table thesis_milestones drop constraint if exists thesis_milestones_key_check;
alter table thesis_milestones
  add constraint thesis_milestones_key_check
  check (
    milestone_key in (
      'question_problem','scope_boundaries','preliminary_bibliography',
      'method_architecture_memo','prospectus','draft_thesis',
      'final_thesis','final_synthesis_reflection'
    )
  );

create unique index if not exists idx_thesis_milestones_project_key on thesis_milestones(thesis_project_id, milestone_key);
create index if not exists idx_thesis_milestones_project_id on thesis_milestones(thesis_project_id);

-- 1d. academic_terms
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

-- 1e. term_courses
create table if not exists term_courses (
  term_id uuid not null references academic_terms(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (term_id, course_id)
);

-- 1f. term_assignment_schedule
create table if not exists term_assignment_schedule (
  term_id uuid not null references academic_terms(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  default_due_at timestamptz not null,
  current_due_at timestamptz not null,
  revised_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (term_id, assignment_id)
);

-- 1g. program_members.current_course_id
alter table program_members
  add column if not exists current_course_id uuid references courses(id) on delete set null;

-- 1h. role constraint (safe re-apply)
alter table program_members drop constraint if exists program_members_role_check;
alter table program_members
  add constraint program_members_role_check
  check (role in ('owner', 'admin', 'staff', 'member'));

create index if not exists idx_program_members_user on program_members(user_id);

-- ============================================================================
-- BLOCK 1 COMPLETE. Proceed to Block 2.
-- ============================================================================
