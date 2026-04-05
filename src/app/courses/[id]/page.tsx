import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getModuleStanding,
  getReadinessState,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { ProtectedShell } from "@/components/protected-shell";
import {
  computeTermSchedule,
  formatScheduleDate,
} from "@/lib/term-schedule";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, description, code, department_or_domain, credits_or_weight, level, learning_outcomes, syllabus, status, program:programs(id, title), domain:domains(id, title, code)"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: prerequisites } = await supabase
    .from("course_prerequisites")
    .select("prerequisite:prerequisite_course_id(id, title, code)")
    .eq("course_id", id);

  const prerequisiteCourses = (prerequisites ?? [])
    .map((item) => item.prerequisite)
    .filter(Boolean);

  const { data: requirementMappings } = await supabase
    .from("course_requirement_blocks")
    .select("requirement_block:requirement_block_id(id, title, category)")
    .eq("course_id", id);

  const requirementBlocks = (requirementMappings ?? [])
    .map((item) => item.requirement_block)
    .filter(Boolean);

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, overview, position, course_id")
    .eq("course_id", id)
    .order("position", { ascending: true });

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, status, estimated_hours, position")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("course_id", course.id);

  const thesisProjectIds = thesisProjects?.map((project) => project.id) ?? [];
  const { data: thesisMilestones } = thesisProjectIds.length
    ? await supabase
        .from("thesis_milestones")
        .select(
          "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
        )
        .in("thesis_project_id", thesisProjectIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubmissionIds),
  });

  const readingsByModule = new Map<string, typeof readings>();
  readings?.forEach((reading) => {
    const list = readingsByModule.get(reading.module_id) ?? [];
    list.push(reading);
    readingsByModule.set(reading.module_id, list);
  });

  const assignmentsByModule = new Map<string, typeof assignments>();
  assignments?.forEach((assignment) => {
    const list = assignmentsByModule.get(assignment.module_id) ?? [];
    list.push(assignment);
    assignmentsByModule.set(assignment.module_id, list);
  });

  const moduleToCourse = new Map<string, string>();
  modules?.forEach((module) => {
    moduleToCourse.set(module.id, module.course_id);
  });

  const moduleSummaries = (modules ?? []).map((module, index) => {
    const moduleReadings = readingsByModule.get(module.id) ?? [];
    const moduleAssignments = assignmentsByModule.get(module.id) ?? [];
    const moduleStanding = getModuleStanding({
      readings: moduleReadings,
      assignments: moduleAssignments,
      assignmentStatus,
    });
    const estimatedHours = moduleReadings.reduce(
      (sum, reading) => sum + (reading.estimated_hours ?? 0),
      0
    );

    return {
      ...module,
      totalTasks: moduleStanding.completion.totalTasks,
      completedTasks: moduleStanding.completion.completedTasks,
      estimatedHours,
    };
  });

  const nextModule = moduleSummaries.find(
    (module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks
  );

  const courseStanding = getCourseStanding({
    modules: modules ?? [],
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    thesisSummary:
      course.code === "RSYN 720"
        ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
        : null,
  });
  const totalTasks = courseStanding.completion.totalTasks;
  const completedTasks = courseStanding.completion.completedTasks;
  const totalHours = moduleSummaries.reduce(
    (sum, module) => sum + module.estimatedHours,
    0
  );
  const { unreadReadings, skippedReadings, missingFinals } =
    courseStanding.completion;
  const { totalAssignments, finalAssignments, draftAssignments, critiquedFinals } =
    courseStanding.assignmentSummary;

  const { data: prereqModules } = prerequisiteCourses.length
    ? await supabase
        .from("modules")
        .select("id, course_id")
        .in(
          "course_id",
          prerequisiteCourses.map((course) => course.id)
        )
    : { data: [] };

  const prereqModuleIds = prereqModules?.map((module) => module.id) ?? [];
  const { data: prereqReadings } = prereqModuleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, status")
        .in("module_id", prereqModuleIds)
    : { data: [] };
  const { data: prereqAssignments } = prereqModuleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id")
        .in("module_id", prereqModuleIds)
    : { data: [] };
  const prereqAssignmentIds = prereqAssignments?.map((assignment) => assignment.id) ?? [];
  const { data: prereqFinals } = prereqAssignmentIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_id")
        .eq("user_id", user.id)
        .eq("is_final", true)
        .in("assignment_id", prereqAssignmentIds)
    : { data: [] };

  const prereqFinalSet = new Set(prereqFinals?.map((item) => item.assignment_id));
  const prereqModulesByCourse = new Map<string, { id: string }[]>();
  prereqModules?.forEach((module) => {
    const list = prereqModulesByCourse.get(module.course_id) ?? [];
    list.push(module);
    prereqModulesByCourse.set(module.course_id, list);
  });
  const prereqReadingsByModule = new Map<string, typeof prereqReadings>();
  prereqReadings?.forEach((reading) => {
    const list = prereqReadingsByModule.get(reading.module_id) ?? [];
    list.push(reading);
    prereqReadingsByModule.set(reading.module_id, list);
  });
  const prereqAssignmentsByModule = new Map<string, typeof prereqAssignments>();
  prereqAssignments?.forEach((assignment) => {
    const list = prereqAssignmentsByModule.get(assignment.module_id) ?? [];
    list.push(assignment);
    prereqAssignmentsByModule.set(assignment.module_id, list);
  });

  const prereqCompletion = new Map<string, boolean>();
  prerequisiteCourses.forEach((course) => {
    const courseModules = prereqModulesByCourse.get(course.id) ?? [];
    let totalTasks = 0;
    let completedTasks = 0;
    courseModules.forEach((module) => {
      const moduleReadings = prereqReadingsByModule.get(module.id) ?? [];
      const moduleAssignments = prereqAssignmentsByModule.get(module.id) ?? [];
      const moduleStanding = getModuleStanding({
        readings: moduleReadings,
        assignments: moduleAssignments,
        assignmentStatus: new Map(
          moduleAssignments
            .filter((assignment) => prereqFinalSet.has(assignment.id))
            .map((assignment) => [
              assignment.id,
              { hasFinal: true, hasDraft: false, hasCritique: false },
            ])
        ),
      });
      totalTasks += moduleStanding.completion.totalTasks;
      completedTasks += moduleStanding.completion.completedTasks;
    });
    prereqCompletion.set(
      course.id,
      totalTasks > 0 && completedTasks >= totalTasks
    );
  });

  const unmetPrereqs = prerequisiteCourses.filter(
    (course) => !(prereqCompletion.get(course.id) ?? false)
  );
  const isCourseComplete = courseStanding.completion.isComplete;
  const readinessState = getReadinessState({
    isComplete: isCourseComplete,
    unmetPrereqs,
    hasPrereqs: prerequisiteCourses.length > 0,
  });
  const readinessStatus =
    readinessState.status === "completed"
      ? "Complete"
      : readinessState.status === "ready"
      ? "Prerequisites satisfied"
      : "Prerequisites pending";

  const foundationOrder = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const isFoundationCourse = foundationOrder.includes(course.code ?? "");
  const foundationLabel = course.code
    ? foundationOrder
        .map((code, index) => ({ code, index: index + 1 }))
        .find((item) => item.code === course.code)?.index
    : null;

  // ─── TERM SCHEDULE (if this course is in the current term) ───
  const { data: currentTerm } = course.program?.id
    ? await supabase
        .from("academic_terms")
        .select("id, title, starts_at, ends_at")
        .eq("program_id", course.program.id)
        .eq("is_current", true)
        .maybeSingle()
    : { data: null };

  const schedule = currentTerm?.starts_at && currentTerm?.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at,
        termEndsAt: currentTerm.ends_at,
        courses: [{
          id: course.id,
          modules: (modules ?? []).map((m) => ({ id: m.id, position: m.position })),
        }],
      })
    : null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-3">
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            College Home
          </Link>
          <div className="space-y-2">
            {course.program?.id ? (
              <Link
                href={`/programs/${course.program.id}/audit`}
                className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]"
              >
                {course.program?.title ?? "Program"}
              </Link>
            ) : (
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {course.program?.title ?? "Program"}
              </p>
            )}
            <h1 className="text-3xl">{course.title}</h1>
            <p className="text-sm text-[var(--muted)]">
              {course.description ?? ""}
            </p>
            {isFoundationCourse ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Foundations Phase
                {foundationLabel ? ` · Step ${foundationLabel} of 4` : ""}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{completedTasks} of {totalTasks || 0} requirements fulfilled</span>
            {totalHours ? (
              <span>Estimated reading: {totalHours.toFixed(1)} hours</span>
            ) : null}
            <span>{finalAssignments} of {totalAssignments} final submissions</span>
            <Link
              href={`/courses/${course.id}/dossier`}
              className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
            >
              Course dossier
            </Link>
          </div>
        </header>

        {nextModule ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Current study
            </p>
            <p className="text-sm text-[var(--muted)]">
              <Link
                href={`/modules/${nextModule.id}`}
                className="font-semibold text-[var(--text)]"
              >
                Unit {nextModule.position + 1}: {nextModule.title}
              </Link>
              {" "}— the earliest incomplete unit in this course.
            </p>
          </section>
        ) : isCourseComplete ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text)]">
              This course is officially complete.
            </p>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-xl">Course of Study</h2>

          {moduleSummaries.length ? (
            <div className="space-y-6">
              {moduleSummaries.map((module) => {
                const unitReadings = readingsByModule.get(module.id) ?? [];
                const unitAssignments = assignmentsByModule.get(module.id) ?? [];
                const isComplete = module.completedTasks === module.totalTasks && module.totalTasks > 0;
                const unitSched = schedule?.unitSchedules.get(module.id);

                return (
                  <div key={module.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                    <Link
                      href={`/modules/${module.id}`}
                      className="block p-5 transition hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Unit {module.position + 1}{module.position + 1 === moduleSummaries.length ? " · Final unit" : ""}
                          {unitSched ? ` · ${formatScheduleDate(unitSched.startsAt)} – ${formatScheduleDate(unitSched.endsAt)}` : ""}
                        </p>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {isComplete ? "Complete" : `${module.completedTasks} of ${module.totalTasks} fulfilled`}
                        </p>
                      </div>
                      <h3 className="mt-2 text-lg font-semibold">{module.title}</h3>
                      {module.overview ? (
                        <p className="mt-1 text-sm text-[var(--muted)]">{module.overview}</p>
                      ) : null}
                    </Link>

                    {/* Inline syllabus: readings + written work for this unit */}
                    {(unitReadings.length > 0 || unitAssignments.length > 0) ? (
                      <div className="border-t border-[var(--border)] px-5 py-4 space-y-3">
                        {unitReadings.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                            <ol className="space-y-0.5 text-sm text-[var(--muted)]">
                              {(unitReadings as { id?: string; title?: string | null; position?: number }[])
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((r, i) => (
                                  <li key={r.id ?? i}>{r.title}</li>
                                ))}
                            </ol>
                          </div>
                        ) : null}
                        {unitAssignments.length > 0 ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                            <ol className="space-y-0.5 text-sm text-[var(--muted)]">
                              {(unitAssignments as { id?: string; title?: string | null }[]).map((a, i) => (
                                <li key={a.id ?? i}>{a.title}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No units of study have been established for this course.
            </p>
          )}
        </section>

        {course.syllabus ? (
          <section className="space-y-3">
            <h2 className="text-xl">Syllabus</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.syllabus}</p>
            </div>
          </section>
        ) : null}

        {course.learning_outcomes ? (
          <section className="space-y-3">
            <h2 className="text-xl">Learning Outcomes</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.learning_outcomes}</p>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-xl">Standing</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
            {unreadReadings === 0 &&
            skippedReadings === 0 &&
            missingFinals === 0 &&
            !courseStanding.completion.thesisIncomplete ? (
              <p className="font-semibold text-[var(--text)]">
                All requirements fulfilled. This course is officially complete.
              </p>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{completedTasks} of {totalTasks || 0} requirements fulfilled</span>
                  <span>{finalAssignments} of {totalAssignments} final submissions</span>
                </div>
                <ul className="list-disc pl-5 text-[var(--muted)]">
                  {unreadReadings > 0 ? (
                    <li>{unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete</li>
                  ) : null}
                  {skippedReadings > 0 ? (
                    <li>{skippedReadings} reading{skippedReadings === 1 ? "" : "s"} skipped (do not count)</li>
                  ) : null}
                  {missingFinals > 0 ? (
                    <li>{missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission</li>
                  ) : null}
                  {draftAssignments > 0 ? (
                    <li>{draftAssignments} assignment{draftAssignments === 1 ? "" : "s"} with draft only</li>
                  ) : null}
                  {courseStanding.completion.thesisIncomplete ? (
                    <li>
                      {courseStanding.thesis?.hasProject
                        ? "Thesis milestones remain incomplete."
                        : "No thesis project recorded for RSYN 720."}
                    </li>
                  ) : null}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl">Course Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Prerequisites</h3>
              {prerequisiteCourses.length ? (
                <ul className="space-y-2 text-sm text-[var(--muted)]">
                  {prerequisiteCourses.map((prereq) => (
                    <li key={prereq.id}>
                      {prereq.code ? `${prereq.code} — ` : ""}
                      {prereq.title}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">None. This course may be taken first.</p>
              )}
              {unmetPrereqs.length ? (
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Prerequisites pending: {unmetPrereqs.map((c) => c.code ?? c.title).join(", ")}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Catalog</h3>
              <div className="space-y-1 text-sm text-[var(--muted)]">
                {course.code ? <p>{course.code}</p> : null}
                {course.level ? <p>{course.level}</p> : null}
                {course.credits_or_weight ? <p>{course.credits_or_weight} credits</p> : null}
                {course.domain ? (
                  <p>{course.domain.title}</p>
                ) : course.department_or_domain ? (
                  <p>{course.department_or_domain}</p>
                ) : null}
              </div>
            </div>
          </div>
          {requirementBlocks.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Satisfies</h3>
              <ul className="space-y-1 text-sm text-[var(--muted)]">
                {requirementBlocks.map((block) => (
                  <li key={block.id}>
                    {block.title}
                    {block.category ? ` (${block.category})` : ""}
                  </li>
                ))}
              </ul>
              {course.program?.id ? (
                <Link
                  href={`/programs/${course.program.id}/audit`}
                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  Program audit
                </Link>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href={`/courses/${course.id}/dossier`}>Course dossier</Link>
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
