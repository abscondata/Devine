import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getProgramRequirementSummary,
  getStandingStatus,
  getTranscriptLiteSummary,
  buildReadinessByCourse,
  summarizeRequirementBlocks,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { checkAdminAccess } from "@/lib/admin-gate";
import { ProtectedShell } from "@/components/protected-shell";

type CourseStatus = "completed" | "in_progress" | "not_started";

function formatStatus(status: CourseStatus) {
  if (status === "completed") return "Complete";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export default async function ProgramAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const isAdmin = await checkAdminAccess(supabase, user.id);

  const { data: program } = await supabase.from("programs").select("id, title, description").eq("id", id).single();
  if (!program) notFound();

  const { data: requirementBlocks } = await supabase.from("requirement_blocks").select("id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position").eq("program_id", id).order("position", { ascending: true });
  const { data: courses } = await supabase.from("courses").select("id, title, code, credits_or_weight").eq("program_id", id).order("title");

  const blockIds = requirementBlocks?.map((b) => b.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await supabase.from("course_requirement_blocks").select("requirement_block_id, course:course_id(id, title, code, credits_or_weight)").in("requirement_block_id", blockIds)
    : { data: [] };

  const courseIds = courses?.map((c) => c.id) ?? [];
  const { data: modules } = courseIds.length ? await supabase.from("modules").select("id, course_id").in("course_id", courseIds) : { data: [] };
  const { data: prerequisiteMappings } = courseIds.length ? await supabase.from("course_prerequisites").select("course_id, prerequisite:prerequisite_course_id(id, title, code)").in("course_id", courseIds) : { data: [] };

  const prereqsByCourse = new Map<string, { id: string; title: string; code: string | null }[]>();
  prerequisiteMappings?.forEach((m) => { if (!m.prerequisite) return; const l = prereqsByCourse.get(m.course_id) ?? []; l.push(m.prerequisite); prereqsByCourse.set(m.course_id, l); });

  const moduleIds = modules?.map((m) => m.id) ?? [];
  const { data: readings } = moduleIds.length ? await supabase.from("readings").select("id, module_id, status").in("module_id", moduleIds) : { data: [] };
  const { data: assignments } = moduleIds.length ? await supabase.from("assignments").select("id, module_id").in("module_id", moduleIds) : { data: [] };
  const assignmentIds = assignments?.map((a) => a.id) ?? [];
  const { data: submissions } = assignmentIds.length ? await supabase.from("submissions").select("id, assignment_id, is_final, created_at").eq("user_id", user.id).in("assignment_id", assignmentIds) : { data: [] };
  const finalSubmissions = (submissions ?? []).filter((s) => s.is_final);
  const finalSubmissionIds = finalSubmissions.map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds) : { data: [] };

  const { data: thesisProjects } = await supabase.from("thesis_projects").select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at").eq("program_id", id);
  const thesisProjectIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = thesisProjectIds.length ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", thesisProjectIds) : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({ projects: thesisProjects ?? [], milestones: thesisMilestones ?? [], finalSubmissionIds: new Set(finalSubmissionIds) });

  const modulesByCourse = new Map<string, { id: string }[]>();
  modules?.forEach((m) => { const l = modulesByCourse.get(m.course_id) ?? []; l.push(m); modulesByCourse.set(m.course_id, l); });
  const readingsByModule = new Map<string, typeof readings>();
  readings?.forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, typeof assignments>();
  assignments?.forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const courseProgress = new Map<string, { status: CourseStatus; completedTasks: number; totalTasks: number; finalAssignments: number; totalAssignments: number }>();
  (courses ?? []).forEach((course) => {
    const cm = modulesByCourse.get(course.id) ?? [];
    const ts = course.code === "RSYN 720" ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary() : null;
    const standing = getCourseStanding({ modules: cm, readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary: ts });
    const status = getStandingStatus(standing.completion);
    courseProgress.set(course.id, { status, completedTasks: standing.completion.completedTasks, totalTasks: standing.completion.totalTasks, finalAssignments: standing.assignmentSummary.finalAssignments, totalAssignments: standing.assignmentSummary.totalAssignments });
  });

  const completionByCourse = new Map<string, boolean>();
  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseProgress.forEach((p, cid) => {
    const done = p.status === "completed";
    completionByCourse.set(cid, done);
    if (done) completedCourseIds.add(cid);
    else if (p.status === "in_progress") inProgressCourseIds.add(cid);
  });
  const readinessByCourse = buildReadinessByCourse({ courseIds, prereqsByCourse, completionByCourse });

  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));
  const blockMappingList: { requirement_block_id: string; course_id: string }[] = [];
  const coursesByBlock = new Map<string, { id: string; title: string; code: string | null; credits_or_weight: number | null }[]>();
  mappings?.forEach((m) => {
    if (!m.course || !("title" in m.course)) return;
    const c = m.course as unknown as { id: string; title: string; code: string | null; credits_or_weight: number | null };
    const l = coursesByBlock.get(m.requirement_block_id) ?? [];
    l.push(c);
    coursesByBlock.set(m.requirement_block_id, l);
    blockMappingList.push({ requirement_block_id: m.requirement_block_id, course_id: c.id });
  });

  const blockProgress = summarizeRequirementBlocks({ blocks: requirementBlocks ?? [], mappings: blockMappingList, coursesById, completedCourseIds, inProgressCourseIds });
  const blockProgressById = new Map(blockProgress.map((s) => [s.block.id, s]));
  const programReqSummary = getProgramRequirementSummary(blockProgress);

  const blockSummaries = (requirementBlocks ?? []).map((block) => {
    const progress = blockProgressById.get(block.id);
    const assignedCourses = (coursesByBlock.get(block.id) ?? []).map((c) => {
      const p = courseProgress.get(c.id);
      return { ...c, status: (p?.status ?? "not_started") as CourseStatus };
    });
    return {
      block,
      assignedCourses,
      satisfied: progress?.satisfied ?? false,
      status: progress?.status ?? "incomplete",
      completedCredits: progress?.completedCredits ?? 0,
      completedCourseCount: progress?.completedCourseIds.length ?? 0,
    };
  });

  const categoryOrder = ["Foundations", "Core", "Advanced", "Capstone"];
  const blocksByCategory = new Map<string, typeof blockSummaries>();
  blockSummaries.forEach((s) => { const cat = s.block.category ?? "Uncategorized"; const l = blocksByCategory.get(cat) ?? []; l.push(s); blocksByCategory.set(cat, l); });
  const orderedCategories = [...categoryOrder.filter((c) => blocksByCategory.has(c)), ...Array.from(blocksByCategory.keys()).filter((c) => !categoryOrder.includes(c))];

  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const earnedCredits = Array.from(completedCourseIds).reduce((s, cid) => s + (coursesById.get(cid)?.credits_or_weight ?? 0), 0);

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title}
          </p>
          <h1 className="text-3xl">Degree Audit</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{completedCourseIds.size} of {(courses ?? []).length} courses complete</span>
            <span>{earnedCredits} of {totalCredits} credits</span>
            <span>{programReqSummary.satisfiedBlocks}/{programReqSummary.totalBlocks} blocks satisfied</span>
          </div>
          {program.description ? (
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{program.description}</p>
          ) : null}
        </header>

        {/* ─── Program standing ─── */}
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Program standing</p>
          <p className="text-sm text-[var(--muted)]">
            Completion requires all requirement blocks satisfied. A block is satisfied when its minimum course and credit thresholds are met through officially completed courses. Official course completion requires all readings complete and all written work finalized.
          </p>
        </section>

        {/* ─── Requirement blocks by category ─── */}
        {orderedCategories.map((category) => {
          const summaries = blocksByCategory.get(category) ?? [];
          return (
            <section key={category} className="space-y-4">
              <div className="border-b border-[var(--border)] pb-2">
                <h2 className="text-lg">{category}</h2>
              </div>

              {summaries.map(({ block, assignedCourses, satisfied, status, completedCredits, completedCourseCount }) => (
                <div key={block.id} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <h3 className="text-base font-semibold">{block.title}</h3>
                      {block.description ? (
                        <p className="text-xs text-[var(--muted)]">{block.description}</p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                      {satisfied ? "Satisfied" : status === "in progress" ? "In progress" : "Incomplete"}
                    </p>
                  </div>

                  {/* Block requirement row */}
                  <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {block.minimum_courses_required !== null ? (
                      <span>{completedCourseCount} of {block.minimum_courses_required} courses</span>
                    ) : null}
                    {block.minimum_credits_required !== null ? (
                      <span>{completedCredits} of {block.minimum_credits_required} credits</span>
                    ) : null}
                    {isAdmin ? (
                      <Link href={`/programs/${program.id}/requirements/${block.id}/edit`} className="hover:text-[var(--text)]">Edit</Link>
                    ) : null}
                  </div>

                  {/* Assigned courses */}
                  {assignedCourses.length ? (
                    <div className="divide-y divide-[var(--border)] pl-4 border-l-2 border-[var(--border)]">
                      {assignedCourses.map((course) => (
                        <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                          <span className="text-[var(--muted)]">
                            {course.code ? `${course.code} — ` : ""}{course.title}
                            {course.credits_or_weight ? <span className="text-xs ml-1">({course.credits_or_weight} cr)</span> : null}
                          </span>
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            {formatStatus(course.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)] pl-4">No courses assigned.</p>
                  )}
                </div>
              ))}
            </section>
          );
        })}

        {!blockSummaries.length ? (
          <p className="text-sm text-[var(--muted)]">
            No requirement blocks have been established for this program.
          </p>
        ) : null}

        {/* ─── Admin link ─── */}
        {isAdmin ? (
          <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href={`/programs/${program.id}/requirements/new`} className="hover:text-[var(--text)]">Add requirement block</Link>
          </nav>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
