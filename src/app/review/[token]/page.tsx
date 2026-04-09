import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getStandingLabel,
  getStandingStatus,
  getProgramRequirementSummary,
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

export default async function ReviewPacketPage({
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

  // Courses
  const { data: courses } = await admin
    .from("courses")
    .select("id, code, title, credits_or_weight, sequence_position")
    .eq("program_id", program.id)
    .order("sequence_position", { ascending: true });

  // Requirement blocks
  const { data: requirementBlocks } = await admin
    .from("requirement_blocks")
    .select("id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position")
    .eq("program_id", program.id)
    .order("position", { ascending: true });

  const blockIds = requirementBlocks?.map((b) => b.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await admin.from("course_requirement_blocks").select("requirement_block_id, course_id").in("requirement_block_id", blockIds)
    : { data: [] };

  // Modules, readings, assignments, submissions, critiques
  const courseIds = courses?.map((c) => c.id) ?? [];
  const { data: modules } = courseIds.length
    ? await admin.from("modules").select("id, course_id, title, position").in("course_id", courseIds)
    : { data: [] };

  const moduleIds = modules?.map((m) => m.id) ?? [];
  const { data: readings } = moduleIds.length
    ? await admin.from("readings").select("id, module_id, title, status").in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await admin.from("assignments").select("id, module_id, title").in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((a) => a.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await admin.from("submissions").select("id, assignment_id, is_final, created_at").eq("user_id", program.owner_id).in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((s) => s.is_final);
  const finalSubmissionIds = finalSubmissions.map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await admin.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] };

  // Thesis
  const { data: thesisProjects } = await admin
    .from("thesis_projects")
    .select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at")
    .eq("program_id", program.id);

  const tpIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = tpIds.length
    ? await admin.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", tpIds)
    : { data: [] };

  // Current term
  const { data: currentTerm } = await admin
    .from("academic_terms")
    .select("id, title, starts_at, ends_at")
    .eq("program_id", program.id)
    .eq("is_current", true)
    .maybeSingle();

  // Compute standing
  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubmissionIds),
  });

  const readingsByModule = new Map<string, typeof readings>();
  readings?.forEach((r) => {
    const list = readingsByModule.get(r.module_id) ?? [];
    list.push(r);
    readingsByModule.set(r.module_id, list);
  });

  const assignmentsByModule = new Map<string, typeof assignments>();
  assignments?.forEach((a) => {
    const list = assignmentsByModule.get(a.module_id) ?? [];
    list.push(a);
    assignmentsByModule.set(a.module_id, list);
  });

  const modulesByCourse = new Map<string, { id: string }[]>();
  modules?.forEach((m) => {
    const list = modulesByCourse.get(m.course_id) ?? [];
    list.push({ id: m.id });
    modulesByCourse.set(m.course_id, list);
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
  courseProgress.forEach((c) => {
    if (c.isComplete) completedCourseIds.add(c.id);
    else if (c.completedTasks > 0) inProgressCourseIds.add(c.id);
  });

  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));
  const blockMappings = (mappings ?? []).map((m) => ({
    requirement_block_id: m.requirement_block_id,
    course_id: m.course_id,
  }));

  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings,
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });

  const programSummary = getProgramRequirementSummary(blockSummaries);

  const rsynCourse = (courses ?? []).find((c) => c.code === "RSYN 720") ?? null;
  const thesisSummary = rsynCourse
    ? thesisSummaryByCourseId.get(rsynCourse.id) ?? buildMissingThesisSummary()
    : null;

  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const completedCount = completedCourseIds.size;
  const inProgressCount = inProgressCourseIds.size;
  const totalReadings = (readings ?? []).length;
  const completedReadings = (readings ?? []).filter((r) => r.status === "complete").length;
  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Institutional Review Dossier
        </p>
        <h1 className="text-3xl">Program Review Packet</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{(courses ?? []).length} courses · {totalCredits} credits</span>
          <span>{completedCount} complete · {inProgressCount} in progress</span>
          <span>{finalSubmissions.length} final submissions</span>
          <span>{programSummary.satisfiedBlocks}/{programSummary.totalBlocks} requirement blocks satisfied</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Institutional overview ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Institutional Overview</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">
            Devine College Core is a private, single-student academic program in Catholic theology,
            philosophy, Scripture, and Church history. It emphasizes structured study of primary texts,
            disciplined writing with institutional critique, and audited completion against formal
            requirement blocks.
          </p>
          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">
            This review packet gathers the formal institutional records that document the program's
            standards, curriculum, and recorded academic work. It is not a marketing document. Every
            surface referenced below draws from the same truthful data that governs the student's
            academic standing.
          </p>
          {program.description ? (
            <div className="border-t border-[var(--border)] pt-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Program description</p>
              <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{program.description}</p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── Academic standing ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Academic Standing</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>Requirement blocks: {programSummary.satisfiedBlocks} of {programSummary.totalBlocks} satisfied</span>
            <span>Courses: {completedCount} complete · {inProgressCount} in progress</span>
            <span>Readings: {completedReadings} of {totalReadings} complete</span>
            <span>Finals: {finalSubmissions.length} · Critiqued: {critiques?.length ?? 0}</span>
          </div>
          {currentTerm ? (
            <div className="border-t border-[var(--border)] pt-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Current term</p>
              <p className="text-sm text-[var(--muted)]">
                {currentTerm.title}{currentTerm.starts_at ? ` · ${formatDate(currentTerm.starts_at)}` : ""}{currentTerm.ends_at ? ` – ${formatDate(currentTerm.ends_at)}` : ""}
              </p>
            </div>
          ) : null}
          {thesisSummary ? (
            <div className="border-t border-[var(--border)] pt-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Thesis status</p>
              <p className="text-sm text-[var(--muted)]">
                {thesisSummary.hasProject
                  ? `${thesisSummary.statusLabel} · ${thesisSummary.requiredCompleted}/${thesisSummary.requiredTotal} milestones · Candidacy: ${thesisSummary.candidacyReady ? "Established" : "Not established"}`
                  : "No thesis project opened"}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── Document hierarchy ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Formal Records</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
          <Link
            href={`/review/${token}/charter`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Program Charter</p>
              <p className="text-xs text-[var(--muted)]">Institutional constitution, completion standards, and requirement block definitions</p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
              {programSummary.totalBlocks} blocks
            </p>
          </Link>
          <Link
            href={`/review/${token}/record`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Academic Record</p>
              <p className="text-xs text-[var(--muted)]">Course transcript, requirement standing, and program progress</p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
              {completedCount} of {(courses ?? []).length} courses complete
            </p>
          </Link>
          <Link
            href={`/review/${token}/research`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Research Register</p>
              <p className="text-xs text-[var(--muted)]">Research formation, synthesis work, and capstone status</p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
              {thesisSummary?.hasProject ? thesisSummary.statusLabel : "No thesis"}
            </p>
          </Link>
          <Link
            href={`/review/${token}/thesis`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Thesis Dossier</p>
              <p className="text-xs text-[var(--muted)]">Terminal synthesis project, milestones, research question and scope</p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
              {thesisSummary ? `${thesisSummary.requiredCompleted}/${thesisSummary.requiredTotal} milestones` : "—"}
            </p>
          </Link>
          <Link
            href={`/review/${token}/readiness`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Research Readiness Packet</p>
              <p className="text-xs text-[var(--muted)]">Prerequisite truth and eligibility determination for the research sequence</p>
            </div>
          </Link>
          <Link
            href={`/review/${token}/work`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Academic Work Record</p>
              <p className="text-xs text-[var(--muted)]">Finalized submissions and critique status</p>
            </div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
              {finalSubmissions.length} finals · {critiques?.length ?? 0} critiqued
            </p>
          </Link>
          <Link
            href={`/review/${token}/chronology`}
            className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Academic Chronology</p>
              <p className="text-xs text-[var(--muted)]">Timeline of final submissions, critiques, and completion milestones</p>
            </div>
          </Link>
        </div>
      </section>

      {/* ─── Course index ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Course Index</h2>
        {courseProgress.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {courseProgress.map((course) => (
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
                    {course.credits_or_weight ? `${course.credits_or_weight} credits · ` : ""}{course.completedTasks} of {course.totalTasks} tasks complete
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {getStandingLabel(course.status)}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No courses are recorded.</p>
        )}
      </section>

      {/* ─── Requirement blocks ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Requirement Standing</h2>
        {blockSummaries.length ? (
          <div className="space-y-3">
            {blockSummaries.map((summary) => (
              <div
                key={summary.block.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-[var(--text)]">{summary.block.title}</p>
                    {summary.block.category ? (
                      <p className="text-xs text-[var(--muted)]">{summary.block.category}</p>
                    ) : null}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {summary.satisfied ? "Satisfied" : summary.hasActivity ? "In progress" : "Incomplete"}
                  </p>
                </div>
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
          <p className="text-sm text-[var(--muted)]">No requirement blocks are recorded.</p>
        )}
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · Institutional review dossier · {(courses ?? []).length} courses · {completedCount} complete · {programSummary.satisfiedBlocks}/{programSummary.totalBlocks} blocks satisfied · Generated {now}
        </p>
      </footer>
    </div>
  );
}
