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

  // ═══════════════════════════════════════════════════════════════════
  // CANONICAL TRUTH DERIVATION
  // Every display field on College Home derives from this block.
  // No zone may contradict another because they share these outputs.
  // ═══════════════════════════════════════════════════════════════════

  // 1. CURRENT COURSE: only prerequisite-valid courses are eligible.
  const validCourseIds = new Set(
    courseIds.filter((id) => {
      const r = readinessByCourse.get(id);
      return r?.status === "ready" || r?.status === "completed";
    })
  );
  const currentWork = getCurrentWorkSelection({
    moduleProgress: moduleProgress.filter((m) => validCourseIds.has(m.course_id)),
    coursesById,
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    finalAssignmentIds: finalSet,
  });
  const currentUnit = currentWork.currentModule;
  const activeCourse = currentUnit
    ? courseSummaries.find((c) => c.id === currentUnit.course_id) ?? null
    : null;

  // 2. COUNTS: if activeCourse exists it MUST count as in-progress,
  //    even if getTranscriptLiteSummary classified it as "not started"
  //    (which happens when completedTasks === 0).
  const activeCourseIsInProgress = activeCourse && !activeCourse.isComplete;
  const canonicalInProgressIds = new Set(inProgressCourseIds);
  if (activeCourseIsInProgress) canonicalInProgressIds.add(activeCourse.id);
  const canonicalInProgressCount = canonicalInProgressIds.size;
  const creditsEarned = completedCourses.reduce(
    (sum, c) => sum + (c.credits_or_weight ?? 0), 0
  );
  const creditsInProgress = courseSummaries
    .filter((c) => canonicalInProgressIds.has(c.id))
    .reduce((sum, c) => sum + (c.credits_or_weight ?? 0), 0);
  const totalCreditsRequired = (requirementBlocks ?? []).reduce(
    (sum, b) => sum + (b.minimum_credits_required ?? 0), 0
  );

  // 3. CURRENT UNIT detail.
  const activeCourseTotalUnits = activeCourse
    ? moduleProgress.filter((m) => m.course_id === activeCourse.id).length
    : 0;
  const currentUnitReadings = currentWork.currentReadings;
  const currentUnitWrittenWork = currentWork.currentAssignments;
  const currentUnitHours = currentUnit
    ? (readings ?? [])
        .filter((r) => r.module_id === currentUnit.id)
        .reduce((sum, r) => sum + (r.estimated_hours ?? 0), 0)
    : 0;
  const currentUnitStanding = currentUnit
    ? getModuleStanding({
        readings: (readingsByModule.get(currentUnit.id) ?? []) as Parameters<typeof getModuleStanding>[0]["readings"],
        assignments: (assignmentsByModule.get(currentUnit.id) ?? []) as Parameters<typeof getModuleStanding>[0]["assignments"],
        assignmentStatus,
      })
    : null;
  const nextAction = currentWork.nextAction;

  // 4. LATER WORK in current course (units after the current one).
  const laterCourseWork = activeCourse && currentUnit
    ? (assignments ?? []).filter((a) => {
        if (finalSet.has(a.id)) return false;
        if (assignmentToCourse.get(a.id) !== activeCourse.id) return false;
        const mod = moduleToCourse.get(a.module_id) === activeCourse.id
          ? modules?.find((m) => m.id === a.module_id)
          : null;
        return mod ? mod.position > currentUnit.position : false;
      })
    : [];

  // 5. IDENTITY FIELDS — enrollment and standing are separate concepts.
  const allBlocksSatisfied = blockSummaries.every((s) => s.satisfied);
  const enrollmentStatus = programSummaries.length ? "Enrolled" : "No program";
  const academicStanding = allBlocksSatisfied
    ? "Program complete"
    : activeCourse || completedCourses.length > 0
    ? "In good standing"
    : "Not yet begun";

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ═══ A. ACADEMIC IDENTITY ═══ */}
        <header className="space-y-4">
          <div className="space-y-1">
            <h1 className="text-3xl">College Home</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              {programSummaries.length ? programSummaries[0].title : "Devine College"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Enrollment: {enrollmentStatus}</span>
              <span>Standing: {academicStanding}</span>
              <span>Credits earned: {creditsEarned}{totalCreditsRequired ? ` of ${totalCreditsRequired}` : ""}</span>
              {creditsInProgress > 0 ? <span>Credits in progress: {creditsInProgress}</span> : null}
              <span>Courses: {completedCourses.length} complete, {canonicalInProgressCount} in progress</span>
              <span>Final submissions: {finalSubmissions.length}</span>
            </div>
          </div>
        </header>

        {/* ═══ B. CURRENT COURSE ═══ */}
        {activeCourse && currentUnit ? (
          <section className="space-y-4">
            <h2 className="text-2xl">Current Course</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="space-y-1">
                  <Link href={`/courses/${activeCourse.id}`}>
                    <h3 className="text-2xl font-semibold">{activeCourse.title}</h3>
                  </Link>
                  <p className="text-sm text-[var(--muted)]">{activeCourse.description ?? ""}</p>
                </div>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] text-right space-y-1 shrink-0">
                  {activeCourse.code ? <p>{activeCourse.code}</p> : null}
                  {activeCourse.level ? <p>{activeCourse.level}</p> : null}
                  {activeCourse.credits_or_weight ? <p>{activeCourse.credits_or_weight} credits</p> : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>{activeCourse.completedTasks} of {activeCourse.totalTasks} course requirements fulfilled</span>
                <span>{activeCourse.finalAssignments} of {activeCourse.totalAssignments} final submissions</span>
              </div>
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <h2 className="text-2xl">Current Course</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              {completedCourses.length > 0 && !recommendedNext ? (
                <p className="text-sm font-semibold text-[var(--text)]">All coursework complete.</p>
              ) : recommendedNext ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--muted)]">
                    {completedCourses.length > 0 ? "Current coursework is complete." : "No course is currently in progress."}
                  </p>
                  <Link href={`/courses/${recommendedNext.id}`} className="block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition hover:border-[var(--accent-soft)]">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Ready to begin</p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                      {recommendedNext.code ? `${recommendedNext.code} — ` : ""}{recommendedNext.title}
                    </p>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No course is currently in progress.</p>
              )}
            </div>
          </section>
        )}

        {/* ═══ C. CURRENT UNIT ═══ */}
        {activeCourse && currentUnit ? (
          <section className="space-y-4">
            <h2 className="text-xl">Current Unit</h2>
            <Link
              href={`/modules/${currentUnit.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3 transition hover:border-[var(--accent-soft)]"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Unit {currentUnit.position + 1} of {activeCourseTotalUnits} · {activeCourse.code}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Continue study</p>
              </div>
              <h3 className="text-lg font-semibold">{currentUnit.title}</h3>
              <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>{currentUnit.completedTasks} of {currentUnit.totalTasks} unit requirements fulfilled</span>
                {currentUnitHours ? <span>Estimated reading: {currentUnitHours.toFixed(1)}h</span> : null}
              </div>
              {currentUnitStanding && currentUnitStanding.completion.unreadReadings > 0 ? (
                <p className="text-xs text-[var(--muted)]">Unread readings block unit completion.</p>
              ) : null}
            </Link>
          </section>
        ) : null}

        {/* ═══ D. CURRENT REQUIRED WORK ═══ */}
        {(currentUnitReadings.length > 0 || currentUnitWrittenWork.length > 0) ? (
          <section className="space-y-4">
            <h2 className="text-xl">Current Required Work</h2>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Unit {currentUnit!.position + 1}: {currentUnit!.title}
            </p>
            <div className="grid gap-5 md:grid-cols-2">
              {currentUnitReadings.length > 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Readings · {currentUnitReadings.length} unread
                  </p>
                  <ul className="space-y-1 text-sm text-[var(--muted)]">
                    {currentUnitReadings.map((r) => <li key={r.id}>{r.title}</li>)}
                  </ul>
                </div>
              ) : null}
              {currentUnitWrittenWork.length > 0 ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Written work · {currentUnitWrittenWork.length} outstanding
                  </p>
                  <ul className="space-y-1 text-sm text-[var(--muted)]">
                    {currentUnitWrittenWork.map((a) => <li key={a.id}>{a.title}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>
            {nextAction ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Next obligation</p>
                <p className="text-sm font-semibold text-[var(--text)]">{nextAction.title}</p>
                <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
              </div>
            ) : null}
            {laterCourseWork.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Later in this course · {laterCourseWork.length} written work remaining
                </p>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ═══ E. INSTITUTIONAL STANDING ═══ */}
        <section className="space-y-5">
          <h2 className="text-xl">Institutional Standing</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Academic record</p>
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Courses completed: {completedCourses.length}</span>
              <span>Credits earned: {creditsEarned}</span>
              <span>In progress: {canonicalInProgressCount} course{canonicalInProgressCount === 1 ? "" : "s"}, {creditsInProgress} cr</span>
            </div>
            {completedCourses.length ? (
              <ul className="space-y-1 text-sm text-[var(--muted)]">
                {completedCourses.map((c) => (
                  <li key={c.id}>
                    {c.code ? `${c.code} — ` : ""}{c.title}
                    {c.finalDate ? <span className="text-xs uppercase tracking-[0.2em]"> · {formatDate(c.finalDate)}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {programSummaries[0]?.id ? (
              <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <Link href={`/programs/${programSummaries[0].id}/record`} className="hover:text-[var(--text)]">Full academic record</Link>
                <Link href={`/programs/${programSummaries[0].id}/work`} className="hover:text-[var(--text)]">Submission record</Link>
              </div>
            ) : null}
          </div>
          {programSummaries.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Program audit</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {programSummaries[0].satisfiedBlocks} of {programSummaries[0].totalBlocks} blocks satisfied
                </p>
              </div>
              {(() => {
                const nextIncomplete = blockSummaries.find((s) => !s.satisfied);
                return nextIncomplete ? (
                  <p className="text-sm text-[var(--muted)]">
                    Next incomplete: <span className="font-semibold text-[var(--text)]">{nextIncomplete.block.title}</span> ({nextIncomplete.status})
                  </p>
                ) : (
                  <p className="text-sm font-semibold text-[var(--text)]">All requirement blocks satisfied.</p>
                );
              })()}
              {programSummaries[0].id ? (
                <Link href={`/programs/${programSummaries[0].id}/audit`} className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--text)]">Full program audit</Link>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ═══ F. FORWARD SEQUENCE ═══ */}
        <section className="space-y-4">
          <h2 className="text-xl">Curriculum Sequence</h2>
          <p className="text-sm text-[var(--muted)]">
            Courses unlock as prerequisites are completed. The foundations sequence
            establishes method and content for the entire curriculum.
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {foundationCourses.map((course) => {
              const isActive = activeCourse?.id === course.id;
              const standing = readinessByCourse.get(course.id);
              const prereqs = prereqsByCourse.get(course.id) ?? [];
              const unmetPrereqs = prereqs.filter((p) => !(completionByCourse.get(p.id) ?? false));

              let label: string;
              if (standing?.status === "completed") label = "Complete";
              else if (isActive) label = "Current course";
              else if (standing?.status === "ready") label = "Ready";
              else label = "Blocked";

              return (
                <Link key={course.id} href={`/courses/${course.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)]">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-semibold">{course.code ? `${course.code} — ` : ""}{course.title}</h3>
                    {course.credits_or_weight ? <p className="text-xs text-[var(--muted)]">{course.credits_or_weight} credits</p> : null}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
                    {label === "Blocked" && unmetPrereqs.length ? (
                      <p className="text-xs text-[var(--muted)]">Requires {unmetPrereqs.map((p) => p.code ?? p.title).join(", ")}</p>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
          {recommendedNext && !foundationCourses.some((c) => c.id === recommendedNext.id) ? (
            <Link href={`/courses/${recommendedNext.id}`} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]">
              <h3 className="text-base font-semibold">{recommendedNext.code ? `${recommendedNext.code} — ` : ""}{recommendedNext.title}</h3>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Next in sequence</p>
            </Link>
          ) : null}
        </section>
      </div>
    </ProtectedShell>
  );
}
