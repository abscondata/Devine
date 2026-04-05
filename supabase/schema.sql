-- Devine academic platform schema (v2)
-- Run in Supabase SQL editor or via migration

create extension if not exists "pgcrypto";

-- Programs
create table if not exists programs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table programs add column if not exists owner_id uuid references auth.users(id) on delete cascade;
alter table programs alter column owner_id set default auth.uid();
alter table programs alter column owner_id set not null;

create index if not exists idx_programs_owner_id on programs(owner_id);

-- Program membership (future expansion)
create table if not exists program_members (
  program_id uuid not null references programs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (program_id, user_id)
);

-- Review links (external, read-only access)
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

alter table program_members drop constraint if exists program_members_role_check;
alter table program_members
  add constraint program_members_role_check
  check (role in ('owner', 'admin', 'staff', 'member'));

create index if not exists idx_program_members_user on program_members(user_id);

-- Explicit enrollment state: which course the student is currently studying.
-- NULL means infer from sequence position (backward-compatible).
alter table program_members add column if not exists current_course_id uuid references courses(id) on delete set null;

-- Academic terms: the student's current period of study.
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

-- Term course assignments: which courses are in a given term.
create table if not exists term_courses (
  term_id uuid not null references academic_terms(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (term_id, course_id)
);

-- Academic domains (top-level divisions)
create table if not exists domains (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) default auth.uid(),
  code text,
  title text not null,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

alter table domains add column if not exists created_by uuid references auth.users(id);
alter table domains add column if not exists status text;
alter table domains alter column created_by set default auth.uid();
alter table domains alter column created_by set not null;
alter table domains alter column status set default 'active';
alter table domains alter column status set not null;

alter table domains drop constraint if exists domains_status_check;
alter table domains
  add constraint domains_status_check
  check (status in ('active', 'inactive', 'archived'));

create index if not exists idx_domains_created_by on domains(created_by);

-- Courses
create table if not exists courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  description text,
    code text,
    department_or_domain text,
    credits_or_weight numeric,
    level text,
    sequence_position integer,
    learning_outcomes text,
    syllabus text,
    status text not null default 'active',
  domain_id uuid references domains(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

  alter table courses add column if not exists created_by uuid references auth.users(id);
  alter table courses add column if not exists code text;
  alter table courses add column if not exists department_or_domain text;
  alter table courses add column if not exists sequence_position integer;
alter table courses add column if not exists credits_or_weight numeric;
alter table courses add column if not exists level text;
alter table courses add column if not exists learning_outcomes text;
alter table courses add column if not exists syllabus text;
alter table courses add column if not exists status text;
alter table courses add column if not exists domain_id uuid references domains(id);
alter table courses alter column created_by set default auth.uid();
  alter table courses alter column created_by set not null;
  alter table courses alter column sequence_position set not null;

  alter table courses drop constraint if exists courses_sequence_position_check;
  alter table courses
    add constraint courses_sequence_position_check
      check (sequence_position is null or sequence_position >= 0);
alter table courses alter column status set default 'active';
alter table courses alter column status set not null;

create index if not exists idx_courses_program_id on courses(program_id);
create index if not exists idx_courses_domain_id on courses(domain_id);

update courses set status = 'active' where status is null;

alter table courses drop constraint if exists courses_status_check;
alter table courses
  add constraint courses_status_check
  check (status in ('active', 'inactive', 'draft', 'archived'));

alter table courses drop constraint if exists courses_credits_check;
alter table courses
  add constraint courses_credits_check
  check (credits_or_weight is null or credits_or_weight >= 0);

-- Course prerequisites
create table if not exists course_prerequisites (
  course_id uuid not null references courses(id) on delete cascade,
  prerequisite_course_id uuid not null references courses(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (course_id, prerequisite_course_id)
);

alter table course_prerequisites add column if not exists created_by uuid references auth.users(id);
alter table course_prerequisites alter column created_by set default auth.uid();
alter table course_prerequisites alter column created_by set not null;

alter table course_prerequisites drop constraint if exists course_prerequisites_self_check;
alter table course_prerequisites
  add constraint course_prerequisites_self_check
  check (course_id <> prerequisite_course_id);

create index if not exists idx_course_prerequisites_prereq
  on course_prerequisites(prerequisite_course_id);

-- Requirement blocks
create table if not exists requirement_blocks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  title text not null,
  description text,
  category text,
  minimum_courses_required integer,
  minimum_credits_required numeric,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now()
);

alter table requirement_blocks add column if not exists created_by uuid references auth.users(id);
alter table requirement_blocks add column if not exists position integer;
alter table requirement_blocks alter column created_by set default auth.uid();
alter table requirement_blocks alter column created_by set not null;
alter table requirement_blocks alter column position set default 0;
alter table requirement_blocks alter column position set not null;

alter table requirement_blocks drop constraint if exists requirement_blocks_position_check;
alter table requirement_blocks
  add constraint requirement_blocks_position_check
  check (position >= 0);

alter table requirement_blocks drop constraint if exists requirement_blocks_minimum_check;
alter table requirement_blocks
  add constraint requirement_blocks_minimum_check
  check (
    minimum_courses_required is not null
    or minimum_credits_required is not null
  );

alter table requirement_blocks drop constraint if exists requirement_blocks_courses_check;
alter table requirement_blocks
  add constraint requirement_blocks_courses_check
  check (minimum_courses_required is null or minimum_courses_required >= 0);

alter table requirement_blocks drop constraint if exists requirement_blocks_credits_check;
alter table requirement_blocks
  add constraint requirement_blocks_credits_check
  check (minimum_credits_required is null or minimum_credits_required >= 0);

create unique index if not exists idx_requirement_blocks_program_position
  on requirement_blocks(program_id, position);
create index if not exists idx_requirement_blocks_program_id
  on requirement_blocks(program_id);

-- Course requirement mappings
create table if not exists course_requirement_blocks (
  course_id uuid not null references courses(id) on delete cascade,
  requirement_block_id uuid not null references requirement_blocks(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (course_id, requirement_block_id)
);

alter table course_requirement_blocks add column if not exists created_by uuid references auth.users(id);
alter table course_requirement_blocks alter column created_by set default auth.uid();
alter table course_requirement_blocks alter column created_by set not null;

create index if not exists idx_course_requirement_blocks_block
  on course_requirement_blocks(requirement_block_id);

-- Modules
create table if not exists modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  overview text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table modules add column if not exists created_by uuid references auth.users(id);
alter table modules alter column created_by set default auth.uid();
alter table modules alter column created_by set not null;

alter table modules drop constraint if exists modules_position_check;
alter table modules add constraint modules_position_check check (position >= 0);

create unique index if not exists idx_modules_course_position on modules(course_id, position);
create index if not exists idx_modules_course_id on modules(course_id);

-- Assignments
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  instructions text not null,
  assignment_type text not null default 'general',
  due_at timestamptz,
  created_at timestamptz not null default now()
);

alter table assignments add column if not exists created_by uuid references auth.users(id);
alter table assignments add column if not exists assignment_type text;
alter table assignments alter column created_by set default auth.uid();
alter table assignments alter column created_by set not null;
alter table assignments alter column assignment_type set default 'general';
alter table assignments alter column assignment_type set not null;

alter table assignments drop constraint if exists assignments_type_check;
alter table assignments
  add constraint assignments_type_check
  check (
    assignment_type in (
      'general',
      'essay',
      'analysis',
      'exegesis',
      'translation',
      'problem_set',
      'presentation',
      'other'
    )
  );

create index if not exists idx_assignments_module_id on assignments(module_id);

-- Readings
create table if not exists readings (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules(id) on delete cascade,
  created_by uuid not null references auth.users(id) default auth.uid(),
  title text not null,
  author text,
  source_type text,
  primary_or_secondary text,
  tradition_or_era text,
  pages_or_length text,
  estimated_hours numeric,
  reference_url_or_citation text,
  status text not null default 'not_started',
  notes text,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table readings add column if not exists created_by uuid references auth.users(id);
alter table readings add column if not exists position integer;
alter table readings add column if not exists status text;
alter table readings add column if not exists estimated_hours numeric;
alter table readings alter column created_by set default auth.uid();
alter table readings alter column created_by set not null;
alter table readings alter column status set default 'not_started';
alter table readings alter column status set not null;
alter table readings alter column position set default 0;
alter table readings alter column position set not null;

alter table readings drop constraint if exists readings_position_check;
alter table readings add constraint readings_position_check check (position >= 0);
alter table readings drop constraint if exists readings_hours_check;
alter table readings add constraint readings_hours_check check (estimated_hours is null or estimated_hours >= 0);
alter table readings drop constraint if exists readings_status_check;
alter table readings
  add constraint readings_status_check
  check (status in ('not_started', 'in_progress', 'complete', 'skipped'));

create unique index if not exists idx_readings_module_position on readings(module_id, position);
create index if not exists idx_readings_module_id on readings(module_id);

-- Submissions
create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  version integer not null,
  is_final boolean not null default false,
  created_at timestamptz not null default now(),
  unique (assignment_id, user_id, version)
);

alter table submissions drop constraint if exists submissions_version_check;
alter table submissions add constraint submissions_version_check check (version >= 1);

create index if not exists idx_submissions_assignment_user on submissions(assignment_id, user_id);
create unique index if not exists idx_submissions_final_unique
  on submissions(assignment_id, user_id)
  where is_final;
create unique index if not exists idx_submissions_id_version on submissions(id, version);

-- Critiques
create table if not exists critiques (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  submission_version integer not null,
  model text,
  prompt_version text,
  overall_verdict text,
  thesis_strength text,
  structural_failures text[] not null default '{}',
  unsupported_claims text[] not null default '{}',
  vague_terms text[] not null default '{}',
  strongest_objection text,
  doctrinal_or_historical_imprecision text[] not null default '{}',
  rewrite_priorities text[] not null default '{}',
  score numeric,
  critique_json jsonb not null,
  created_at timestamptz not null default now()
);

alter table critiques add column if not exists submission_version integer;
alter table critiques add column if not exists model text;
alter table critiques add column if not exists prompt_version text;
alter table critiques add column if not exists overall_verdict text;
alter table critiques add column if not exists thesis_strength text;
alter table critiques add column if not exists structural_failures text[] not null default '{}';
alter table critiques add column if not exists unsupported_claims text[] not null default '{}';
alter table critiques add column if not exists vague_terms text[] not null default '{}';
alter table critiques add column if not exists strongest_objection text;
alter table critiques add column if not exists doctrinal_or_historical_imprecision text[] not null default '{}';
alter table critiques add column if not exists rewrite_priorities text[] not null default '{}';
alter table critiques add column if not exists score numeric;
alter table critiques add column if not exists critique_json jsonb;
alter table critiques alter column critique_json set default '{}'::jsonb;

alter table critiques drop column if exists summary;
alter table critiques drop column if exists strengths;
alter table critiques drop column if exists weaknesses;
alter table critiques drop column if exists suggestions;
alter table critiques drop column if exists raw;

update critiques c
set submission_version = s.version
from submissions s
where c.submission_id = s.id
  and c.submission_version is null;

update critiques set critique_json = '{}'::jsonb where critique_json is null;
alter table critiques alter column critique_json set not null;
alter table critiques alter column submission_version set not null;

create index if not exists idx_critiques_submission_id on critiques(submission_id);

alter table critiques drop constraint if exists critiques_submission_version_fkey;
alter table critiques
  add constraint critiques_submission_version_fkey
  foreign key (submission_id, submission_version)
  references submissions(id, version)
  on delete cascade;

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
create unique index if not exists idx_thesis_milestones_project_position
  on thesis_milestones(thesis_project_id, position);
create index if not exists idx_thesis_milestones_project_id
  on thesis_milestones(thesis_project_id);
create index if not exists idx_thesis_milestones_submission_id
  on thesis_milestones(submission_id);

-- Thesis project guardrail: only RSYN 720 and matching program/course
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

-- Submission evaluations (RSYN 720 enforcement)
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

-- Requirement integrity
create or replace function ensure_course_requirement_block_program()
returns trigger as $$
declare
  course_program uuid;
  block_program uuid;
begin
  select program_id into course_program
  from courses
  where id = new.course_id;

  select program_id into block_program
  from requirement_blocks
  where id = new.requirement_block_id;

  if course_program is null or block_program is null then
    raise exception 'Course or requirement block not found.';
  end if;

  if course_program <> block_program then
    raise exception 'Course and requirement block must belong to the same program.';
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function prevent_module_parent_change()
returns trigger as $$
begin
  if new.course_id <> old.course_id then
    raise exception 'Module course_id cannot be changed.';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function prevent_reading_parent_change()
returns trigger as $$
begin
  if new.module_id <> old.module_id then
    raise exception 'Reading module_id cannot be changed.';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function prevent_assignment_parent_change()
returns trigger as $$
begin
  if new.module_id <> old.module_id then
    raise exception 'Assignment module_id cannot be changed.';
  end if;
  return new;
end;
$$ language plpgsql;

create or replace function ensure_course_has_requirement_block()
returns trigger as $$
declare
  block_count integer;
begin
  select count(*)
    into block_count
  from course_requirement_blocks
  where course_id = new.id;

  if block_count = 0 then
    raise exception 'Course must belong to at least one requirement block.';
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function ensure_course_requirement_blocks_present()
returns trigger as $$
declare
  block_count integer;
begin
  if not exists (select 1 from courses where id = old.course_id) then
    return old;
  end if;

  select count(*)
    into block_count
  from course_requirement_blocks
  where course_id = old.course_id;

  if block_count = 0 then
    raise exception 'Course must remain mapped to at least one requirement block.';
  end if;

  return old;
end;
$$ language plpgsql;

create or replace function create_course_with_blocks(
  p_program_id uuid,
  p_title text,
  p_description text,
  p_code text,
  p_department_or_domain text,
  p_credits_or_weight numeric,
  p_level text,
  p_sequence_position integer,
  p_learning_outcomes text,
  p_syllabus text,
  p_status text,
  p_domain_id uuid,
  p_is_active boolean,
  p_requirement_block_ids uuid[]
)
returns uuid as $$
declare
  new_course_id uuid;
  cleaned_blocks uuid[];
begin
  cleaned_blocks := array(select distinct unnest(p_requirement_block_ids));
  if cleaned_blocks is null or array_length(cleaned_blocks, 1) is null then
    raise exception 'Course must be placed in at least one requirement block.';
  end if;

  insert into courses (
    program_id,
    created_by,
    title,
    description,
    code,
    department_or_domain,
    credits_or_weight,
    level,
    sequence_position,
    learning_outcomes,
    syllabus,
    status,
    domain_id,
    is_active
  )
  values (
    p_program_id,
    auth.uid(),
    p_title,
    p_description,
    p_code,
    p_department_or_domain,
    p_credits_or_weight,
    p_level,
    p_sequence_position,
    p_learning_outcomes,
    p_syllabus,
    p_status,
    p_domain_id,
    p_is_active
  )
  returning id into new_course_id;

  insert into course_requirement_blocks (
    course_id,
    requirement_block_id,
    created_by
  )
  select new_course_id, block_id, auth.uid()
  from unnest(cleaned_blocks) as block_id;

  return new_course_id;
end;
$$ language plpgsql;

create or replace function update_course_with_blocks(
  p_course_id uuid,
  p_title text,
  p_description text,
  p_code text,
  p_department_or_domain text,
  p_credits_or_weight numeric,
  p_level text,
  p_sequence_position integer,
  p_learning_outcomes text,
  p_syllabus text,
  p_status text,
  p_domain_id uuid,
  p_is_active boolean,
  p_requirement_block_ids uuid[]
)
returns void as $$
declare
  cleaned_blocks uuid[];
begin
  cleaned_blocks := array(select distinct unnest(p_requirement_block_ids));
  if cleaned_blocks is null or array_length(cleaned_blocks, 1) is null then
    raise exception 'Course must be placed in at least one requirement block.';
  end if;

  update courses
  set title = p_title,
      description = p_description,
      code = p_code,
      department_or_domain = p_department_or_domain,
      credits_or_weight = p_credits_or_weight,
      level = p_level,
      sequence_position = p_sequence_position,
      learning_outcomes = p_learning_outcomes,
      syllabus = p_syllabus,
      status = p_status,
      domain_id = p_domain_id,
      is_active = p_is_active
  where id = p_course_id;

  if not found then
    raise exception 'Course not found.';
  end if;

  delete from course_requirement_blocks
  where course_id = p_course_id
    and requirement_block_id not in (select unnest(cleaned_blocks));

  insert into course_requirement_blocks (
    course_id,
    requirement_block_id,
    created_by
  )
  select p_course_id, block_id, auth.uid()
  from unnest(cleaned_blocks) as block_id
  where not exists (
    select 1
    from course_requirement_blocks crb
    where crb.course_id = p_course_id
      and crb.requirement_block_id = block_id
  );
end;
$$ language plpgsql;

-- Submission version integrity
create or replace function enforce_submission_version()
returns trigger as $$
declare
  max_version integer;
  lock_key bigint;
begin
  lock_key := hashtext(new.assignment_id::text || ':' || new.user_id::text);
  perform pg_advisory_xact_lock(lock_key);

  select coalesce(max(version), 0)
    into max_version
  from submissions
  where assignment_id = new.assignment_id
    and user_id = new.user_id;

  if new.version is null then
    new.version := max_version + 1;
  elsif new.version <> max_version + 1 then
    raise exception 'Invalid submission version %; expected %', new.version, max_version + 1;
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function set_critique_submission_version()
returns trigger as $$
declare
  current_version integer;
begin
  select version into current_version
  from submissions
  where id = new.submission_id;

  if current_version is null then
    raise exception 'Submission not found for critique.';
  end if;

  if new.submission_version is null then
    new.submission_version := current_version;
  elsif new.submission_version <> current_version then
    raise exception 'Critique submission version mismatch.';
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function prevent_submission_identity_change()
returns trigger as $$
begin
  if new.assignment_id <> old.assignment_id
     or new.user_id <> old.user_id
     or new.version <> old.version then
    raise exception 'Submission identity fields are immutable.';
  end if;

  return new;
end;
$$ language plpgsql;

-- Evaluation integrity: enforce denormalized fields and provisional timestamps
create or replace function enforce_submission_evaluation_integrity()
returns trigger as $$
declare
  sub_assignment uuid;
  sub_user uuid;
  sub_version integer;
begin
  select assignment_id, user_id, version
    into sub_assignment, sub_user, sub_version
  from submissions
  where id = new.submission_id;

  if sub_assignment is null then
    raise exception 'Submission not found for evaluation.';
  end if;

  if new.submission_version <> sub_version then
    raise exception 'submission_version does not match submission.';
  end if;

  new.assignment_id := sub_assignment;
  new.user_id := sub_user;
  new.updated_at := now();

  if new.stage_result <> 'provisional' then
    new.provisional_status := 'none';
    new.revision_satisfied_at := null;
  end if;

  if new.stage_result = 'provisional'
     and new.provisional_status = 'revision_satisfied'
     and new.revision_satisfied_at is null then
    new.revision_satisfied_at := now();
  end if;

  return new;
end;
$$ language plpgsql;

-- RSYN 720 stage gate: assumes one assignment per module stage within RSYN 720 only
create or replace function enforce_rsyn720_stage_gating()
returns trigger as $$
declare
  course_code text;
  prior_assignment uuid;
  prior_eval record;
begin
  select c.code into course_code
  from assignments a
  join modules m on m.id = a.module_id
  join courses c on c.id = m.course_id
  where a.id = new.assignment_id;

  if course_code <> 'RSYN 720' then
    return new;
  end if;

  select a2.id into prior_assignment
  from assignments a1
  join modules m1 on m1.id = a1.module_id
  join modules m2 on m2.course_id = m1.course_id
                  and m2.position = m1.position - 1
  join assignments a2 on a2.module_id = m2.id
  where a1.id = new.assignment_id;

  if prior_assignment is null then
    return new;
  end if;

  select se.stage_result, se.provisional_status
    into prior_eval
  from submissions s
  join submission_evaluations se
    on se.submission_id = s.id
   and se.submission_version = s.version
  where s.assignment_id = prior_assignment
    and s.user_id = new.user_id
    and s.is_final = true
  order by se.evaluated_at desc
  limit 1;

  if prior_eval is null then
    raise exception 'Previous RSYN 720 stage not evaluated.';
  end if;

  if prior_eval.stage_result = 'pass' then
    return new;
  end if;

  if prior_eval.stage_result = 'provisional'
     and prior_eval.provisional_status = 'revision_satisfied' then
    return new;
  end if;

  raise exception 'Previous RSYN 720 stage not passed.';
end;
$$ language plpgsql;

drop trigger if exists submissions_version_integrity on submissions;
drop trigger if exists critiques_set_submission_version on critiques;
drop trigger if exists submissions_immutable_fields on submissions;
drop trigger if exists course_requirement_block_program_check on course_requirement_blocks;
drop trigger if exists submission_evaluations_integrity on submission_evaluations;
drop trigger if exists rsyn720_stage_gate_trg on submissions;
drop trigger if exists courses_require_requirement_block on courses;
drop trigger if exists course_requirement_blocks_not_empty on course_requirement_blocks;
drop trigger if exists modules_parent_immutable on modules;
drop trigger if exists readings_parent_immutable on readings;
drop trigger if exists assignments_parent_immutable on assignments;

create trigger submissions_version_integrity
before insert on submissions
for each row execute function enforce_submission_version();

create trigger critiques_set_submission_version
before insert on critiques
for each row execute function set_critique_submission_version();

create trigger submissions_immutable_fields
before update on submissions
for each row execute function prevent_submission_identity_change();

create trigger course_requirement_block_program_check
before insert or update on course_requirement_blocks
for each row execute function ensure_course_requirement_block_program();

create constraint trigger courses_require_requirement_block
after insert or update on courses
deferrable initially deferred
for each row execute function ensure_course_has_requirement_block();

create constraint trigger course_requirement_blocks_not_empty
after delete on course_requirement_blocks
deferrable initially deferred
for each row execute function ensure_course_requirement_blocks_present();

create trigger modules_parent_immutable
before update on modules
for each row execute function prevent_module_parent_change();

create trigger readings_parent_immutable
before update on readings
for each row execute function prevent_reading_parent_change();

create trigger assignments_parent_immutable
before update on assignments
for each row execute function prevent_assignment_parent_change();

create trigger submission_evaluations_integrity
before insert or update on submission_evaluations
for each row execute function enforce_submission_evaluation_integrity();

create trigger rsyn720_stage_gate_trg
before insert on submissions
for each row execute function enforce_rsyn720_stage_gating();

-- RLS
alter table programs enable row level security;
alter table program_members enable row level security;
alter table review_links enable row level security;
alter table domains enable row level security;
alter table courses enable row level security;
alter table course_prerequisites enable row level security;
alter table requirement_blocks enable row level security;
alter table course_requirement_blocks enable row level security;
alter table modules enable row level security;
alter table assignments enable row level security;
alter table readings enable row level security;
alter table submissions enable row level security;
alter table critiques enable row level security;
alter table thesis_projects enable row level security;
alter table thesis_milestones enable row level security;
alter table submission_evaluations enable row level security;
alter table concepts enable row level security;

-- TEMPORARY UNBLOCK (DEVINE ONLY):
-- programs / program_members RLS is disabled to bypass recursive policy errors.
-- TODO: Replace with a non-recursive, security-definer RLS model once smoke tests pass.
alter table programs disable row level security;
alter table program_members disable row level security;

-- Drop existing policies for clean re-apply
Drop policy if exists "Programs are readable by authenticated users" on programs;
Drop policy if exists "Courses are readable by authenticated users" on courses;
Drop policy if exists "Modules are readable by authenticated users" on modules;
Drop policy if exists "Assignments are readable by authenticated users" on assignments;
Drop policy if exists "Users can view their submissions" on submissions;
Drop policy if exists "Users can create their submissions" on submissions;
Drop policy if exists "Users can update their submissions" on submissions;
Drop policy if exists "Users can view critiques for their submissions" on critiques;
Drop policy if exists "Users can create critiques for their submissions" on critiques;

Drop policy if exists "Programs select" on programs;
Drop policy if exists "Programs insert" on programs;
Drop policy if exists "Programs update" on programs;
Drop policy if exists "Programs delete" on programs;
Drop policy if exists "Program members select" on program_members;
Drop policy if exists "Program members insert" on program_members;
Drop policy if exists "Program members update" on program_members;
Drop policy if exists "Program members delete" on program_members;
Drop policy if exists "Review links select" on review_links;
Drop policy if exists "Review links insert" on review_links;
Drop policy if exists "Review links update" on review_links;
Drop policy if exists "Review links delete" on review_links;

-- Hard reset: drop any remaining policies on programs/program_members (prevents recursion from legacy policies)
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
Drop policy if exists "Domains select" on domains;
Drop policy if exists "Domains insert" on domains;
Drop policy if exists "Domains update" on domains;
Drop policy if exists "Domains delete" on domains;
Drop policy if exists "Courses select" on courses;
Drop policy if exists "Courses insert" on courses;
Drop policy if exists "Courses update" on courses;
Drop policy if exists "Courses delete" on courses;
Drop policy if exists "Course prerequisites select" on course_prerequisites;
Drop policy if exists "Course prerequisites insert" on course_prerequisites;
Drop policy if exists "Course prerequisites delete" on course_prerequisites;
Drop policy if exists "Requirement blocks select" on requirement_blocks;
Drop policy if exists "Requirement blocks insert" on requirement_blocks;
Drop policy if exists "Requirement blocks update" on requirement_blocks;
Drop policy if exists "Requirement blocks delete" on requirement_blocks;
Drop policy if exists "Course requirement blocks select" on course_requirement_blocks;
Drop policy if exists "Course requirement blocks insert" on course_requirement_blocks;
Drop policy if exists "Course requirement blocks delete" on course_requirement_blocks;
Drop policy if exists "Modules select" on modules;
Drop policy if exists "Modules insert" on modules;
Drop policy if exists "Modules update" on modules;
Drop policy if exists "Modules delete" on modules;
Drop policy if exists "Assignments select" on assignments;
Drop policy if exists "Assignments insert" on assignments;
Drop policy if exists "Assignments update" on assignments;
Drop policy if exists "Assignments delete" on assignments;
Drop policy if exists "Readings select" on readings;
Drop policy if exists "Readings insert" on readings;
Drop policy if exists "Readings update" on readings;
Drop policy if exists "Readings delete" on readings;
Drop policy if exists "Submissions select" on submissions;
Drop policy if exists "Submissions insert" on submissions;
Drop policy if exists "Submissions update" on submissions;
Drop policy if exists "Critiques select" on critiques;
Drop policy if exists "Critiques insert" on critiques;
Drop policy if exists "Thesis projects select" on thesis_projects;
Drop policy if exists "Thesis projects insert" on thesis_projects;
Drop policy if exists "Thesis projects update" on thesis_projects;
Drop policy if exists "Thesis projects delete" on thesis_projects;
Drop policy if exists "Thesis milestones select" on thesis_milestones;
Drop policy if exists "Thesis milestones insert" on thesis_milestones;
Drop policy if exists "Thesis milestones update" on thesis_milestones;
Drop policy if exists "Thesis milestones delete" on thesis_milestones;
Drop policy if exists "Submission evaluations select" on submission_evaluations;
Drop policy if exists "Submission evaluations insert" on submission_evaluations;
Drop policy if exists "Submission evaluations update" on submission_evaluations;
Drop policy if exists "Submission evaluations delete" on submission_evaluations;
Drop policy if exists "Concepts select" on concepts;
Drop policy if exists "Concepts insert" on concepts;
Drop policy if exists "Concepts update" on concepts;
Drop policy if exists "Concepts delete" on concepts;

-- RLS helper functions (avoid recursive policy evaluation)
create schema if not exists private;
revoke all on schema private from public;

-- Ensure FORCE RLS is disabled so SECURITY DEFINER helpers can bypass policy recursion
alter table programs no force row level security;
alter table program_members no force row level security;

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

-- Programs: owner + members
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

-- Program members
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

-- Domains
create policy "Domains select" on domains
  for select to authenticated
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from courses c
      join programs p on p.id = c.program_id
      where c.domain_id = domains.id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1
      from courses c
      join program_members pm on pm.program_id = c.program_id
      where c.domain_id = domains.id
        and pm.user_id = auth.uid()
    )
  );

create policy "Domains insert" on domains
  for insert to authenticated
  with check (created_by = auth.uid());

create policy "Domains update" on domains
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Domains delete" on domains
  for delete to authenticated
  using (created_by = auth.uid());

-- Courses
create policy "Courses select" on courses
  for select to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = courses.program_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from program_members pm
      where pm.program_id = courses.program_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Courses insert" on courses
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from programs p
        where p.id = courses.program_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from program_members pm
        where pm.program_id = courses.program_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Courses update" on courses
  for update to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = courses.program_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from program_members pm
      where pm.program_id = courses.program_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from programs p
      where p.id = courses.program_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Courses delete" on courses
  for delete to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = courses.program_id
        and p.owner_id = auth.uid()
    )
  );

-- Course prerequisites
create policy "Course prerequisites select" on course_prerequisites
  for select to authenticated
  using (
    exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = course_prerequisites.course_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from courses c
      join program_members pm on pm.program_id = c.program_id
      where c.id = course_prerequisites.course_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Course prerequisites insert" on course_prerequisites
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from courses c
        join programs p on p.id = c.program_id
        where c.id = course_prerequisites.course_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from courses c
        join program_members pm on pm.program_id = c.program_id
        where c.id = course_prerequisites.course_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
    and (
      exists (
        select 1 from courses c
        join programs p on p.id = c.program_id
        where c.id = course_prerequisites.prerequisite_course_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from courses c
        join program_members pm on pm.program_id = c.program_id
        where c.id = course_prerequisites.prerequisite_course_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Course prerequisites delete" on course_prerequisites
  for delete to authenticated
  using (
    exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = course_prerequisites.course_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from courses c
      join program_members pm on pm.program_id = c.program_id
      where c.id = course_prerequisites.course_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  );

-- Requirement blocks
create policy "Requirement blocks select" on requirement_blocks
  for select to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = requirement_blocks.program_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from program_members pm
      where pm.program_id = requirement_blocks.program_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Requirement blocks insert" on requirement_blocks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from programs p
        where p.id = requirement_blocks.program_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from program_members pm
        where pm.program_id = requirement_blocks.program_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Requirement blocks update" on requirement_blocks
  for update to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = requirement_blocks.program_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from program_members pm
      where pm.program_id = requirement_blocks.program_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from programs p
      where p.id = requirement_blocks.program_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Requirement blocks delete" on requirement_blocks
  for delete to authenticated
  using (
    exists (
      select 1 from programs p
      where p.id = requirement_blocks.program_id
        and p.owner_id = auth.uid()
    )
  );

-- Course requirement blocks
create policy "Course requirement blocks select" on course_requirement_blocks
  for select to authenticated
  using (
    exists (
      select 1
      from requirement_blocks rb
      join programs p on p.id = rb.program_id
      where rb.id = course_requirement_blocks.requirement_block_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1
      from requirement_blocks rb
      join program_members pm on pm.program_id = rb.program_id
      where rb.id = course_requirement_blocks.requirement_block_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Course requirement blocks insert" on course_requirement_blocks
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1
        from requirement_blocks rb
        join programs p on p.id = rb.program_id
        where rb.id = course_requirement_blocks.requirement_block_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1
        from requirement_blocks rb
        join program_members pm on pm.program_id = rb.program_id
        where rb.id = course_requirement_blocks.requirement_block_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Course requirement blocks delete" on course_requirement_blocks
  for delete to authenticated
  using (
    exists (
      select 1
      from requirement_blocks rb
      join programs p on p.id = rb.program_id
      where rb.id = course_requirement_blocks.requirement_block_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1
      from requirement_blocks rb
      join program_members pm on pm.program_id = rb.program_id
      where rb.id = course_requirement_blocks.requirement_block_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  );

-- Modules
create policy "Modules select" on modules
  for select to authenticated
  using (
    exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = modules.course_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from courses c
      join program_members pm on pm.program_id = c.program_id
      where c.id = modules.course_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Modules insert" on modules
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from courses c
        join programs p on p.id = c.program_id
        where c.id = modules.course_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from courses c
        join program_members pm on pm.program_id = c.program_id
        where c.id = modules.course_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Modules update" on modules
  for update to authenticated
  using (
    exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = modules.course_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from courses c
      join program_members pm on pm.program_id = c.program_id
      where c.id = modules.course_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = modules.course_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Modules delete" on modules
  for delete to authenticated
  using (
    exists (
      select 1 from courses c
      join programs p on p.id = c.program_id
      where c.id = modules.course_id
        and p.owner_id = auth.uid()
    )
  );

-- Assignments
create policy "Assignments select" on assignments
  for select to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = assignments.module_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join program_members pm on pm.program_id = c.program_id
      where m.id = assignments.module_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Assignments insert" on assignments
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join programs p on p.id = c.program_id
        where m.id = assignments.module_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join program_members pm on pm.program_id = c.program_id
        where m.id = assignments.module_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Assignments update" on assignments
  for update to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = assignments.module_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join program_members pm on pm.program_id = c.program_id
      where m.id = assignments.module_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = assignments.module_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Assignments delete" on assignments
  for delete to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = assignments.module_id
        and p.owner_id = auth.uid()
    )
  );

-- Readings
create policy "Readings select" on readings
  for select to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = readings.module_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join program_members pm on pm.program_id = c.program_id
      where m.id = readings.module_id
        and pm.user_id = auth.uid()
    )
  );

create policy "Readings insert" on readings
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join programs p on p.id = c.program_id
        where m.id = readings.module_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join program_members pm on pm.program_id = c.program_id
        where m.id = readings.module_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Readings update" on readings
  for update to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = readings.module_id
        and p.owner_id = auth.uid()
    )
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join program_members pm on pm.program_id = c.program_id
      where m.id = readings.module_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = readings.module_id
        and p.owner_id = auth.uid()
    )
  );

create policy "Readings delete" on readings
  for delete to authenticated
  using (
    exists (
      select 1 from modules m
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where m.id = readings.module_id
        and p.owner_id = auth.uid()
    )
  );

-- Submissions
create policy "Submissions select" on submissions
  for select to authenticated
  using (auth.uid() = user_id);

create policy "Submissions insert" on submissions
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "Submissions update" on submissions
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Critiques
create policy "Critiques select" on critiques
  for select to authenticated
  using (
    exists (
      select 1 from submissions s
      where s.id = critiques.submission_id
        and s.user_id = auth.uid()
    )
  );

create policy "Critiques insert" on critiques
  for insert to authenticated
  with check (
    exists (
      select 1 from submissions s
      where s.id = critiques.submission_id
        and s.user_id = auth.uid()
    )
  );

-- Thesis projects
create policy "Thesis projects select" on thesis_projects
  for select to authenticated
  using (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
    or private.is_program_member(thesis_projects.program_id, auth.uid())
  );

create policy "Thesis projects insert" on thesis_projects
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      private.is_program_owner(thesis_projects.program_id, auth.uid())
      or exists (
        select 1 from program_members pm
        where pm.program_id = thesis_projects.program_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Thesis projects update" on thesis_projects
  for update to authenticated
  using (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
    or exists (
      select 1 from program_members pm
      where pm.program_id = thesis_projects.program_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'staff')
    )
  )
  with check (
    created_by = auth.uid()
    or private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

create policy "Thesis projects delete" on thesis_projects
  for delete to authenticated
  using (
    private.is_program_owner(thesis_projects.program_id, auth.uid())
  );

-- Thesis milestones
create policy "Thesis milestones select" on thesis_milestones
  for select to authenticated
  using (
    exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and (
          private.is_program_owner(tp.program_id, auth.uid())
          or private.is_program_member(tp.program_id, auth.uid())
        )
    )
  );

create policy "Thesis milestones insert" on thesis_milestones
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and (
          private.is_program_owner(tp.program_id, auth.uid())
          or exists (
            select 1 from program_members pm
            where pm.program_id = tp.program_id
              and pm.user_id = auth.uid()
              and pm.role in ('owner', 'admin', 'staff')
          )
        )
    )
  );

create policy "Thesis milestones update" on thesis_milestones
  for update to authenticated
  using (
    exists (
      select 1 from thesis_projects tp
      where tp.id = thesis_milestones.thesis_project_id
        and (
          private.is_program_owner(tp.program_id, auth.uid())
          or exists (
            select 1 from program_members pm
            where pm.program_id = tp.program_id
              and pm.user_id = auth.uid()
              and pm.role in ('owner', 'admin', 'staff')
          )
        )
    )
  )
  with check (
    created_by = auth.uid()
    or exists (
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

-- Submission evaluations
create policy "Submission evaluations select" on submission_evaluations
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      join modules m on m.id = a.module_id
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      left join program_members pm on pm.program_id = p.id and pm.user_id = auth.uid()
      where s.id = submission_evaluations.submission_id
        and (p.owner_id = auth.uid() or pm.role in ('owner', 'admin', 'staff'))
    )
  );

create policy "Submission evaluations insert" on submission_evaluations
  for insert to authenticated
  with check (
    evaluator_id = auth.uid()
    and exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      join modules m on m.id = a.module_id
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      left join program_members pm on pm.program_id = p.id and pm.user_id = auth.uid()
      where s.id = submission_evaluations.submission_id
        and (p.owner_id = auth.uid() or pm.role in ('owner', 'admin', 'staff'))
    )
  );

create policy "Submission evaluations update" on submission_evaluations
  for update to authenticated
  using (
    evaluator_id = auth.uid()
    and exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      join modules m on m.id = a.module_id
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      left join program_members pm on pm.program_id = p.id and pm.user_id = auth.uid()
      where s.id = submission_evaluations.submission_id
        and (p.owner_id = auth.uid() or pm.role in ('owner', 'admin', 'staff'))
    )
  )
  with check (
    evaluator_id = auth.uid()
    and exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      join modules m on m.id = a.module_id
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      left join program_members pm on pm.program_id = p.id and pm.user_id = auth.uid()
      where s.id = submission_evaluations.submission_id
        and (p.owner_id = auth.uid() or pm.role in ('owner', 'admin', 'staff'))
    )
  );

create policy "Submission evaluations delete" on submission_evaluations
  for delete to authenticated
  using (
    exists (
      select 1
      from submissions s
      join assignments a on a.id = s.assignment_id
      join modules m on m.id = a.module_id
      join courses c on c.id = m.course_id
      join programs p on p.id = c.program_id
      where s.id = submission_evaluations.submission_id
        and p.owner_id = auth.uid()
    )
  );

-- Concepts
create policy "Concepts select" on concepts
  for select to authenticated
  using (
    created_by = auth.uid()
    or (
      related_course_id is not null
      and (
        exists (
          select 1 from courses c
          join programs p on p.id = c.program_id
          where c.id = concepts.related_course_id
            and p.owner_id = auth.uid()
        )
        or exists (
          select 1 from courses c
          join program_members pm on pm.program_id = c.program_id
          where c.id = concepts.related_course_id
            and pm.user_id = auth.uid()
        )
      )
    )
    or (
      related_module_id is not null
      and (
        exists (
          select 1 from modules m
          join courses c on c.id = m.course_id
          join programs p on p.id = c.program_id
          where m.id = concepts.related_module_id
            and p.owner_id = auth.uid()
        )
        or exists (
          select 1 from modules m
          join courses c on c.id = m.course_id
          join program_members pm on pm.program_id = c.program_id
          where m.id = concepts.related_module_id
            and pm.user_id = auth.uid()
        )
      )
    )
  );

create policy "Concepts insert" on concepts
  for insert to authenticated
  with check (
    created_by = auth.uid()
    and (
      related_course_id is null
      or exists (
        select 1 from courses c
        join programs p on p.id = c.program_id
        where c.id = concepts.related_course_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from courses c
        join program_members pm on pm.program_id = c.program_id
        where c.id = concepts.related_course_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
    and (
      related_module_id is null
      or exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join programs p on p.id = c.program_id
        where m.id = concepts.related_module_id
          and p.owner_id = auth.uid()
      )
      or exists (
        select 1 from modules m
        join courses c on c.id = m.course_id
        join program_members pm on pm.program_id = c.program_id
        where m.id = concepts.related_module_id
          and pm.user_id = auth.uid()
          and pm.role in ('owner', 'admin', 'staff')
      )
    )
  );

create policy "Concepts update" on concepts
  for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "Concepts delete" on concepts
  for delete to authenticated
  using (created_by = auth.uid());
