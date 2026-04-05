import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getFinalAssignmentSet,
  getModuleNextAction,
  getModuleStanding,
  getProgramRequirementSummary,
  getStandingLabel,
  getTranscriptLiteSummary,
  buildReadinessByCourse,
  selectRecommendedNextCourse,
  isReadingIncomplete,
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

  // ─── RESOLVE ENROLLMENT ───
  // Read the user's program membership including current_course_id.
  // This is the single source of enrollment truth for the entire page.
  const { data: ownedPrograms } = await supabase
    .from("programs")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  let currentProgram = ownedPrograms?.[0] ?? null;
  let enrolledCourseId: string | null = null;

  if (currentProgram) {
    const { data: membership } = await supabase
      .from("program_members")
      .select("current_course_id")
      .eq("program_id", currentProgram.id)
      .eq("user_id", user.id)
      .maybeSingle();
    enrolledCourseId = membership?.current_course_id ?? null;
  } else {
    const { data: memberships } = await supabase
      .from("program_members")
      .select("program_id, current_course_id")
      .eq("user_id", user.id)
      .limit(1);
    if (memberships?.length) {
      enrolledCourseId = memberships[0].current_course_id;
      const { data: memberProgram } = await supabase
        .from("programs")
        .select("id, title")
        .eq("id", memberships[0].program_id)
        .single();
      currentProgram = memberProgram;
    }
  }

  // ─── PROGRAM-SCOPED DATA ───
  // All course/module/reading/assignment data is filtered to currentProgram.
  const { data: courses } = currentProgram
    ? await supabase
        .from("courses")
        .select(
          "id, title, code, description, credits_or_weight, level, sequence_position, program:programs(id, title)"
        )
        .eq("program_id", currentProgram.id)
        .eq("is_active", true)
        .order("sequence_position", { ascending: true })
    : { data: null };

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
  // All state is scoped to currentProgram.
  // ═══════════════════════════════════════════════════════════════════

  // 1. CURRENT COURSE — governed by explicit enrollment truth.
  //    If enrolledCourseId is set in program_members, that is the current course.
  //    If null (enrollment not yet set), fall back to sequence-position inference.
  const enrolledCourse = enrolledCourseId
    ? courseSummaries.find((c) => c.id === enrolledCourseId) ?? null
    : null;
  const inferredCourse = courseSummaries
    .filter((c) => {
      if (c.isComplete) return false;
      const r = readinessByCourse.get(c.id);
      return r?.status === "ready";
    })
    .sort((a, b) => (a.sequence_position ?? 9999) - (b.sequence_position ?? 9999))[0] ?? null;
  // Enrollment governs. Inference is the fallback.
  const activeCourse = enrolledCourse ?? inferredCourse;

  // 2. CURRENT UNIT — first incomplete unit inside the active course only.
  //    No cross-course scanning. No alphabetical fallback.
  const activeCourseModules = activeCourse
    ? moduleProgress
        .filter((m) => m.course_id === activeCourse.id)
        .sort((a, b) => a.position - b.position)
    : [];
  const currentUnit = activeCourseModules.find(
    (m) => m.totalTasks > 0 && m.completedTasks < m.totalTasks
  ) ?? null;
  const activeCourseTotalUnits = activeCourseModules.length;

  // 3. CURRENT UNIT readings, written work, next action — scoped to unit.
  const currentUnitRawReadings = currentUnit
    ? (readingsByModule.get(currentUnit.id) ?? [])
    : [];
  const currentUnitReadings = currentUnitRawReadings.filter(
    (r) => isReadingIncomplete(r.status)
  );
  const currentUnitRawAssignments = currentUnit
    ? (assignmentsByModule.get(currentUnit.id) ?? [])
    : [];
  const currentUnitWrittenWork = currentUnitRawAssignments.filter(
    (a) => !finalSet.has(a.id)
  );
  const currentUnitHours = currentUnit
    ? (readings ?? [])
        .filter((r) => r.module_id === currentUnit.id)
        .reduce((sum, r) => sum + (r.estimated_hours ?? 0), 0)
    : 0;
  const currentUnitStanding = currentUnit
    ? getModuleStanding({
        readings: currentUnitRawReadings as Parameters<typeof getModuleStanding>[0]["readings"],
        assignments: currentUnitRawAssignments as Parameters<typeof getModuleStanding>[0]["assignments"],
        assignmentStatus,
      })
    : null;
  const nextAction = currentUnit
    ? getModuleNextAction({
        readings: currentUnitRawReadings as Parameters<typeof getModuleNextAction>[0]["readings"],
        assignments: currentUnitRawAssignments as Parameters<typeof getModuleNextAction>[0]["assignments"],
        assignmentStatus,
      })
    : null;

  // 4. LATER WORK in current course (units after the current one).
  const laterCourseWork = activeCourse && currentUnit
    ? (assignments ?? []).filter((a) => {
        if (finalSet.has(a.id)) return false;
        if (assignmentToCourse.get(a.id) !== activeCourse.id) return false;
        const mod = modules?.find((m) => m.id === a.module_id);
        return mod ? mod.position > currentUnit.position : false;
      })
    : [];

  // 5. COUNTS — active course always counted as in-progress.
  const canonicalInProgressIds = new Set(inProgressCourseIds);
  if (activeCourse && !activeCourse.isComplete) {
    canonicalInProgressIds.add(activeCourse.id);
  }
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

  // 6. IDENTITY — enrollment is a fact, completion state is a fact.
  const allBlocksSatisfied = blockSummaries.every((s) => s.satisfied);
  const enrollmentStatus = currentProgram ? "Enrolled" : "No program";
  const enrollmentSource = enrolledCourse ? "explicit" : activeCourse ? "inferred" : "none";
  const completionState = allBlocksSatisfied
    ? "Program complete"
    : activeCourse || completedCourses.length > 0
    ? "Active"
    : "Not yet begun";

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">

        {/* ─── Header ─── */}
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {currentProgram?.title ?? "Devine College"} · {creditsEarned} of {totalCreditsRequired} credits earned
          </p>
          <h1 className="text-3xl">College Home</h1>
        </header>

        {/* ─── Current course ─── */}
        {activeCourse ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {activeCourse.code} · {activeCourse.level} · {activeCourse.credits_or_weight} credits
                </p>
                <Link href={`/courses/${activeCourse.id}`}>
                  <h2 className="text-2xl font-semibold">{activeCourse.title}</h2>
                </Link>
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] text-right shrink-0">
                <p>{activeCourse.completedTasks} of {activeCourse.totalTasks} fulfilled</p>
                <p>{activeCourse.finalAssignments} of {activeCourse.totalAssignments} final submissions</p>
              </div>
            </div>

            {/* Current unit */}
            {currentUnit ? (
              <Link
                href={`/modules/${currentUnit.id}`}
                className="block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-5 space-y-2 transition hover:border-[var(--accent-soft)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Unit {currentUnit.position + 1} of {activeCourseTotalUnits}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Continue</p>
                </div>
                <h3 className="text-lg font-semibold">{currentUnit.title}</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{currentUnit.completedTasks} of {currentUnit.totalTasks} fulfilled</span>
                  {currentUnitHours ? <span>{currentUnitHours.toFixed(1)}h reading</span> : null}
                  {currentUnitReadings.length > 0 ? <span>{currentUnitReadings.length} unread</span> : null}
                  {currentUnitWrittenWork.length > 0 ? <span>{currentUnitWrittenWork.length} to write</span> : null}
                </div>
              </Link>
            ) : (
              <p className="text-sm font-semibold text-[var(--text)]">All units complete.</p>
            )}

            {/* Next obligation */}
            {nextAction ? (
              <div className="border-t border-[var(--border)] pt-4 space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Next</p>
                <p className="text-sm font-semibold text-[var(--text)]">{nextAction.title}</p>
                <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            {completedCourses.length > 0 && !recommendedNext ? (
              <p className="text-sm font-semibold text-[var(--text)]">All coursework complete.</p>
            ) : recommendedNext ? (
              <div className="space-y-3">
                <p className="text-sm text-[var(--muted)]">
                  {completedCourses.length > 0 ? "Current course complete." : "No course in progress."}
                </p>
                <Link href={`/courses/${recommendedNext.id}`} className="block rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 transition hover:border-[var(--accent-soft)]">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Ready to begin</p>
                  <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                    {recommendedNext.code ? `${recommendedNext.code} — ` : ""}{recommendedNext.title}
                  </p>
                </Link>
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No course in progress.</p>
            )}
          </section>
        )}

        {/* ─── Readings queue ─── */}
        {currentUnitReadings.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Reading Queue</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {currentUnitReadings.map((r) => (
                <div key={r.id} className="px-5 py-3 text-sm text-[var(--muted)]">{r.title}</div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Writing queue ─── */}
        {currentUnitWrittenWork.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Writing Queue</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {currentUnitWrittenWork.map((a) => (
                <Link key={a.id} href={`/assignments/${a.id}`} className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--surface-muted)]">
                  <span className="text-sm font-semibold">{a.title}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{a.assignment_type?.replace(/_/g, " ") ?? ""}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Quick links ─── */}
        <section className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {activeCourse ? (
            <Link href={`/courses/${activeCourse.id}`} className="hover:text-[var(--text)]">Course syllabus</Link>
          ) : null}
          {currentProgram?.id ? (
            <>
              <Link href={`/programs/${currentProgram.id}/record`} className="hover:text-[var(--text)]">Academic record</Link>
              <Link href={`/programs/${currentProgram.id}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
              <Link href={`/programs/${currentProgram.id}/work`} className="hover:text-[var(--text)]">Submissions</Link>
            </>
          ) : null}
          <Link href="/courses" className="hover:text-[var(--text)]">Curriculum</Link>
        </section>
      </div>
    </ProtectedShell>
  );
}
