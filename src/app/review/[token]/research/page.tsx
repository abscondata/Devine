import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getCurrentWorkSelection,
  getStandingLabel,
  getStandingStatus,
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

export default async function ReviewResearchPage({
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
    };
  });

  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseProgress.forEach((course) => {
    if (course.isComplete) {
      completedCourseIds.add(course.id);
    } else if (course.completedTasks > 0) {
      inProgressCourseIds.add(course.id);
    }
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

  const researchBlocks = blockSummaries.filter(
    (summary) => summary.block.category === "Research"
  );
  const researchBlockIds = new Set(researchBlocks.map((summary) => summary.block.id));
  const researchCourseIds = blockMappings
    .filter((mapping) => researchBlockIds.has(mapping.requirement_block_id))
    .map((mapping) => mapping.course_id);
  const researchCourses = courseProgress.filter((course) =>
    researchCourseIds.includes(course.id)
  );

  const rsynCourse = researchCourses.find((course) => course.code === "RSYN 720") ?? null;
  const thesisSummary =
    rsynCourse && thesisSummaryByCourseId.get(rsynCourse.id)
      ? thesisSummaryByCourseId.get(rsynCourse.id)
      : rsynCourse
      ? buildMissingThesisSummary()
      : null;

  const researchModuleIds = modules
    ?.filter((module) => researchCourseIds.includes(module.course_id))
    .map((module) => module.id) ?? [];
  const researchAssignments = assignments?.filter((assignment) =>
    researchModuleIds.includes(assignment.module_id)
  );
  const researchAssignmentIds = researchAssignments?.map((assignment) => assignment.id) ?? [];
  const researchFinals = finalSubmissions.filter((submission) =>
    researchAssignmentIds.includes(submission.assignment_id)
  );

  const researchModulesProgress =
    modules
      ?.filter((module) => researchCourseIds.includes(module.course_id))
      .map((module) => {
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

  const currentResearchWork = getCurrentWorkSelection({
    moduleProgress: researchModulesProgress,
    coursesById,
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    finalAssignmentIds: new Set(researchFinals.map((submission) => submission.assignment_id)),
  });

  const totalResearchCourses = researchCourses.length;
  const completedResearchCourses = researchCourses.filter((c) => c.isComplete).length;
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
          <Link href={`/review/${token}/record`}>Record</Link>
          <Link href={`/review/${token}/chronology`}>Chronology</Link>
          <Link href={`/review/${token}/work`}>Work</Link>
          <span className="text-[var(--text)]">Research</span>
          <Link href={`/review/${token}/thesis`}>Thesis</Link>
          <Link href={`/review/${token}/readiness`}>Readiness</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Research and Synthesis Register
        </p>
        <h1 className="text-3xl">Research Register</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{totalResearchCourses} research courses</span>
          <span>{completedResearchCourses} complete</span>
          {thesisSummary?.hasProject ? (
            <span>Thesis: {thesisSummary.requiredCompleted}/{thesisSummary.requiredTotal} milestones</span>
          ) : (
            <span>Thesis: not yet opened</span>
          )}
          {researchFinals.length > 0 ? (
            <span>{researchFinals.length} final submissions</span>
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Requirement standing ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Requirement Standing</h2>
        {researchBlocks.length ? (
          <div className="space-y-4">
            {researchBlocks.map((summary) => (
              <div
                key={summary.block.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-[var(--text)]">
                    {summary.block.title}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {summary.satisfied ? "Satisfied" : summary.hasActivity ? "In progress" : "Incomplete"}
                  </p>
                </div>
                {summary.block.description ? (
                  <p className="text-sm text-[var(--muted)]">{summary.block.description}</p>
                ) : null}
                <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{summary.completedCourseIds.length} of {summary.assignedCourseIds.length} courses complete</span>
                  {summary.block.minimum_courses_required ? (
                    <span>{summary.block.minimum_courses_required} required</span>
                  ) : null}
                  {summary.block.minimum_credits_required ? (
                    <span>{summary.completedCredits} of {summary.block.minimum_credits_required} credits</span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No research requirement block is recorded for this program.
          </p>
        )}
      </section>

      {/* ─── Research courses ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Research Courses</h2>
        {researchCourses.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {researchCourses.map((course) => (
              <Link
                key={course.id}
                href={`/review/${token}/courses/${course.id}`}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--surface-muted)]"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">
                    {course.code ? `${course.code} — ` : ""}{course.title}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    {course.completedTasks} of {course.totalTasks} tasks complete
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {getStandingLabel(course.status)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No research courses are mapped to this program.
          </p>
        )}
        <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}/readiness`}>Research readiness packet</Link>
        </div>
      </section>

      {/* ─── Thesis project ─── */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg">Thesis Project</h2>
          {rsynCourse ? (
            <Link
              href={`/review/${token}/thesis`}
              className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden"
            >
              View thesis dossier
            </Link>
          ) : null}
        </div>
        {rsynCourse ? (
          thesisSummary && thesisSummary.hasProject ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[var(--text)]">
                  {thesisSummary.statusLabel}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {thesisSummary.requiredCompleted}/{thesisSummary.requiredTotal} milestones
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>Candidacy: {thesisSummary.candidacyReady ? "Established" : "Not established"}</span>
                <span>Final thesis: {thesisSummary.finalThesisReady ? "Recorded" : "Pending"}</span>
                <span>Synthesis: {thesisSummary.finalSynthesisReady ? "Recorded" : "Pending"}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No thesis project has been opened for RSYN 720.
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            RSYN 720 is not recorded for this program.
          </div>
        )}
      </section>

      {/* ─── Current research work ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Current Research Work</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm space-y-2">
          {currentResearchWork.currentModule ? (
            <>
              <p className="font-semibold text-[var(--text)]">
                {currentResearchWork.currentModule.title}
              </p>
              {currentResearchWork.nextAction ? (
                <>
                  <p className="text-[var(--muted)]">{currentResearchWork.nextAction.title}</p>
                  <p className="text-xs text-[var(--muted)]">{currentResearchWork.nextAction.reason}</p>
                </>
              ) : (
                <p className="text-[var(--muted)]">All required work in the current research module is complete.</p>
              )}
            </>
          ) : (
            <p className="text-[var(--muted)]">No active research work is recorded.</p>
          )}
        </div>
      </section>

      {/* ─── Final research submissions ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Final Research Submissions</h2>
        {researchFinals.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {researchFinals.map((submission) => {
              const assignment = researchAssignments?.find(
                (item) => item.id === submission.assignment_id
              );
              return (
                <div
                  key={submission.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-sm">{assignment?.title ?? "Assignment"}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Final recorded {formatDate(submission.created_at)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No final research submissions are recorded.
          </div>
        )}
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · Research register · {totalResearchCourses} courses · {completedResearchCourses} complete · Generated {now}
        </p>
      </footer>
    </div>
  );
}
