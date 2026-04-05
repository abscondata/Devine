-- Materialize term schedule into assignment due dates.
-- Computes due dates from term dates + module position and writes them
-- to assignments.due_at where currently null.
-- Only affects assignments in courses assigned to the current term.
-- Idempotent: does not overwrite existing explicit due dates.
-- Can be re-run after term date changes to fill new nulls.

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
module_schedule as (
  select cm.module_id,
         ct.starts_at::timestamp + ((cm.position + 1)::float / cm.total_modules * ct.total_days) * interval '1 day' as unit_end
  from course_modules cm
  cross join current_term ct
)
update assignments a
set due_at = ms.unit_end
from module_schedule ms
where a.module_id = ms.module_id
  and a.due_at is null;
