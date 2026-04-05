import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getProgramRequirementSummary,
  getStandingStatus,
  summarizeRequirementBlocks,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { ProtectedShell } from "@/components/protected-shell";

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

  // All courses in program
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight, level, sequence_position")
    .eq("program_id", id)
    .eq("is_active", true)
    .order("sequence_position", { ascending: true });

  const courseIds = (courses ?? []).map((c) => c.id);

  // Modules, readings, assignments, submissions, critiques
  const { data: modules } = courseIds.length
    ? await supabase.from("modules").select("id, course_id").in("course_id", courseIds)
    : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: readings } = moduleIds.length
    ? await supabase.from("readings").select("id, module_id, status").in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase.from("assignments").select("id, module_id").in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase.from("submissions").select("id, assignment_id, is_final, created_at").eq("user_id", user.id).in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((s) => s.is_final);
  const finalSubmissionIds = finalSubmissions.map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase
    .from("thesis_projects")
    .select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at")
    .eq("program_id", id);
  const thesisProjectIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = thesisProjectIds.length
    ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", thesisProjectIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubmissionIds),
  });

  // Build per-module maps
  type ReadingRow = NonNullable<typeof readings>[number];
  type AssignmentRow = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, ReadingRow[]>();
  (readings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AssignmentRow[]>();
  (assignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const moduleToCourse = new Map<string, string>();
  (modules ?? []).forEach((m) => moduleToCourse.set(m.id, m.course_id));
  const assignmentToCourse = new Map<string, string>();
  (assignments ?? []).forEach((a) => { const cid = moduleToCourse.get(a.module_id); if (cid) assignmentToCourse.set(a.id, cid); });

  // Final dates per course
  const courseFinalDates = new Map<string, string>();
  finalSubmissions.forEach((s) => {
    const cid = assignmentToCourse.get(s.assignment_id);
    if (!cid) return;
    const existing = courseFinalDates.get(cid);
    if (!existing || new Date(s.created_at) > new Date(existing)) courseFinalDates.set(cid, s.created_at);
  });

  // Per-course standing
  const courseRecords = (courses ?? []).map((course) => {
    const courseModules = (modules ?? []).filter((m) => m.course_id === course.id);
    const thesisSummary = course.code === "RSYN 720"
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
      isComplete: status === "completed",
      finalDate: courseFinalDates.get(course.id) ?? null,
    };
  });

  // Requirement blocks
  const { data: requirementBlocks } = await supabase
    .from("requirement_blocks")
    .select("id, program_id, title, minimum_courses_required, minimum_credits_required, position")
    .eq("program_id", id)
    .order("position", { ascending: true });
  const blockIds = (requirementBlocks ?? []).map((b) => b.id);
  const { data: blockMappingRows } = blockIds.length
    ? await supabase.from("course_requirement_blocks").select("requirement_block_id, course_id").in("requirement_block_id", blockIds)
    : { data: [] };

  const completedCourseIds = new Set(courseRecords.filter((c) => c.isComplete).map((c) => c.id));
  const inProgressCourseIds = new Set(courseRecords.filter((c) => !c.isComplete && c.status === "in_progress").map((c) => c.id));
  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));

  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: (blockMappingRows ?? []).map((m) => ({ requirement_block_id: m.requirement_block_id, course_id: m.course_id })),
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });
  const programSummary = getProgramRequirementSummary(blockSummaries);

  // Credits
  const creditsEarned = courseRecords.filter((c) => c.isComplete).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const totalCreditsRequired = (requirementBlocks ?? []).reduce((s, b) => s + (b.minimum_credits_required ?? 0), 0);
  const totalFinals = finalSubmissions.length;
  const completedCount = courseRecords.filter((c) => c.isComplete).length;
  const inProgressCount = courseRecords.filter((c) => c.status === "in_progress").length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title}
          </p>
          <h1 className="text-3xl">Academic Record</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{completedCount} courses complete</span>
            <span>{inProgressCount} in progress</span>
            <span>{creditsEarned} of {totalCreditsRequired} credits earned</span>
            <span>{totalFinals} final submissions</span>
            <span>{programSummary.satisfiedBlocks} of {programSummary.totalBlocks} blocks satisfied</span>
          </div>
        </header>

        {/* ─── Transcript ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Transcript</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {courseRecords.map((course) => (
              <div key={course.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{course.code ? `${course.code} — ` : ""}{course.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {course.credits_or_weight ? `${course.credits_or_weight} credits` : ""}
                    {course.level ? ` · ${course.level}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {course.isComplete ? "Complete" : course.status === "in_progress" ? "In progress" : "Not started"}
                  </p>
                  {course.isComplete && course.finalDate ? (
                    <p className="text-xs text-[var(--muted)]">{formatDate(course.finalDate)}</p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Requirement blocks ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Requirement Blocks</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {blockSummaries.map((summary) => (
              <div key={summary.block.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{summary.block.title}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {summary.completedCourseIds.length} of {summary.block.minimum_courses_required ?? "?"} courses
                    {summary.block.minimum_credits_required ? ` · ${summary.completedCredits} of ${summary.block.minimum_credits_required} credits` : ""}
                  </p>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                  {summary.satisfied ? "Satisfied" : summary.status === "in progress" ? "In progress" : "Incomplete"}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Links ─── */}
        <section className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <Link href={`/programs/${program.id}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
          <Link href={`/programs/${program.id}/work`} className="hover:text-[var(--text)]">Submissions</Link>
          <Link href={`/programs/${program.id}/chronology`} className="hover:text-[var(--text)]">Chronology</Link>
          <Link href={`/programs/${program.id}/charter`} className="hover:text-[var(--text)]">Program charter</Link>
        </section>
      </div>
    </ProtectedShell>
  );
}
