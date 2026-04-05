-- Devine verification: prevent reparenting for modules/readings/assignments
-- Safe to run in Supabase SQL editor. Cleans up temp objects before exit.

create temporary table verify_structure_immutability_results (
  seq integer not null,
  scenario text not null,
  ok boolean not null,
  detail text not null
);

do $$
declare
  v_actor uuid;
  v_program uuid;
  v_course uuid;
  v_alt_course uuid;
  v_module uuid;
  v_alt_module uuid;
  v_assignment uuid;
  v_reading uuid;
begin
  select id into v_actor
  from auth.users
  order by created_at
  limit 1;

  if v_actor is null then
    insert into verify_structure_immutability_results values
      (1, 'setup: auth user exists', false, 'No auth.users found.');
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor)::text, true);

  select id into v_program
  from programs
  where title = 'Devine College Core'
  limit 1;

  if v_program is null then
    insert into verify_structure_immutability_results values
      (1, 'setup: program exists', false, 'Program not found.');
    return;
  end if;

  select id into v_course
  from courses
  where program_id = v_program
  order by sequence_position
  limit 1;

  select id into v_alt_course
  from courses
  where program_id = v_program
    and id <> v_course
  order by sequence_position
  limit 1;

  if v_course is null or v_alt_course is null then
    insert into verify_structure_immutability_results values
      (1, 'setup: at least two courses', false, 'Need two courses for verification.');
    return;
  end if;

  select id into v_module
  from modules
  where course_id = v_course
  order by position
  limit 1;

  select id into v_alt_module
  from modules
  where course_id = v_alt_course
  order by position
  limit 1;

  if v_module is null or v_alt_module is null then
    insert into verify_structure_immutability_results values
      (1, 'setup: modules exist', false, 'Need modules in two courses.');
    return;
  end if;

  select id into v_assignment
  from assignments
  where module_id = v_module
  limit 1;

  select id into v_reading
  from readings
  where module_id = v_module
  limit 1;

  if v_assignment is null or v_reading is null then
    insert into verify_structure_immutability_results values
      (1, 'setup: assignment and reading exist', false, 'Need at least one assignment and reading.');
    return;
  end if;

  -- 1) module reparent blocked
  begin
    update modules set course_id = v_alt_course where id = v_module;
    insert into verify_structure_immutability_results values
      (2, 'module reparent blocked', false, 'Update succeeded unexpectedly.');
  exception when others then
    insert into verify_structure_immutability_results values
      (2, 'module reparent blocked', true, sqlerrm);
  end;

  -- 2) reading reparent blocked
  begin
    update readings set module_id = v_alt_module where id = v_reading;
    insert into verify_structure_immutability_results values
      (3, 'reading reparent blocked', false, 'Update succeeded unexpectedly.');
  exception when others then
    insert into verify_structure_immutability_results values
      (3, 'reading reparent blocked', true, sqlerrm);
  end;

  -- 3) assignment reparent blocked
  begin
    update assignments set module_id = v_alt_module where id = v_assignment;
    insert into verify_structure_immutability_results values
      (4, 'assignment reparent blocked', false, 'Update succeeded unexpectedly.');
  exception when others then
    insert into verify_structure_immutability_results values
      (4, 'assignment reparent blocked', true, sqlerrm);
  end;
end $$;

select seq, scenario, ok, detail
from verify_structure_immutability_results
order by seq;

drop table verify_structure_immutability_results;
