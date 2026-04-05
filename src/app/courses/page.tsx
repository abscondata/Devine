import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getStandingStatus,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";

const levelOrder = ["Foundational", "Intermediate", "Advanced"];
const levelDescriptions: Record<string, string> = {
  Foundational:
    "The foundations sequence establishes philosophical method, fundamental theology, early Church history, and Scripture for the entire curriculum.",
  Intermediate:
    "Patristic, conciliar, ecclesial, and sacramental consolidation building on the foundations.",
  Advanced:
    "Specialized study in dogmatic theology, moral theology, spiritual theology, advanced Scripture and history, philosophy, and the research synthesis.",
};

export default async function CoursesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Resolve program
  const { data: ownedPrograms } = await supabase
    .from("programs")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const currentProgram = ownedPrograms?.[0] ?? null;

  // Program-scoped courses
  const { data: courses } = currentProgram
    ? await supabase
        .from("courses")
        .select("id, title, code, description, level, credits_or_weight, department_or_domain, sequence_position")
        .eq("program_id", currentProgram.id)
        .eq("is_active", true)
        .order("sequence_position", { ascending: true })
    : { data: null };

  const courseIds = (courses ?? []).map((c) => c.id);

  // Modules, readings, assignments, submissions for standing
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
    ? await supabase.from("submissions").select("id, assignment_id, is_final").eq("user_id", user.id).in("assignment_id", assignmentIds)
    : { data: [] };
  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = currentProgram
    ? await supabase.from("thesis_projects")
        .select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at")
        .eq("program_id", currentProgram.id)
    : { data: [] };
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

  // Per-module maps
  type ReadingRow = NonNullable<typeof readings>[number];
  type AssignmentRow = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, ReadingRow[]>();
  (readings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AssignmentRow[]>();
  (assignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  // Per-course standing
  const courseRecords = (courses ?? []).map((course) => {
    const courseModules = (modules ?? []).filter((m) => m.course_id === course.id);
    const thesisSummary = course.code === "RSYN 720"
      ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
      : null;
    const standing = getCourseStanding({ modules: courseModules, readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary });
    const status = getStandingStatus(standing.completion);
    return { ...course, status, isComplete: status === "completed", isInProgress: status === "in_progress" };
  });

  // Current term courses
  const { data: currentTerm } = currentProgram
    ? await supabase.from("academic_terms").select("id").eq("program_id", currentProgram.id).eq("is_current", true).maybeSingle()
    : { data: null };
  const { data: termCourseRows } = currentTerm
    ? await supabase.from("term_courses").select("course_id").eq("term_id", currentTerm.id)
    : { data: [] };
  const termCourseIds = new Set((termCourseRows ?? []).map((r) => r.course_id));

  // Group by level
  type CourseRecord = (typeof courseRecords)[number];
  const grouped = new Map<string, CourseRecord[]>();
  courseRecords.forEach((course) => {
    const level = course.level ?? "Other";
    const list = grouped.get(level) ?? [];
    list.push(course);
    grouped.set(level, list);
  });

  const orderedLevels = [
    ...levelOrder.filter((l) => grouped.has(l)),
    ...Array.from(grouped.keys()).filter((l) => !levelOrder.includes(l)),
  ];

  // Credits
  const totalCredits = courseRecords.reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const earnedCredits = courseRecords.filter((c) => c.isComplete).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const completedCount = courseRecords.filter((c) => c.isComplete).length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {currentProgram?.title ?? "Devine College"}
          </p>
          <h1 className="text-3xl">Course Catalog</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{courseRecords.length} courses</span>
            <span>{totalCredits} total credits</span>
            <span>{completedCount} complete · {earnedCredits} credits earned</span>
          </div>
        </header>

        {orderedLevels.map((level) => {
          const levelCourses = grouped.get(level) ?? [];
          const description = levelDescriptions[level] ?? "";

          return (
            <section key={level} className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-lg">{level}</h2>
                {description ? <p className="text-sm text-[var(--muted)]">{description}</p> : null}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {levelCourses.map((course) => {
                  const inTerm = termCourseIds.has(course.id);
                  let statusLabel: string;
                  if (course.isComplete) statusLabel = "Complete";
                  else if (inTerm) statusLabel = "Current term";
                  else if (course.isInProgress) statusLabel = "In progress";
                  else statusLabel = "";

                  return (
                    <Link
                      key={course.id}
                      href={`/courses/${course.id}`}
                      className="block p-5 transition hover:bg-[var(--surface-muted)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-0.5">
                          <h3 className="text-base font-semibold">
                            {course.code ? `${course.code} — ` : ""}
                            {course.title}
                          </h3>
                          <p className="text-xs text-[var(--muted)]">
                            {[
                              course.credits_or_weight ? `${course.credits_or_weight} credits` : null,
                              course.department_or_domain,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        {statusLabel ? (
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                            {statusLabel}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        <section className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {currentProgram ? (
            <>
              <Link href={`/programs/${currentProgram.id}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
              <Link href={`/programs/${currentProgram.id}/record`} className="hover:text-[var(--text)]">Academic record</Link>
            </>
          ) : null}
        </section>
      </div>
    </ProtectedShell>
  );
}
