-- ============================================================================
-- VERIFICATION: Paste and run after all 3 blocks succeed.
-- ============================================================================

select 'academic_terms (current)' as check_name, count(*)::text as result from academic_terms where is_current = true
union all select 'term_courses', count(*)::text from term_courses
union all select 'term_assignment_schedule', count(*)::text from term_assignment_schedule
union all select 'thesis_projects (table exists)', count(*)::text from thesis_projects
union all select 'thesis_milestones (table exists)', count(*)::text from thesis_milestones
union all select 'review_links (table exists)', count(*)::text from review_links
union all select 'submission_evaluations (pre-existing)', count(*)::text from submission_evaluations
union all select 'concepts (pre-existing)', count(*)::text from concepts
union all select 'program_members.current_course_id',
  coalesce(
    (select c.code from program_members pm join courses c on c.id = pm.current_course_id where pm.role = 'owner' limit 1),
    'NULL'
  )
union all select 'term_1_courses',
  coalesce(
    (select string_agg(c.code, ', ' order by c.sequence_position)
     from academic_terms at
     join term_courses tc on tc.term_id = at.id
     join courses c on c.id = tc.course_id
     where at.is_current = true),
    'NONE'
  )
union all select 'theo510_module4_readings',
  (select count(*)::text from readings r
   join modules m on m.id = r.module_id
   join courses c on c.id = m.course_id
   where c.code = 'THEO 510'
     and m.title = 'The Act of Faith and the Obedience of Reason')
union all select 'private_schema_exists',
  case when exists (select 1 from information_schema.schemata where schema_name = 'private')
    then 'YES' else 'NO' end;
