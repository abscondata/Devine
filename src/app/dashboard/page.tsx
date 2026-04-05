import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getFinalAssignmentSet,
  getModuleStanding,
  getProgramRequirementSummary,
  getStandingLabel,
  getTranscriptLiteSummary,
  buildReadinessByCourse,
  selectRecommendedNextCourse,
  getCurrentWorkSelection,
  summarizeRequirementBlocks,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, code, description, credits_or_weight, sequence_position, program:programs(id, title)"
    )
    .eq("is_active", true)
    .order("title");

  const courseIds = courses?.map((course) => course.id) ?? [];

  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
        .order("position", { ascending: true })
    : { data: [] };

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, status, estimated_hours, position")
        .in("module_id", moduleIds)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title, due_at")
        .in("module_id", moduleIds)
        .order("due_at", { ascending: true })
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];

  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final, created_at")
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
    );

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
  const finalSet = getFinalAssignmentSet(assignmentStatus);
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

  const assignmentToCourse = new Map<string, string>();
  assignments?.forEach((assignment) => {
    const courseId = moduleToCourse.get(assignment.module_id);
    if (courseId) {
      assignmentToCourse.set(assignment.id, courseId);
    }
  });

  const courseFinalDates = new Map<string, string>();
  finalSubmissions.forEach((submission) => {
    const courseId = assignmentToCourse.get(submission.assignment_id);
    if (!courseId) return;
    const existing = courseFinalDates.get(courseId);
    if (!existing || new Date(submission.created_at) > new Date(existing)) {
      courseFinalDates.set(courseId, submission.created_at);
    }
  });

  const moduleProgress = (modules ?? []).map((module) => {
    const moduleReadings = readingsByModule.get(module.id) ?? [];
    const moduleAssignments = assignmentsByModule.get(module.id) ?? [];
    const moduleStanding = getModuleStanding({
      readings: moduleReadings,
      assignments: moduleAssignments,
      assignmentStatus,
    });

    return {
      ...module,
      totalTasks: moduleStanding.completion.totalTasks,
      completedTasks: moduleStanding.completion.completedTasks,
      progress: moduleStanding.completion.totalTasks
        ? moduleStanding.completion.completedTasks / moduleStanding.completion.totalTasks
        : 0,
    };
  });

  const courseSummaries = (courses ?? []).map((course) => {
    const modulesForCourse = moduleProgress.filter(
      (module) => module.course_id === course.id
    );
    const totalTasks = modulesForCourse.reduce(
      (sum, module) => sum + module.totalTasks,
      0
    );
    const completedTasks = modulesForCourse.reduce(
      (sum, module) => sum + module.completedTasks,
      0
    );
    const progress = totalTasks ? completedTasks / totalTasks : 0;
    const currentModule = modulesForCourse.find(
      (module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks
    );
    const modulesForStanding = (modules ?? []).filter(
      (module) => module.course_id === course.id
    );
    const thesisSummary =
      course.code === "RSYN 720"
        ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
        : null;
    const courseStanding = getCourseStanding({
      modules: modulesForStanding,
      readingsByModule,
      assignmentsByModule,
      assignmentStatus,
      thesisSummary,
    });

    return {
      ...course,
      totalTasks,
      completedTasks,
      progress,
      currentModule,
      ...courseStanding.assignmentSummary,
      unreadReadings: courseStanding.readingCounts.incompleteReadings,
      skippedReadings: courseStanding.readingCounts.skippedReadings,
      missingFinals:
        courseStanding.assignmentSummary.totalAssignments -
        courseStanding.assignmentSummary.finalAssignments,
      status: getStandingLabel(courseStanding.status),
      isComplete: courseStanding.completion.isComplete,
      finalDate: courseFinalDates.get(course.id) ?? null,
    };
  });

  const { data: prerequisiteMappings } = courseIds.length
    ? await supabase
        .from("course_prerequisites")
        .select("course_id, prerequisite:prerequisite_course_id(id, title, code)")
        .in("course_id", courseIds)
    : { data: [] };

  const prereqsByCourse = new Map<
    string,
    { id: string; title: string; code: string | null }[]
  >();
  prerequisiteMappings?.forEach((mapping) => {
    if (!mapping.prerequisite) return;
    const list = prereqsByCourse.get(mapping.course_id) ?? [];
    list.push(mapping.prerequisite);
    prereqsByCourse.set(mapping.course_id, list);
  });

  const completionByCourse = new Map<string, boolean>();
  courseSummaries.forEach((course) => {
    completionByCourse.set(course.id, course.isComplete);
  });
  const readinessByCourse = buildReadinessByCourse({
    courseIds,
    prereqsByCourse,
    completionByCourse,
  });

  const foundationOrder = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const foundationCourses = foundationOrder
    .map((code) => courseSummaries.find((course) => course.code === code))
    .filter((course): course is (typeof courseSummaries)[number] => Boolean(course));

  const transcriptLite = getTranscriptLiteSummary(courseSummaries);
  const completedCourses = courseSummaries.filter((course) =>
    transcriptLite.completedCourseIds.has(course.id)
  );
  const inProgressCourses = courseSummaries.filter((course) =>
    transcriptLite.inProgressCourseIds.has(course.id)
  );
  const notStartedCourses = courseSummaries.filter(
    (course) =>
      !transcriptLite.completedCourseIds.has(course.id) &&
      !transcriptLite.inProgressCourseIds.has(course.id)
  );
  const completedCourseIds = transcriptLite.completedCourseIds;
  const inProgressCourseIds = transcriptLite.inProgressCourseIds;

  const programIds = Array.from(
    new Set(
      (courses ?? [])
        .map((course) => course.program?.id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: requirementBlocks } = programIds.length
    ? await supabase
        .from("requirement_blocks")
        .select("id, program_id, title, minimum_courses_required, minimum_credits_required, position")
        .in("program_id", programIds)
        .order("position", { ascending: true })
    : { data: [] };
  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: blockMappings } = blockIds.length
    ? await supabase
        .from("course_requirement_blocks")
        .select("requirement_block_id, course_id")
        .in("requirement_block_id", blockIds)
    : { data: [] };

  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );
  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings ?? [],
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });

  const recommendedNext = selectRecommendedNextCourse({
    courses: courseSummaries,
    readinessByCourse,
    blockSummaries,
    blockMappings: blockMappings ?? [],
    preferredOrderCodes: foundationOrder,
  });

  const programSummaries = programIds.map((programId) => {
    const program = (courses ?? []).find((course) => course.program?.id === programId)
      ?.program;
    const programBlocks = blockSummaries.filter(
      (summary) => summary.block.program_id === programId
    );
    const programSummary = getProgramRequirementSummary(programBlocks);
    return {
      id: programId,
      title: program?.title ?? "Program",
      ...programSummary,
    };
  });

  const openAssignments = (assignments ?? []).filter(
    (assignment) => !finalSet.has(assignment.id)
  );

  const currentWork = getCurrentWorkSelection({
    moduleProgress,
    coursesById,
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    finalAssignmentIds: finalSet,
  });
  const currentModule = currentWork.currentModule;
  const currentModuleReadings = currentWork.currentModuleReadings;
  const currentReadings = currentWork.currentReadings;
  const currentSkippedReadings = currentWork.currentSkippedReadings;
  const currentModuleAssignments = currentWork.currentModuleAssignments;
  const currentAssignments = currentWork.currentAssignments;
  const nextAction = currentWork.nextAction;

  // Derive the current active course from the current module
  const activeCourse = currentModule
    ? courseSummaries.find((c) => c.id === currentModule.course_id) ?? null
    : null;

  // Derive the active course's module count for "Unit X of Y"
  const activeCourseTotalModules = activeCourse
    ? moduleProgress.filter((m) => m.course_id === activeCourse.id).length
    : 0;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Devine College{programSummaries.length ? ` · ${programSummaries[0].title}` : ""}
          </p>
          <h1 className="text-3xl">College Home</h1>
        </header>

        {activeCourse && currentModule ? (
          <section className="space-y-4">
            <h2 className="text-2xl">Current Course of Study</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {activeCourse.code ?? ""}{activeCourse.code ? " · " : ""}{activeCourse.completedTasks} of {activeCourse.totalTasks} requirements fulfilled
                </p>
                <Link href={`/courses/${activeCourse.id}`}>
                  <h3 className="text-2xl font-semibold">{activeCourse.title}</h3>
                </Link>
                <p className="text-sm text-[var(--muted)]">
                  {activeCourse.description ?? ""}
                </p>
              </div>

              <Link
                href={`/modules/${currentModule.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-2 transition hover:border-[var(--accent-soft)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Current unit{activeCourseTotalModules ? ` · ${currentModule.position + 1} of ${activeCourseTotalModules}` : ""}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Continue current unit
                  </p>
                </div>
                <p className="text-lg font-semibold text-[var(--text)]">
                  {currentModule.title}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {currentModule.completedTasks} of {currentModule.totalTasks} requirements fulfilled
                </p>
              </Link>

              {(currentReadings.length > 0 || currentAssignments.length > 0) ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {currentReadings.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Assigned readings
                      </p>
                      <ul className="space-y-1 text-sm text-[var(--muted)]">
                        {currentReadings.map((reading) => (
                          <li key={reading.id}>{reading.title}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {currentAssignments.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Outstanding written work
                      </p>
                      <ul className="space-y-1 text-sm text-[var(--muted)]">
                        {currentAssignments.map((assignment) => (
                          <li key={assignment.id}>{assignment.title}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {nextAction ? (
                <div className="border-t border-[var(--border)] pt-4 space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Next obligation
                  </p>
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {nextAction.title}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            All current coursework is complete. See the curriculum sequence below for the next course.
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-xl">Curriculum Sequence</h2>
          <p className="text-sm text-[var(--muted)]">
            The foundations sequence establishes method and content for the
            entire curriculum. PHIL 501 undergirds THEO 510; HIST 520 and
            SCRP 530 complete the early ecclesial and scriptural arc.
          </p>
          {foundationCourses.length ? (
            <div className="space-y-3">
              {foundationCourses.map((course, index) => {
                const isActive = activeCourse?.id === course.id;
                const standing = readinessByCourse.get(course.id);
                const standingLabel = standing?.status === "completed"
                  ? "Complete"
                  : standing?.status === "ready"
                  ? isActive ? "In progress" : "Ready"
                  : "Prerequisites pending";

                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className={`block rounded-xl border bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)] ${
                      isActive ? "border-[var(--accent-soft)]" : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {course.code ?? `Step ${index + 1}`}{isActive ? " · Current course" : ""}
                        </p>
                        <h3 className="text-lg font-semibold">{course.title}</h3>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {standingLabel}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {recommendedNext && !foundationCourses.some((c) => c.id === recommendedNext.id) ? (
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Next in sequence · Prerequisites satisfied
              </p>
              <Link
                href={`/courses/${recommendedNext.id}`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {recommendedNext.code ?? ""}
                </p>
                <h3 className="mt-1 text-lg font-semibold">{recommendedNext.title}</h3>
              </Link>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl">Academic Record</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Completed {completedCourses.length}</span>
              <span>In progress {inProgressCourses.length}</span>
              <span>Not started {notStartedCourses.length}</span>
            </div>
            {completedCourses.length ? (
              <ul className="space-y-1 text-sm text-[var(--muted)]">
                {completedCourses.map((course) => (
                  <li key={course.id}>
                    {course.code ? `${course.code} — ` : ""}
                    {course.title}
                    {course.finalDate ? (
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {" "}· {formatDate(course.finalDate)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>

        {programSummaries.length ? (
          <section className="space-y-4">
            <h2 className="text-xl">Program Standing</h2>
            {programSummaries.map((program) => (
              <Link
                key={program.id}
                href={`/programs/${program.id}/audit`}
                className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] transition hover:border-[var(--accent-soft)]"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {program.title}
                </p>
                <p className="mt-2">
                  {program.satisfiedBlocks} of {program.totalBlocks} requirement blocks satisfied
                  {program.remainingBlocks > 0 ? ` · ${program.remainingBlocks} remaining` : ""}
                </p>
              </Link>
            ))}
          </section>
        ) : null}

        {openAssignments.length ? (
          <section className="space-y-4">
            <h2 className="text-xl">Upcoming Work</h2>
            <div className="space-y-3">
              {openAssignments.slice(0, 6).map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/assignments/${assignment.id}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent-soft)]"
                >
                  <h3 className="text-base font-semibold">{assignment.title}</h3>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {assignment.due_at
                      ? new Date(assignment.due_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
