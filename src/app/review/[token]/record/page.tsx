import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentStatusMap,
  buildReadinessByCourse,
  getCourseStanding,
  getCurrentWorkSelection,
  getProgramRequirementSummary,
  getStandingLabel,
  getStandingStatus,
  getTranscriptLiteSummary,
  selectRecommendedNextCourse,
  summarizeRequirementBlocks,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { getReviewProgram } from "@/lib/review-access";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReviewRecordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await getReviewProgram(token);
  if (!review) {
    notFound();
  }
  const { program } = review;
  const admin = createAdminClient();

  const { data: requirementBlocks } = await admin
    .from("requirement_blocks")
    .select(
      "id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position"
    )
    .eq("program_id", program.id)
    .order("position", { ascending: true });

  const { data: courses } = await admin
    .from("courses")
    .select("id, title, code, credits_or_weight, sequence_position")
    .eq("program_id", program.id)
    .order("sequence_position", { ascending: true });

  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await admin
        .from("course_requirement_blocks")
        .select("requirement_block_id, course_id")
        .in("requirement_block_id", blockIds)
    : { data: [] };

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await admin
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
    : { data: [] };

  const { data: prerequisiteMappings } = courseIds.length
    ? await admin
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

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: readings } = moduleIds.length
    ? await admin
        .from("readings")
        .select("id, module_id, title, status")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await admin
        .from("assignments")
        .select("id, module_id, title")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await admin
        .from("submissions")
        .select("id, assignment_id, is_final, created_at")
        .eq("user_id", program.owner_id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await admin
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = await admin
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("program_id", program.id);

  const thesisProjectIds = thesisProjects?.map((project) => project.id) ?? [];
  const { data: thesisMilestones } = thesisProjectIds.length
    ? await admin
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

  const modulesByCourse = new Map<string, { id: string }[]>();
  modules?.forEach((module) => {
    const list = modulesByCourse.get(module.course_id) ?? [];
    list.push({ id: module.id });
    modulesByCourse.set(module.course_id, list);
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

  const moduleProgress =
    modules?.map((module) => {
      const standing = getCourseStanding({
        modules: [{ id: module.id }],
        readingsByModule,
        assignmentsByModule,
        assignmentStatus,
      });
      return {
        id: module.id,
        course_id: module.course_id,
        title: module.title,
        position: module.position,
        totalTasks: standing.completion.totalTasks,
        completedTasks: standing.completion.completedTasks,
      };
    }) ?? [];

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

  const courseProgress = (courses ?? []).map((course) => {
    const courseModules = modulesByCourse.get(course.id) ?? [];
    const thesisSummary =
      course.code === "RSYN 720"
        ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
        : null;
    const standing = getCourseStanding({
      modules: courseModules,
      readingsByModule,
      assignmentsByModule,
      assignmentStatus,
      thesisSummary,
    });
    const status = getStandingStatus(standing.completion);
    return {
      ...course,
      status,
      completedTasks: standing.completion.completedTasks,
      totalTasks: standing.completion.totalTasks,
      isComplete: status === "completed",
      finalDate: courseFinalDates.get(course.id) ?? null,
    };
  });

  const completionByCourse = new Map<string, boolean>();
  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseProgress.forEach((course) => {
    completionByCourse.set(course.id, course.isComplete);
    if (course.isComplete) {
      completedCourseIds.add(course.id);
    } else if (course.completedTasks > 0) {
      inProgressCourseIds.add(course.id);
    }
  });

  const readinessByCourse = buildReadinessByCourse({
    courseIds,
    prereqsByCourse,
    completionByCourse,
  });

  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );
  const blockMappings: { requirement_block_id: string; course_id: string }[] =
    (mappings ?? []).map((mapping) => ({
      requirement_block_id: mapping.requirement_block_id,
      course_id: mapping.course_id,
    }));

  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings,
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });

  const programSummary = getProgramRequirementSummary(blockSummaries);
  const transcriptLite = getTranscriptLiteSummary(
    courseProgress.map((course) => ({
      id: course.id,
      title: course.title,
      code: course.code,
      completedTasks: course.completedTasks,
      totalTasks: course.totalTasks,
      isComplete: course.isComplete,
      sequence_position: course.sequence_position,
    }))
  );

  const currentWork = getCurrentWorkSelection({
    moduleProgress,
    coursesById,
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    finalAssignmentIds: new Set(finalSubmissions.map((submission) => submission.assignment_id)),
  });

  const recommendedNext = selectRecommendedNextCourse({
    courses: courseProgress,
    readinessByCourse,
    blockSummaries,
    blockMappings,
    preferredOrderCodes: ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"],
  });

  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}`}>Program review packet</Link>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}/charter`}>Charter</Link>
          <span className="text-[var(--text)]">Record</span>
          <Link href={`/review/${token}/chronology`}>Chronology</Link>
          <Link href={`/review/${token}/work`}>Work</Link>
          <Link href={`/review/${token}/research`}>Research</Link>
          <Link href={`/review/${token}/thesis`}>Thesis</Link>
          <Link href={`/review/${token}/readiness`}>Readiness</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Official Academic Record
        </p>
        <h1 className="text-3xl">Academic Record</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{courseProgress.length} courses · {totalCredits} credits</span>
          <span>{completedCourseIds.size} complete · {inProgressCourseIds.size} in progress</span>
          <span>{programSummary.satisfiedBlocks}/{programSummary.totalBlocks} blocks satisfied</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Program standing ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Program Standing</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>Total blocks: {programSummary.totalBlocks}</span>
            <span>Satisfied: {programSummary.satisfiedBlocks}</span>
            <span>Remaining: {programSummary.remainingBlocks}</span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Requirement blocks define constitutional completion. A block is satisfied
            only when its minimum course or credit threshold is met through officially
            completed courses.
          </p>
        </div>
      </section>

      {/* ─── Transcript ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Transcript</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="hidden md:grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[140px_1fr_160px_160px] pb-2 border-b border-[var(--border)]">
            <span>Course</span>
            <span>Title</span>
            <span>Status</span>
            <span>Final date</span>
          </div>
          <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
            {courseProgress.map((course) => (
              <div
                key={course.id}
                className="grid gap-2 md:grid-cols-[140px_1fr_160px_160px]"
              >
                <span>{course.code ?? "—"}</span>
                <span>{course.title ?? "Untitled course"}</span>
                <span className="text-[var(--text)]">
                  {getStandingLabel(course.status)}
                </span>
                <span>{course.status === "completed" ? formatDate(course.finalDate) : "—"}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:col-span-4 no-print">
                  <Link href={`/review/${token}/courses/${course.id}`}>Course dossier</Link>
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--muted)]">
            Official completion requires all readings marked complete (skipped readings do
            not count) and final submissions for every assignment. Critiques are
            recommended but do not determine completion. RSYN 720 additionally requires
            an active thesis project with all required milestones complete.
          </div>
        </div>
      </section>

      {/* ─── Course standing summary ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Course Standing Summary</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-sm text-[var(--muted)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Officially Complete
            </p>
            {transcriptLite.completedCourses.length ? (
              <ul className="space-y-1">
                {transcriptLite.completedCourses.map((course) => (
                  <li key={course.id}>
                    {course.code ? `${course.code} — ` : ""}
                    {course.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p>None yet.</p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-sm text-[var(--muted)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              In Progress
            </p>
            {transcriptLite.inProgressCourses.length ? (
              <ul className="space-y-1">
                {transcriptLite.inProgressCourses.map((course) => (
                  <li key={course.id}>
                    {course.code ? `${course.code} — ` : ""}
                    {course.title}
                  </li>
                ))}
              </ul>
            ) : (
              <p>None in progress.</p>
            )}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 text-sm text-[var(--muted)]">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Not Yet Started
            </p>
            {transcriptLite.notStartedCourses.length ? (
              <ul className="space-y-1">
                {transcriptLite.notStartedCourses.map((course) => (
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
      </section>

      {/* ─── Current work ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Current Work</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm space-y-2">
          {currentWork.currentModule ? (
            <>
              <p className="font-semibold text-[var(--text)]">
                {currentWork.currentModule.title ?? "Current module"}
              </p>
              {currentWork.nextAction ? (
                <>
                  <p className="text-[var(--muted)]">{currentWork.nextAction.title}</p>
                  <p className="text-xs text-[var(--muted)]">{currentWork.nextAction.reason}</p>
                </>
              ) : (
                <p className="text-[var(--muted)]">All required work in the current module is complete.</p>
              )}
            </>
          ) : (
            <p className="text-[var(--muted)]">No active module work is in progress.</p>
          )}
        </div>
      </section>

      {/* ─── Recommended next course ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Recommended Next Course</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
          {recommendedNext ? (
            <p className="font-semibold text-[var(--text)]">
              {recommendedNext.code ? `${recommendedNext.code} — ` : ""}
              {recommendedNext.title}
            </p>
          ) : (
            <p className="text-[var(--muted)]">No ready course is available without prerequisite completion.</p>
          )}
        </div>
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · Academic record · {courseProgress.length} courses · {completedCourseIds.size} complete · {programSummary.satisfiedBlocks}/{programSummary.totalBlocks} blocks satisfied · Generated {now}
        </p>
      </footer>
    </div>
  );
}
