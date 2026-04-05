-- Enrollment state patch
-- Adds current_course_id to program_members.
-- Backfills the existing owner row to PHIL 501 (the first foundation course).
-- Idempotent: safe to run multiple times.

-- 1. Add the column if it doesn't exist.
alter table program_members
  add column if not exists current_course_id uuid references courses(id) on delete set null;

-- 2. Backfill: set current_course_id to PHIL 501 for any owner row that has NULL.
update program_members
set current_course_id = (
  select c.id from courses c
  where c.code = 'PHIL 501'
    and c.program_id = program_members.program_id
  limit 1
)
where current_course_id is null
  and role = 'owner';
