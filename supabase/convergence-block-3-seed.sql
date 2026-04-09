-- ============================================================================
-- BLOCK 3: SEED DATA
-- Paste into Supabase SQL Editor and run AFTER Block 1 and Block 2.
-- Idempotent. Safe to run multiple times.
-- ============================================================================

-- 3a. Create Term 1 if no terms exist
insert into academic_terms (program_id, title, starts_at, ends_at, is_current)
select
  p.id, 'Term 1', current_date, current_date + interval '16 weeks', true
from programs p
where p.title = 'Devine College Core'
  and not exists (select 1 from academic_terms at where at.program_id = p.id);

-- 3b. Assign PHIL 501 and HIST 520 to current term
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

-- 3c. Backfill current_course_id to PHIL 501 for owner
update program_members
set current_course_id = (
  select c.id from courses c
  where c.code = 'PHIL 501'
    and c.program_id = program_members.program_id
  limit 1
)
where current_course_id is null
  and role = 'owner';

-- 3d. Materialize term assignment schedule
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

-- 3e. Clear canonical due_at on scheduled assignments
update assignments a
set due_at = null
from term_assignment_schedule tas
join (select id as term_id from academic_terms where is_current = true limit 1) ct
  on ct.term_id = tas.term_id
where a.id = tas.assignment_id
  and a.due_at is not null;

-- 3f. THEO 510 Module 4 densification
with actor as (
  select id as user_id from auth.users order by created_at limit 1
),
course as (
  select id from courses where code = 'THEO 510' limit 1
)
insert into modules (course_id, created_by, title, overview, position)
select course.id, actor.user_id,
       'The Act of Faith and the Obedience of Reason',
       'The nature of faith as intellectual assent under grace, the obedience of reason, and the relation of philosophical preparation to theological reception.',
       3
from course cross join actor
where not exists (
  select 1 from modules m
  where m.course_id = course.id
    and m.title = 'The Act of Faith and the Obedience of Reason'
);

-- 3g. THEO 510 Module 4 readings
with actor as (
  select id as user_id from auth.users order by created_at limit 1
),
module_4 as (
  select m.id from modules m
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
    select 1 from readings r where r.module_id = seed.module_id and r.title = seed.title
  );

-- 3h. THEO 510 Module 4 assignment
with actor as (
  select id as user_id from auth.users order by created_at limit 1
),
module_4 as (
  select m.id from modules m
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
from module_4 cross join actor
where module_4.id is not null
  and not exists (
    select 1 from assignments a
    where a.module_id = module_4.id
      and a.title = 'Essay: The Act of Faith and the Obedience of Reason'
  );

-- 3i. Update THEO 510 syllabus and learning outcomes
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
-- BLOCK 3 COMPLETE. Proceed to verification.
-- ============================================================================
