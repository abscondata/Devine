-- Academic terms patch
-- Creates the academic_terms and term_courses tables.
-- Seeds an initial current term with PHIL 501 and HIST 520.
-- Idempotent: safe to run multiple times.

-- 1. Create tables if they don't exist.
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

create table if not exists term_courses (
  term_id uuid not null references academic_terms(id) on delete cascade,
  course_id uuid not null references courses(id) on delete cascade,
  primary key (term_id, course_id)
);

-- 2. Seed the initial term if none exists.
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

-- 3. Assign PHIL 501 and HIST 520 to the current term.
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
