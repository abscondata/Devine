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

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Overview
          </p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">
            Active coursework, current module, and open work.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Foundations Phase</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Opening sequence
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <p className="text-sm text-[var(--muted)]">
              The foundations sequence establishes method and content for the
              entire curriculum. PHIL 501 undergirds THEO 510; HIST 520 and
              SCRP 530 complete the early ecclesial and scriptural arc.
            </p>
            {foundationCourses.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {foundationCourses.map((course, index) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)] hover:border-[var(--accent-soft)]"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-[var(--text)]">
                      {course.code ? `${course.code} — ` : ""}
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {course.description ?? "No description provided."}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Foundations courses are not yet seeded.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Academic Record</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Standing
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Completed {completedCourses.length}</span>
              <span>In progress {inProgressCourses.length}</span>
              <span>Not started {notStartedCourses.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3 text-sm text-[var(--muted)]">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Officially Complete
                </p>
                {completedCourses.length ? (
                  <ul className="space-y-2">
                    {completedCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                        {course.finalDate ? (
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            {" "}
                            · Final {formatDate(course.finalDate)}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No completed courses yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  In Progress
                </p>
                {inProgressCourses.length ? (
                  <ul className="space-y-2">
                    {inProgressCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No courses currently in progress.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Not Yet Started
                </p>
                {notStartedCourses.length ? (
                  <ul className="space-y-2">
                    {notStartedCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>All courses have activity.</p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Program Standing</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Constitutional progress
            </span>
          </div>
          {programSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {programSummaries.map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.id}/audit`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] hover:border-[var(--accent-soft)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {program.title}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Requirement blocks satisfied {program.satisfiedBlocks}/{program.totalBlocks}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Remaining {program.remainingBlocks}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No programs found for constitutional audit.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recommended Next</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Readiness
            </span>
          </div>
          {recommendedNext ? (
            <Link
              href={`/courses/${recommendedNext.id}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {(recommendedNext.code ? `${recommendedNext.code} — ` : "") +
                  recommendedNext.title}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {recommendedNext.description ?? "No description provided."}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Ready now · {readinessByCourse.get(recommendedNext.id)?.reason ?? ""}
              </p>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No courses are ready yet. Complete prerequisites to unlock the next step.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Courses</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {courseSummaries.length} total
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Official completion requires all readings marked complete (skipped
            readings do not count) and final submissions for every assignment.
            Critiques are recommended but do not determine completion.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {courseSummaries.length ? (
              courseSummaries.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {course.program?.title ?? "Program"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{course.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {course.description ?? "No description provided."}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {readinessByCourse.get(course.id)?.status === "completed"
                      ? "Completed"
                      : readinessByCourse.get(course.id)?.status === "ready"
                      ? "Ready now"
                      : "Not yet"}
                    {readinessByCourse.get(course.id)?.status === "blocked"
                      ? ` · ${readinessByCourse.get(course.id)?.reason}`
                      : ""}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Progress {course.completedTasks}/{course.totalTasks}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>
                      Final {course.finalAssignments}/{course.totalAssignments}
                    </span>
                    {course.draftAssignments ? (
                      <span>Drafts {course.draftAssignments}</span>
                    ) : null}
                    {course.finalAssignments ? (
                      <span>
                        Critiqued {course.critiquedFinals}/{course.finalAssignments}
                      </span>
                    ) : null}
                    {course.completedTasks < course.totalTasks ? (
                      <span>
                        Blockers
                        {course.unreadReadings > 0
                          ? ` ${course.unreadReadings} reading${course.unreadReadings === 1 ? "" : "s"}`
                          : ""}
                        {course.missingFinals > 0
                          ? ` ${course.missingFinals} final${course.missingFinals === 1 ? "" : "s"}`
                          : ""}
                        {course.skippedReadings > 0
                          ? ` ${course.skippedReadings} skipped`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                No active courses found. Add courses to populate this view.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Module</h2>
            {currentModule ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Module {currentModule.position + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{currentModule.title}</h3>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Progress {currentModule.completedTasks}/{currentModule.totalTasks}
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Open Readings
                    </p>
                    {currentReadings.length ? (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                        {currentReadings.map((reading) => (
                          <li
                            key={reading.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{reading.title}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No open readings.
                      </p>
                    )}
                    {currentSkippedReadings.length ? (
                      <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Skipped readings (do not count): {currentSkippedReadings.length}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Open Assignments
                    </p>
                    {currentAssignments.length ? (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                        {currentAssignments.map((assignment) => (
                          <li key={assignment.id}>{assignment.title}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No open assignments.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)] space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Next Required Action
                  </p>
                  {nextAction ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {nextAction.title}
                      </p>
                      <p>{nextAction.reason}</p>
                    </>
                  ) : (
                    <p>All required work in this module is complete.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                All modules are complete or no module work exists yet.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Open Assignments</h2>
            <div className="space-y-3">
              {openAssignments.length ? (
                openAssignments.slice(0, 6).map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/assignments/${assignment.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent-soft)]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">{assignment.title}</h3>
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {assignment.due_at
                          ? new Date(assignment.due_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No deadline"}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                  No open assignments right now.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
