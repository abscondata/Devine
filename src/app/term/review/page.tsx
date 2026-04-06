import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getFinalAssignmentSet,
  getStandingStatus,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import {
  computeTermSchedule,
  formatScheduleDate,
  type TermAssignmentScheduleRow,
} from "@/lib/term-schedule";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function TermReviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownedPrograms } = await supabase.from("programs").select("id, title, description").eq("owner_id", user.id).limit(1);
  const program = ownedPrograms?.[0];
  if (!program) return <ProtectedShell userEmail={user.email ?? null}><p className="text-sm text-[var(--muted)]">No program.</p></ProtectedShell>;

  const { data: currentTerm } = await supabase.from("academic_terms").select("id, title, starts_at, ends_at").eq("program_id", program.id).eq("is_current", true).maybeSingle();
  if (!currentTerm) return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-4"><h1 className="text-3xl">Term Review</h1><p className="text-sm text-[var(--muted)]">No active term.</p></div>
    </ProtectedShell>
  );

  const { data: tcRows } = await supabase.from("term_courses").select("course_id").eq("term_id", currentTerm.id);
  const tcIds = (tcRows ?? []).map((r) => r.course_id);

  const { data: courses } = tcIds.length
    ? await supabase.from("courses").select("id, title, code, credits_or_weight, level, sequence_position").in("id", tcIds).order("sequence_position", { ascending: true })
    : { data: [] };
  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules } = courseIds.length ? await supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds).order("position", { ascending: true }) : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: readings } = moduleIds.length ? await supabase.from("readings").select("id, module_id, title, author, status, position").in("module_id", moduleIds).order("position", { ascending: true }) : { data: [] };
  const { data: assignments } = moduleIds.length ? await supabase.from("assignments").select("id, module_id, title, assignment_type").in("module_id", moduleIds) : { data: [] };
  const aIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = aIds.length ? await supabase.from("submissions").select("id, assignment_id, version, is_final, created_at").eq("user_id", user.id).in("assignment_id", aIds).order("version", { ascending: false }) : { data: [] };
  const finalSubs = (submissions ?? []).filter((s) => s.is_final);
  const finalSubIds = finalSubs.map((s) => s.id);
  const { data: critiques } = finalSubIds.length ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubIds) : { data: [] };

  const { data: thesisProjects } = await supabase.from("thesis_projects").select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at").eq("program_id", program.id);
  const tpIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = tpIds.length ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", tpIds) : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = getFinalAssignmentSet(assignmentStatus);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({ projects: thesisProjects ?? [], milestones: thesisMilestones ?? [], finalSubmissionIds: new Set(finalSubIds) });

  type RR = NonNullable<typeof readings>[number];
  type AR = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, RR[]>();
  (readings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AR[]>();
  (assignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const { data: scheduleRows } = await supabase.from("term_assignment_schedule").select("assignment_id, default_due_at, current_due_at, revised_at").eq("term_id", currentTerm.id);
  const schedByAssignment = new Map<string, TermAssignmentScheduleRow>();
  (scheduleRows ?? []).forEach((r) => schedByAssignment.set(r.assignment_id, r));

  const schedule = currentTerm.starts_at && currentTerm.ends_at
    ? computeTermSchedule({ termStartsAt: currentTerm.starts_at, termEndsAt: currentTerm.ends_at, courses: (courses ?? []).map((c) => ({ id: c.id, modules: (modules ?? []).filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, position: m.position })) })) })
    : null;

  const critiqueSet = new Set((critiques ?? []).map((c) => c.submission_id));
  type SubRow = NonNullable<typeof submissions>[number];
  const subsByAssignment = new Map<string, SubRow[]>();
  (submissions ?? []).forEach((s) => { const l = subsByAssignment.get(s.assignment_id) ?? []; l.push(s); subsByAssignment.set(s.assignment_id, l); });

  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);
  const totalReadings = (readings ?? []).length;
  const completedReadings = (readings ?? []).filter((r) => r.status === "complete").length;
  const totalFinals = finalSubs.length;
  const totalCritiqued = finalSubs.filter((s) => critiqueSet.has(s.id)).length;
  const now = formatDate(new Date().toISOString());

  const courseDetails = (courses ?? []).map((course) => {
    const mods = (modules ?? []).filter((m) => m.course_id === course.id).sort((a, b) => a.position - b.position);
    const thesisSummary = course.code === "RSYN 720" ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary() : null;
    const standing = getCourseStanding({ modules: mods, readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary });
    const status = getStandingStatus(standing.completion);
    return { course, mods, status, isComplete: status === "completed", standing };
  });

  const allComplete = courseDetails.every((d) => d.isComplete);

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10 max-w-4xl print:max-w-none">

        {/* ─── Document header ─── */}
        <header className="space-y-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
            <Link href="/term">Term</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {program.title} · Term Review Packet
          </p>
          <h1 className="text-3xl">{currentTerm.title}</h1>
          <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{formatDate(currentTerm.starts_at)} – {formatDate(currentTerm.ends_at)}</span>
            {schedule ? <span>Week {schedule.currentWeek} of {schedule.totalWeeks}</span> : null}
            <span>{(courses ?? []).length} courses · {totalCredits} credits</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Generated {now}</p>
        </header>

        {/* ─── Summary ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Term Summary</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Readings: {completedReadings} of {totalReadings} complete</span>
              <span>Final submissions: {totalFinals}</span>
              <span>Critiqued: {totalCritiqued}</span>
              <span>Term status: {allComplete ? "All courses complete" : `${courseDetails.filter((d) => !d.isComplete).length} incomplete`}</span>
            </div>
          </div>
        </section>

        {/* ─── Per-course detail ─── */}
        {courseDetails.map(({ course, mods, status, isComplete, standing }) => (
          <section key={course.id} className="space-y-4">
            <div className="space-y-1 border-b border-[var(--border)] pb-3">
              <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>{course.code}</span>
                <span>{course.credits_or_weight} credits</span>
                <span>{isComplete ? "Complete" : status === "in_progress" ? "In progress" : "Not started"}</span>
              </div>
              <h2 className="text-xl">{course.title}</h2>
            </div>

            {mods.map((mod) => {
              const unitReadings = readingsByModule.get(mod.id) ?? [];
              const unitAssignments = assignmentsByModule.get(mod.id) ?? [];
              const unitSched = schedule?.unitSchedules.get(mod.id);

              return (
                <div key={mod.id} className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-base font-semibold">Unit {mod.position + 1}: {mod.title}</h3>
                    {unitSched ? <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{formatScheduleDate(unitSched.startsAt)} – {formatScheduleDate(unitSched.endsAt)}</p> : null}
                  </div>

                  {unitReadings.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                      <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                        {unitReadings.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => (
                          <li key={r.id} className={r.status === "complete" ? "line-through opacity-50" : ""}>
                            {r.author ? `${r.author}, ` : ""}{r.title}
                            <span className="text-xs uppercase tracking-[0.2em]"> · {r.status === "complete" ? "Complete" : r.status?.replace(/_/g, " ") ?? "Not started"}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {unitAssignments.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                      <ul className="space-y-1 text-sm">
                        {unitAssignments.map((a) => {
                          const aStatus = assignmentStatus.get(a.id);
                          const isFinal = aStatus?.hasFinal;
                          const subs = subsByAssignment.get(a.id) ?? [];
                          const finalSub = subs.find((s) => s.is_final);
                          const hasCrit = finalSub ? critiqueSet.has(finalSub.id) : false;
                          const schedRow = schedByAssignment.get(a.id);
                          const dueDate = schedRow ? new Date(schedRow.current_due_at) : null;
                          const isRevised = Boolean(schedRow?.revised_at);

                          return (
                            <li key={a.id} className={`${isFinal ? "text-[var(--muted)]" : "font-semibold"}`}>
                              {a.title}
                              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                {" "}· {a.assignment_type.replace(/_/g, " ")}
                                {isFinal ? ` · Final v${finalSub?.version} · ${formatDate(finalSub?.created_at)}` : aStatus?.hasDraft ? ` · Draft v${subs[0]?.version}` : " · Not submitted"}
                                {hasCrit ? " · Critiqued" : ""}
                                {dueDate ? ` · Due ${formatScheduleDate(dueDate)}${isRevised ? " (revised)" : ""}` : ""}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ))}

        {/* ─── Document footer ─── */}
        <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <p>{program.title} · {currentTerm.title} · Review packet generated {now}</p>
        </footer>
      </div>
    </ProtectedShell>
  );
}
