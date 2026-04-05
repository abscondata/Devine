-- THEO 510 Densification Patch
-- Adds Module 4: The Act of Faith and the Obedience of Reason
-- Includes 3 readings and 1 assignment
-- Idempotent: guards against duplicate inserts
-- Scoped: THEO 510 only, no destructive operations

-- 1. Insert Module 4 (if not already present)
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

-- 2. Insert 3 readings for Module 4 (if not already present)
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
  module_id,
  created_by,
  title,
  author,
  source_type,
  primary_or_secondary,
  tradition_or_era,
  pages_or_length,
  estimated_hours,
  reference_url_or_citation,
  position
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

-- 3. Insert assignment for Module 4 (if not already present)
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
insert into assignments (
  module_id,
  created_by,
  title,
  instructions,
  assignment_type
)
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

-- 4. Update course syllabus and learning outcomes
update courses
set
  learning_outcomes = 'Explain Catholic doctrine of revelation and faith; distinguish Scripture and Tradition as sources of theology; evaluate patristic witness to the rule of faith; articulate the Magisterium''s role and a disciplined theological method; analyze the act of faith as both reasonable and supernatural in light of Aquinas and magisterial teaching.',
  syllabus = 'Unit 1: Revelation and the act of faith (Dei Verbum, Dei Filius, CCC).' || chr(10) ||
             'Unit 2: Scripture, Tradition, and the rule of faith (Dei Verbum 7-16, Irenaeus).' || chr(10) ||
             'Unit 3: Magisterium and theological method (Dei Verbum 10, Lumen Gentium 25, Donum Veritatis).' || chr(10) ||
             'Unit 4: The act of faith and the obedience of reason (Aquinas II-II q.1-2; Dei Filius ch. 3; CCC 142-175).' || chr(10) ||
             'Assessment: one doctrinal reflection, one exegesis, one magisterial-method analysis, and one synthesis essay grounded in primary texts.'
where code = 'THEO 510';
