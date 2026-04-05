-- Devine verification: course constitutional placement hardening
-- Safe to run in Supabase SQL editor. Cleans up test data before exit.

create temporary table verify_course_constitution_results (
  seq integer not null,
  scenario text not null,
  ok boolean not null,
  detail text not null
);

do $$
declare
  v_actor uuid;
  v_program uuid;
  v_block uuid;
  v_course uuid;
begin
  select id into v_actor
  from auth.users
  order by created_at
  limit 1;

  if v_actor is null then
    insert into verify_course_constitution_results values
      (1, 'setup: auth user exists', false, 'No auth.users found for verification.');
    return;
  end if;

  perform set_config('request.jwt.claim.sub', v_actor::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_actor)::text, true);

  select id into v_program
  from programs
  where title = 'Devine College Core'
  limit 1;

  if v_program is null then
    insert into verify_course_constitution_results values
      (1, 'setup: program exists', false, 'Program not found for verification.');
    return;
  end if;

  select id into v_block
  from requirement_blocks
  where program_id = v_program
  order by position
  limit 1;

  if v_block is null then
    insert into verify_course_constitution_results values
      (1, 'setup: requirement block exists', false, 'Requirement block not found for verification.');
    return;
  end if;

  -- 1) create_course_with_blocks succeeds
  begin
    v_course := create_course_with_blocks(
      v_program,
      'TEMP VERIFY COURSE',
      'Temporary verification course.',
      'ZZZ 999',
      null,
      null,
      null,
      9999,
      null,
      null,
      'draft',
      null,
      false,
      array[v_block]
    );

    if v_course is null then
      insert into verify_course_constitution_results values
        (2, 'create_course_with_blocks succeeds', false, 'RPC returned null course id.');
    else
      insert into verify_course_constitution_results values
        (2, 'create_course_with_blocks succeeds', true, v_course::text);
    end if;
  exception when others then
    insert into verify_course_constitution_results values
      (2, 'create_course_with_blocks succeeds', false, sqlerrm);
  end;

  -- 1b) mapping exists after create
  if v_course is not null then
    if exists (select 1 from course_requirement_blocks where course_id = v_course) then
      insert into verify_course_constitution_results values
        (3, 'mapping exists after create', true, 'requirement block mapping present');
    else
      insert into verify_course_constitution_results values
        (3, 'mapping exists after create', false, 'missing requirement block mapping');
    end if;
  else
    insert into verify_course_constitution_results values
      (3, 'mapping exists after create', false, 'skipped: no course created');
  end if;

  -- 2) update_course_with_blocks succeeds
  begin
    if v_course is null then
      insert into verify_course_constitution_results values
        (4, 'update_course_with_blocks succeeds', false, 'skipped: no course created');
    else
      perform update_course_with_blocks(
        v_course,
        'TEMP VERIFY COURSE UPDATED',
        'Temporary verification course.',
        'ZZZ 999',
        null,
        null,
        null,
        9999,
        null,
        null,
        'draft',
        null,
        false,
        array[v_block]
      );
      insert into verify_course_constitution_results values
        (4, 'update_course_with_blocks succeeds', true, v_course::text);
    end if;
  exception when others then
    insert into verify_course_constitution_results values
      (4, 'update_course_with_blocks succeeds', false, sqlerrm);
  end;

  -- 3) deleting last mapping is blocked
  begin
    if v_course is null then
      insert into verify_course_constitution_results values
        (5, 'delete last mapping blocked', false, 'skipped: no course created');
    else
      delete from course_requirement_blocks where course_id = v_course;
      execute 'set constraints all immediate';
      insert into verify_course_constitution_results values
        (5, 'delete last mapping blocked', false, 'delete succeeded unexpectedly');
    end if;
  exception when others then
    insert into verify_course_constitution_results values
      (5, 'delete last mapping blocked', true, sqlerrm);
  end;

  -- 4) orphan course insert is blocked
  begin
    insert into courses (
      program_id,
      created_by,
      title,
      sequence_position,
      status,
      is_active
    )
    values (
      v_program,
      v_actor,
      'TEMP ORPHAN',
      10000,
      'draft',
      false
    );
    execute 'set constraints all immediate';
    insert into verify_course_constitution_results values
      (6, 'orphan course insert blocked', false, 'insert succeeded unexpectedly');
  exception when others then
    insert into verify_course_constitution_results values
      (6, 'orphan course insert blocked', true, sqlerrm);
  end;

  -- 5) cleanup
  begin
    if v_course is not null then
      delete from courses where id = v_course;
    end if;
    insert into verify_course_constitution_results values
      (7, 'cleanup', true, 'temporary course removed');
  exception when others then
    insert into verify_course_constitution_results values
      (7, 'cleanup', false, sqlerrm);
  end;
end $$;

select seq, scenario, ok, detail
from verify_course_constitution_results
order by seq;

drop table verify_course_constitution_results;
