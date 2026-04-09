import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getFinalAssignmentSet,
  getModuleStanding,
  isReadingIncomplete,
} from "@/lib/academic-standing";
import {
  computeTermSchedule,
  computeReadingTargetDate,
  getEffectiveDueDate,
  formatScheduleDate,
  isPast,
  type TermAssignmentScheduleRow,
} from "@/lib/term-schedule";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function TermPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: ownedPrograms } = await supabase.from("programs").select("id, title").eq("owner_id", user.id).order("created_at", { ascending: true }).limit(1);
  const currentProgram = ownedPrograms?.[0] ?? null;

  if (!currentProgram) {
    return (
      <ProtectedShell userEmail={user.email ?? null}>
        <div className="space-y-4">
          <h1 className="text-3xl">Current Term</h1>
          <p className="text-sm text-[var(--muted)]">No program enrollment found.</p>
        </div>
      </ProtectedShell>
    );
  }

  const { data: currentTerm } = await supabase.from("academic_terms").select("id, title, starts_at, ends_at").eq("program_id", currentProgram.id).eq("is_current", true).maybeSingle();

  if (!currentTerm) {
    return (
      <ProtectedShell userEmail={user.email ?? null}>
        <div className="space-y-4">
          <h1 className="text-3xl">Current Term</h1>
          <p className="text-sm text-[var(--muted)]">No active term.</p>
        </div>
      </ProtectedShell>
    );
  }

  const { data: termCourseRows } = await supabase.from("term_courses").select("course_id").eq("term_id", currentTerm.id);
  const termCourseIds = (termCourseRows ?? []).map((r) => r.course_id);

  const { data: courses } = termCourseIds.length
    ? await supabase.from("courses").select("id, title, code, credits_or_weight, level, sequence_position").in("id", termCourseIds).order("sequence_position", { ascending: true })
    : { data: [] };

  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: modules } = courseIds.length ? await supabase.from("modules").select("id, course_id, title, overview, position").in("course_id", courseIds).order("position", { ascending: true }) : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: readings } = moduleIds.length ? await supabase.from("readings").select("id, module_id, title, author, status, estimated_hours, position").in("module_id", moduleIds).order("position", { ascending: true }) : { data: [] };
  const { data: assignments } = moduleIds.length ? await supabase.from("assignments").select("id, module_id, title, assignment_type, due_at").in("module_id", moduleIds).order("due_at", { ascending: true }) : { data: [] };
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length ? await supabase.from("submissions").select("id, assignment_id, is_final").eq("user_id", user.id).in("assignment_id", assignmentIds) : { data: [] };
  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds) : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = getFinalAssignmentSet(assignmentStatus);

  const { data: scheduleRows } = await supabase.from("term_assignment_schedule").select("assignment_id, default_due_at, current_due_at, revised_at").eq("term_id", currentTerm.id);
  const scheduleByAssignment = new Map<string, TermAssignmentScheduleRow>();
  (scheduleRows ?? []).forEach((row) => scheduleByAssignment.set(row.assignment_id, row));

  type ReadingRow = NonNullable<typeof readings>[number];
  type AssignmentRow = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, ReadingRow[]>();
  (readings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AssignmentRow[]>();
  (assignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const schedule = currentTerm.starts_at && currentTerm.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at, termEndsAt: currentTerm.ends_at,
        courses: (courses ?? []).map((c) => ({ id: c.id, modules: (modules ?? []).filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, position: m.position })) })),
      })
    : null;

  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);

  const courseSections = (courses ?? []).map((course) => {
    const courseModules = (modules ?? []).filter((m) => m.course_id === course.id).sort((a, b) => a.position - b.position);
    const units = courseModules.map((mod) => {
      const unitReadings = readingsByModule.get(mod.id) ?? [];
      const unitAssignments = assignmentsByModule.get(mod.id) ?? [];
      const standing = getModuleStanding({ readings: unitReadings, assignments: unitAssignments, assignmentStatus });
      const unitSched = schedule?.unitSchedules.get(mod.id);
      const isComplete = standing.completion.totalTasks > 0 && standing.completion.completedTasks >= standing.completion.totalTasks;
      return { ...mod, readings: unitReadings, assignments: unitAssignments, completedTasks: standing.completion.completedTasks, totalTasks: standing.completion.totalTasks, isComplete, startsAt: unitSched?.startsAt ?? null, endsAt: unitSched?.endsAt ?? null };
    });
    return { course, units };
  });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ─── Term header ─── */}
        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {currentProgram.title}
          </p>
          <h1 className="text-3xl">{currentTerm.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {currentTerm.starts_at && currentTerm.ends_at ? (
              <span>{formatDate(currentTerm.starts_at)} – {formatDate(currentTerm.ends_at)}</span>
            ) : null}
            {schedule ? <span>Week {schedule.currentWeek} of {schedule.totalWeeks}</span> : null}
            <span>{(courses ?? []).length} courses · {totalCredits} credits</span>
          </div>
          <div className="flex flex-wrap gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)] pt-2">
            <Link href="/term/review" className="hover:text-[var(--text)]">Term review packet</Link>
          </div>
        </header>

        {/* ─── Enrolled courses ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Enrolled Courses</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {(courses ?? []).map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold">{course.code} — {course.title}</p>
                  <p className="text-xs text-[var(--muted)]">{course.credits_or_weight} credits · {course.level}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Per-course unit schedule ─── */}
        {courseSections.map(({ course, units }) => (
          <section key={course.id} className="space-y-4">
            <div className="border-b border-[var(--border)] pb-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{course.code}</p>
              <h2 className="text-lg">{course.title}</h2>
            </div>

            {units.map((unit) => (
              <div key={unit.id} className="space-y-2">
                <Link href={`/modules/${unit.id}`} className="flex flex-wrap items-center justify-between gap-4 group">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-semibold group-hover:text-[var(--accent-soft)]">
                      Unit {unit.position + 1}: {unit.title}
                    </h3>
                    {unit.startsAt && unit.endsAt ? (
                      <p className="text-xs text-[var(--muted)]">{formatScheduleDate(unit.startsAt)} – {formatScheduleDate(unit.endsAt)}</p>
                    ) : null}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {unit.isComplete ? "Complete" : `${unit.completedTasks}/${unit.totalTasks}`}
                  </p>
                </Link>

                {/* Readings and assignments as inline lists */}
                <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 pl-4 border-l-2 border-[var(--border)]">
                  {unit.readings.length > 0 ? (
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                      <ul className="text-sm text-[var(--muted)] space-y-0.5">
                        {unit.readings.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => {
                          const unread = isReadingIncomplete(r.status);
                          return (
                            <li key={r.id} className={unread ? "" : "line-through opacity-50"}>
                              {r.title}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}

                  {unit.assignments.length > 0 ? (
                    <div className="space-y-0.5">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                      <ul className="text-sm space-y-0.5">
                        {unit.assignments.map((a) => {
                          const isFinal = finalSet.has(a.id);
                          const schedRow = scheduleByAssignment.get(a.id);
                          const unitSched = unit.startsAt && unit.endsAt
                            ? { moduleId: unit.id, position: unit.position, startsAt: unit.startsAt, endsAt: unit.endsAt }
                            : null;
                          const effective = getEffectiveDueDate({ termScheduleRow: schedRow, canonicalDueAt: a.due_at, unitSchedule: unitSched });
                          const dueDate = effective?.date ?? null;
                          return (
                            <li key={a.id} className={isFinal ? "text-[var(--muted)] line-through opacity-50" : ""}>
                              <Link href={`/assignments/${a.id}`} className="hover:text-[var(--text)]">
                                {a.title}
                              </Link>
                              {dueDate && !isFinal ? (
                                <span className={`text-xs ml-2 ${isPast(dueDate) ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                                  {formatScheduleDate(dueDate)}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ))}
      </div>
    </ProtectedShell>
  );
}
