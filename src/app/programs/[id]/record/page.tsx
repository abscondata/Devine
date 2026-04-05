import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import { ReviewShell } from "@/components/review-shell";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProgramRecordPage({
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

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  const { data: requirementBlocks } = await supabase
    .from("requirement_blocks")
    .select(
      "id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position"
    )
    .eq("program_id", id)
    .order("position", { ascending: true });

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight, sequence_position")
    .eq("program_id", id)
    .order("sequence_position", { ascending: true });

  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await supabase
        .from("course_requirement_blocks")
        .select("requirement_block_id, course_id")
        .in("requirement_block_id", blockIds)
    : { data: [] };

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
    : { data: [] };

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

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, status")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title")
        .in("module_id", moduleIds)
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
    )
    .eq("program_id", id);

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

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: "/programs", label: "Programs" }}
        documentType="Official Academic Record"
        title={program.title}
        description={program.description ?? "Formal record of constitutional standing and course progress."}
        recordDate={recordDate}
        actions={[
          { href: `/programs/${program.id}/charter`, label: "Program charter" },
          { href: `/programs/${program.id}/work`, label: "Academic work record" },
          { href: `/programs/${program.id}/research`, label: "Research register" },
          { href: `/programs/${program.id}/chronology`, label: "Academic chronology" },
          { href: `/programs/${program.id}/review`, label: "Program review packet" },
        ]}
      >
        <DocumentSection title="Program Standing">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Total blocks {programSummary.totalBlocks}</span>
              <span>Satisfied {programSummary.satisfiedBlocks}</span>
              <span>Remaining {programSummary.remainingBlocks}</span>
            </div>
            <p>
              Requirement blocks define constitutional completion. A block is satisfied
              only when its minimum course or credit threshold is met through officially
              completed courses.
            </p>
          </div>
        </DocumentSection>

        <DocumentSection title="Transcript">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[140px_1fr_160px_160px]">
              <span>Course</span>
              <span>Title</span>
              <span>Status</span>
              <span>Final Date</span>
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
                    <Link href={`/courses/${course.id}/dossier`}>
                      Course dossier
                    </Link>
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
      </DocumentSection>

        <DocumentSection title="Course Standing Summary">
          <div className="grid gap-4 md:grid-cols-3 text-sm text-[var(--muted)]">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
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
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2">
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
        </DocumentSection>

        <DocumentSection title="Current Work">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            {currentWork.currentModule ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {currentWork.currentModule.title ?? "Current module"}
                </p>
                {currentWork.nextAction ? (
                  <>
                    <p>{currentWork.nextAction.title}</p>
                    <p>{currentWork.nextAction.reason}</p>
                  </>
                ) : (
                  <p>All required work in the current module is complete.</p>
                )}
              </>
            ) : (
              <p>No active module work is in progress.</p>
            )}
          </div>
        </DocumentSection>

        <DocumentSection title="Recommended Next Course">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            {recommendedNext ? (
              <p className="text-sm font-semibold text-[var(--text)]">
                {recommendedNext.code ? `${recommendedNext.code} — ` : ""}
                {recommendedNext.title}
              </p>
            ) : (
              <p>No ready course is available without prerequisite completion.</p>
            )}
          </div>
        </DocumentSection>
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
