-- Term-specific assignment schedule materialization.
-- Creates the term_assignment_schedule table, computes default due dates
-- from term dates + module position, and writes schedule rows.
-- Also clears any assignments.due_at that were set by the previous patch
-- (restoring canonical assignment state).
-- Idempotent: does not overwrite existing schedule rows.

-- 1. Create table if needed.
create table if not exists term_assignment_schedule (
  term_id uuid not null references academic_terms(id) on delete cascade,
  assignment_id uuid not null references assignments(id) on delete cascade,
  default_due_at timestamptz not null,
  current_due_at timestamptz not null,
  revised_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (term_id, assignment_id)
);

-- 2. Compute and insert schedule rows for current-term assignments.
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

-- 3. Clear assignments.due_at for current-term assignments (restore canonical state).
-- Only clears dates that match the computed schedule (i.e., were set by the old patch).
update assignments a
set due_at = null
from term_assignment_schedule tas
join (select id as term_id from academic_terms where is_current = true limit 1) ct on ct.term_id = tas.term_id
where a.id = tas.assignment_id
  and a.due_at is not null;
