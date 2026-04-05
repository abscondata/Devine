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
      "id, title, code, description, credits_or_weight, level, sequence_position, program:programs(id, title)"
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
        .select("id, module_id, title, assignment_type, due_at")
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

  // Credit computations
  const creditsEarned = completedCourses.reduce(
    (sum, c) => sum + (c.credits_or_weight ?? 0), 0
  );
  const creditsInProgress = inProgressCourses.reduce(
    (sum, c) => sum + (c.credits_or_weight ?? 0), 0
  );
  const totalCreditsRequired = (requirementBlocks ?? []).reduce(
    (sum, b) => sum + (b.minimum_credits_required ?? 0), 0
  );

  // Estimated reading hours for current module (from raw readings, not ReadingLike)
  const currentModuleRawReadings = currentModule
    ? (readings ?? []).filter((r) => r.module_id === currentModule.id)
    : [];
  const currentModuleHours = currentModuleRawReadings.reduce(
    (sum, r) => sum + (r.estimated_hours ?? 0), 0
  );

  // Academic standing derivation
  const allBlocksSatisfied = blockSummaries.every((s) => s.satisfied);
  const academicStanding = allBlocksSatisfied
    ? "Program complete"
    : inProgressCourses.length > 0 || completedCourses.length > 0
    ? "In good standing"
    : "Enrolled";

  // Current module blockers
  const currentModuleStanding = currentModule
    ? getModuleStanding({
        readings: currentModuleReadings ?? [],
        assignments: currentModuleAssignments ?? [],
        assignmentStatus,
      })
    : null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ── Identity strip ── */}
        <header className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl">College Home</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              {programSummaries.length ? programSummaries[0].title : "Devine College"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Standing: {academicStanding}</span>
              <span>Credits earned: {creditsEarned}{totalCreditsRequired ? ` of ${totalCreditsRequired}` : ""}</span>
              {creditsInProgress > 0 ? <span>Credits in progress: {creditsInProgress}</span> : null}
              <span>Courses complete: {completedCourses.length} of {courseSummaries.length}</span>
              <span>Mode: Self-paced, institutionally sequenced</span>
            </div>
          </div>
        </header>

        {/* ── Current enrollment ── */}
        {activeCourse && currentModule ? (
          <section className="space-y-4">
            <h2 className="text-2xl">Current Enrollment</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-2">
                  <Link href={`/courses/${activeCourse.id}`}>
                    <h3 className="text-2xl font-semibold">{activeCourse.title}</h3>
                  </Link>
                  <p className="text-sm text-[var(--muted)]">
                    {activeCourse.description ?? ""}
                  </p>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] text-right space-y-1 shrink-0">
                  <p>{activeCourse.code ?? ""}</p>
                  <p>{activeCourse.level ?? ""}</p>
                  <p>{activeCourse.credits_or_weight ? `${activeCourse.credits_or_weight} credits` : ""}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>Status: In progress</span>
                <span>{activeCourse.completedTasks} of {activeCourse.totalTasks} requirements fulfilled</span>
                <span>{activeCourse.finalAssignments} of {activeCourse.totalAssignments} final submissions</span>
                {activeCourse.unreadReadings > 0 ? (
                  <span>{activeCourse.unreadReadings} reading{activeCourse.unreadReadings === 1 ? "" : "s"} remaining</span>
                ) : null}
              </div>

              {/* Current unit */}
              <Link
                href={`/modules/${currentModule.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-5 space-y-3 transition hover:border-[var(--accent-soft)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Current unit{activeCourseTotalModules ? ` · ${currentModule.position + 1} of ${activeCourseTotalModules}` : ""}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Continue study
                  </p>
                </div>
                <h4 className="text-lg font-semibold text-[var(--text)]">
                  {currentModule.title}
                </h4>
                <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{currentModule.completedTasks} of {currentModule.totalTasks} requirements fulfilled</span>
                  {currentModuleHours ? <span>Estimated reading: {currentModuleHours.toFixed(1)}h</span> : null}
                  {currentReadings.length > 0 ? <span>{currentReadings.length} reading{currentReadings.length === 1 ? "" : "s"} unread</span> : null}
                  {currentAssignments.length > 0 ? <span>{currentAssignments.length} assignment{currentAssignments.length === 1 ? "" : "s"} outstanding</span> : null}
                </div>
                {currentModuleStanding && currentModuleStanding.completion.unreadReadings > 0 ? (
                  <p className="text-xs text-[var(--muted)]">
                    Unread readings block unit completion.
                  </p>
                ) : null}
              </Link>

              {/* Readings and work detail */}
              {(currentReadings.length > 0 || currentAssignments.length > 0) ? (
                <div className="grid gap-5 md:grid-cols-2">
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

              {/* Next obligation */}
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
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--muted)]">
            All current coursework is complete. See the curriculum sequence below for the next course of study.
          </section>
        )}

        {/* ── Curriculum sequence ── */}
        <section className="space-y-4">
          <h2 className="text-xl">Curriculum Sequence</h2>
          <p className="text-sm text-[var(--muted)]">
            The foundations sequence establishes method and content for the
            entire curriculum. PHIL 501 undergirds THEO 510; HIST 520 and
            SCRP 530 complete the early ecclesial and scriptural arc.
          </p>
          {foundationCourses.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {foundationCourses.map((course) => {
                const isActive = activeCourse?.id === course.id;
                const standing = readinessByCourse.get(course.id);
                const standingLabel = standing?.status === "completed"
                  ? "Complete"
                  : standing?.status === "ready"
                  ? isActive ? "Currently enrolled" : "Prerequisites satisfied"
                  : "Prerequisites pending";

                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)]"
                  >
                    <div className="space-y-0.5">
                      <h3 className="text-base font-semibold">
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </h3>
                      {course.credits_or_weight ? (
                        <p className="text-xs text-[var(--muted)]">{course.credits_or_weight} credits</p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                      {standingLabel}
                    </p>
                  </Link>
                );
              })}
            </div>
          ) : null}
          {recommendedNext && !foundationCourses.some((c) => c.id === recommendedNext.id) ? (
            <div className="space-y-2 pt-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Next in sequence
              </p>
              <Link
                href={`/courses/${recommendedNext.id}`}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
              >
                <h3 className="text-base font-semibold">
                  {recommendedNext.code ? `${recommendedNext.code} — ` : ""}
                  {recommendedNext.title}
                </h3>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Prerequisites satisfied
                </p>
              </Link>
            </div>
          ) : null}
        </section>

        {/* ── Program audit ── */}
        {programSummaries.length ? (
          <section className="space-y-4">
            <h2 className="text-xl">Program Audit</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {blockSummaries.map((summary) => (
                <div
                  key={summary.block.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{summary.block.title}</p>
                    {summary.block.minimum_courses_required ? (
                      <p className="text-xs text-[var(--muted)]">
                        {summary.completedCourseIds.length} of {summary.block.minimum_courses_required} courses
                        {summary.block.minimum_credits_required ? ` · ${summary.completedCredits} of ${summary.block.minimum_credits_required} credits` : ""}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                    {summary.satisfied ? "Satisfied" : summary.status === "in progress" ? "In progress" : "Incomplete"}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>{programSummaries[0].satisfiedBlocks} of {programSummaries[0].totalBlocks} blocks satisfied</span>
              {programSummaries[0].id ? (
                <Link href={`/programs/${programSummaries[0].id}/audit`} className="hover:text-[var(--text)]">
                  Full program audit
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {/* ── Academic record ── */}
        <section className="space-y-4">
          <h2 className="text-xl">Academic Record</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Courses completed: {completedCourses.length}</span>
              <span>Credits earned: {creditsEarned}</span>
              {creditsInProgress > 0 ? <span>Credits in progress: {creditsInProgress}</span> : null}
              <span>Courses in progress: {inProgressCourses.length}</span>
              <span>Courses remaining: {notStartedCourses.length}</span>
            </div>
            {completedCourses.length ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Completed coursework</p>
                <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {completedCourses.map((course) => (
                    <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm text-[var(--muted)]">
                      <span>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </span>
                      <span className="text-xs uppercase tracking-[0.2em]">
                        {course.credits_or_weight ? `${course.credits_or_weight} cr` : ""}
                        {course.finalDate ? ` · ${formatDate(course.finalDate)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {programSummaries[0]?.id ? (
              <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <Link href={`/programs/${programSummaries[0].id}/record`} className="hover:text-[var(--text)]">
                  Full academic record
                </Link>
                <Link href={`/programs/${programSummaries[0].id}/work`} className="hover:text-[var(--text)]">
                  Submission record
                </Link>
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Current obligations ── */}
        {openAssignments.length ? (
          <section className="space-y-4">
            <h2 className="text-xl">Current Obligations</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {openAssignments.slice(0, 8).map((assignment) => {
                const courseId = assignmentToCourse.get(assignment.id);
                const course = courseId ? coursesById.get(courseId) : null;
                const isCurrentCourse = activeCourse?.id === courseId;

                return (
                  <Link
                    key={assignment.id}
                    href={`/assignments/${assignment.id}`}
                    className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--surface-muted)]"
                  >
                    <div className="space-y-0.5">
                      <p className="text-sm font-semibold">{assignment.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {course?.code ?? ""}{course?.code ? " · " : ""}{assignment.assignment_type?.replace(/_/g, " ") ?? ""}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                      {isCurrentCourse ? "Current course" : "Future"}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
