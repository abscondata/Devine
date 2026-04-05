import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { reorderModule } from "@/lib/actions";
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
      isFirst: index === 0,
      isLast: index === (modules?.length ?? 0) - 1,
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
      ? "Completed"
      : readinessState.status === "ready"
      ? "Ready now"
      : "Not yet";

  const foundationOrder = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const isFoundationCourse = foundationOrder.includes(course.code ?? "");
  const foundationLabel = course.code
    ? foundationOrder
        .map((code, index) => ({ code, index: index + 1 }))
        .find((item) => item.code === course.code)?.index
    : null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-3">
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            Dashboard
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
            <h1 className="text-3xl font-semibold">{course.title}</h1>
            <p className="text-sm text-[var(--muted)]">
              {course.description ?? "No course description yet."}
            </p>
            {isFoundationCourse ? (
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Foundations Phase
                {foundationLabel ? ` · Step ${foundationLabel} of 4` : ""}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>
              Progress {completedTasks}/{totalTasks || 0}
            </span>
            <span>
              Estimated reading hours {totalHours ? totalHours.toFixed(1) : "0"}
            </span>
            <span>
              Finals {finalAssignments}/{totalAssignments}
            </span>
            {draftAssignments ? <span>Drafts {draftAssignments}</span> : null}
            {finalAssignments ? (
              <span>
                Critiqued {critiquedFinals}/{finalAssignments}
              </span>
            ) : null}
            <Link
              href={`/courses/${course.id}/dossier`}
              className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
            >
              Course dossier
            </Link>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Official Completion</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
            <p>
              Official completion requires all readings marked complete (skipped
              readings do not count) and final submissions for every assignment.
              Critiques are recommended but do not determine completion. RSYN 720
              additionally requires an active thesis project with all required
              milestones complete.
            </p>
            {unreadReadings === 0 &&
            skippedReadings === 0 &&
            missingFinals === 0 &&
            !courseStanding.completion.thesisIncomplete ? (
              <p className="text-sm font-semibold text-[var(--text)]">
                This course is officially complete.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Completion blockers
                </p>
                <ul className="list-disc pl-5 text-[var(--muted)]">
                  {unreadReadings > 0 ? (
                    <li>
                      {unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete
                    </li>
                  ) : null}
                    {skippedReadings > 0 ? (
                      <li>
                        {skippedReadings} reading
                        {skippedReadings === 1 ? "" : "s"} skipped
                        (do not count)
                      </li>
                    ) : null}
                  {missingFinals > 0 ? (
                    <li>
                  {missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission
                </li>
              ) : null}
              {draftAssignments > 0 ? (
                <li>
                  {draftAssignments} assignment{draftAssignments === 1 ? "" : "s"} with draft only
                </li>
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
          <h2 className="text-xl font-semibold">Next Required Action</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            {nextModule ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  Continue module {nextModule.position + 1}: {nextModule.title}
                </p>
                <p>
                  This is the earliest incomplete module in the course sequence.
                </p>
                <Link
                  href={`/modules/${nextModule.id}`}
                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  Go to module
                </Link>
              </>
            ) : (
              <p>All required modules are complete for this course.</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
          <div className="space-y-6">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Course Profile</h2>
                <Link
                  href={`/courses/${course.id}/edit`}
                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  Edit
                </Link>
              </div>
              <div className="grid gap-4 md:grid-cols-2 text-sm text-[var(--muted)]">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Code</p>
                  <p>{course.code ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Status</p>
                  <p>{course.status}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Domain</p>
                  <p>
                    {course.domain
                      ? `${course.domain.code ? `${course.domain.code} — ` : ""}${course.domain.title}`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Department or Domain</p>
                  <p>{course.department_or_domain ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Level</p>
                  <p>{course.level ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em]">Credits or Weight</p>
                  <p>{course.credits_or_weight ?? "—"}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-lg font-semibold">Prerequisites</h2>
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
                <p className="text-sm text-[var(--muted)]">No prerequisites.</p>
              )}
              <div className="text-sm text-[var(--muted)]">
                <span className="font-semibold text-[var(--text)]">Readiness:</span>{" "}
                {readinessStatus}
                {unmetPrereqs.length ? (
                  <span>
                    {" "}
                    · Blocked by{" "}
                    {unmetPrereqs
                      .map((course) =>
                        course.code ? `${course.code} — ${course.title}` : course.title
                      )
                      .join(", ")}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-lg font-semibold">Requirement Blocks</h2>
              {requirementBlocks.length ? (
                <ul className="space-y-2 text-sm text-[var(--muted)]">
                  {requirementBlocks.map((block) => (
                    <li key={block.id} className="flex flex-wrap items-center gap-3">
                      <span>
                        {block.title}
                      </span>
                      {block.category ? (
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {block.category}
                        </span>
                      ) : null}
                      {course.program?.id ? (
                        <Link
                          href={`/programs/${course.program.id}/requirements/${block.id}/edit`}
                          className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                        >
                          Edit
                        </Link>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[var(--muted)]">
                  Not assigned to any requirement blocks.
                </p>
              )}
              {course.program?.id ? (
                <Link
                  href={`/programs/${course.program.id}/audit`}
                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  View program audit
                </Link>
              ) : null}
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-lg font-semibold">Learning Outcomes</h2>
              <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
                {course.learning_outcomes ?? "No learning outcomes recorded."}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-lg font-semibold">Syllabus</h2>
              <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">
                {course.syllabus ?? "No syllabus recorded."}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <h2 className="text-lg font-semibold">Academic Links</h2>
              <div className="flex flex-col gap-2 text-sm">
                <Link href="/domains/new" className="text-[var(--muted)]">
                  Create domain
                </Link>
                <Link href="/concepts/new" className="text-[var(--muted)]">
                  Add concept
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Modules</h2>
            <Link
              href={`/modules/new?courseId=${course.id}`}
              className="text-sm text-[var(--muted)]"
            >
              Add module
            </Link>
          </div>

          {moduleSummaries.length ? (
            <div className="space-y-4">
              {moduleSummaries.map((module) => (
                <div
                  key={module.id}
                  className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Module {module.position + 1}
                    </p>
                    <Link
                      href={`/modules/${module.id}`}
                      className="text-lg font-semibold"
                    >
                      {module.title}
                    </Link>
                    <p className="text-sm text-[var(--muted)]">
                      {module.overview ?? "No overview provided."}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      <span>
                        Progress {module.completedTasks}/{module.totalTasks}
                      </span>
                      <span>
                        Reading hours {module.estimatedHours ? module.estimatedHours.toFixed(1) : "0"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <form action={reorderModule}>
                      <input type="hidden" name="moduleId" value={module.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={module.isFirst}
                        className="rounded-md border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] disabled:opacity-40"
                      >
                        Up
                      </button>
                    </form>
                    <form action={reorderModule}>
                      <input type="hidden" name="moduleId" value={module.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={module.isLast}
                        className="rounded-md border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] disabled:opacity-40"
                      >
                        Down
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No modules added yet for this course.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
