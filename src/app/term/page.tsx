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
  computeWorkDueDate,
  formatScheduleDate,
  isPast,
} from "@/lib/term-schedule";

export default async function TermPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ownedPrograms } = await supabase
    .from("programs")
    .select("id, title")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);
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

  const { data: currentTerm } = await supabase
    .from("academic_terms")
    .select("id, title, starts_at, ends_at")
    .eq("program_id", currentProgram.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!currentTerm) {
    return (
      <ProtectedShell userEmail={user.email ?? null}>
        <div className="space-y-4">
          <Link href="/dashboard" className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">My Term</Link>
          <h1 className="text-3xl">Current Term</h1>
          <p className="text-sm text-[var(--muted)]">No active term.</p>
        </div>
      </ProtectedShell>
    );
  }

  // Load term courses
  const { data: termCourseRows } = await supabase
    .from("term_courses")
    .select("course_id")
    .eq("term_id", currentTerm.id);
  const termCourseIds = (termCourseRows ?? []).map((r) => r.course_id);

  const { data: courses } = termCourseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, code, credits_or_weight, level, sequence_position")
        .in("id", termCourseIds)
        .order("sequence_position", { ascending: true })
    : { data: [] };

  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, overview, position")
        .in("course_id", courseIds)
        .order("position", { ascending: true })
    : { data: [] };

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, author, status, estimated_hours, position")
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

  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = getFinalAssignmentSet(assignmentStatus);

  // Maps
  type ReadingRow = NonNullable<typeof readings>[number];
  type AssignmentRow = NonNullable<typeof assignments>[number];

  const readingsByModule = new Map<string, ReadingRow[]>();
  (readings ?? []).forEach((r) => {
    const list = readingsByModule.get(r.module_id) ?? [];
    list.push(r);
    readingsByModule.set(r.module_id, list);
  });

  const assignmentsByModule = new Map<string, AssignmentRow[]>();
  (assignments ?? []).forEach((a) => {
    const list = assignmentsByModule.get(a.module_id) ?? [];
    list.push(a);
    assignmentsByModule.set(a.module_id, list);
  });

  // Schedule
  const schedule = currentTerm.starts_at && currentTerm.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at,
        termEndsAt: currentTerm.ends_at,
        courses: (courses ?? []).map((c) => ({
          id: c.id,
          modules: (modules ?? []).filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, position: m.position })),
        })),
      })
    : null;

  // Per-course data
  const courseSections = (courses ?? []).map((course) => {
    const courseModules = (modules ?? [])
      .filter((m) => m.course_id === course.id)
      .sort((a, b) => a.position - b.position);

    const units = courseModules.map((mod) => {
      const unitReadings = readingsByModule.get(mod.id) ?? [];
      const unitAssignments = assignmentsByModule.get(mod.id) ?? [];
      const standing = getModuleStanding({ readings: unitReadings, assignments: unitAssignments, assignmentStatus });
      const unitSched = schedule?.unitSchedules.get(mod.id);
      const isComplete = standing.completion.totalTasks > 0 && standing.completion.completedTasks >= standing.completion.totalTasks;

      return {
        ...mod,
        readings: unitReadings,
        assignments: unitAssignments,
        completedTasks: standing.completion.completedTasks,
        totalTasks: standing.completion.totalTasks,
        isComplete,
        startsAt: unitSched?.startsAt ?? null,
        endsAt: unitSched?.endsAt ?? null,
      };
    });

    return { course, units };
  });

  const termStart = currentTerm.starts_at
    ? new Date(currentTerm.starts_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const termEnd = currentTerm.ends_at
    ? new Date(currentTerm.ends_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : null;
  const totalCredits = (courses ?? []).reduce((s, c) => s + (c.credits_or_weight ?? 0), 0);

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {currentProgram.title}
          </p>
          <h1 className="text-3xl">{currentTerm.title}</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {termStart && termEnd ? <span>{termStart} – {termEnd}</span> : null}
            {schedule ? <span>Week {schedule.currentWeek} of {schedule.totalWeeks}</span> : null}
            <span>{(courses ?? []).length} courses · {totalCredits} credits</span>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg">Course Load</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {(courses ?? []).map((course) => (
              <Link key={course.id} href={`/courses/${course.id}`} className="flex flex-wrap items-center justify-between gap-4 p-5 transition hover:bg-[var(--surface-muted)]">
                <div className="space-y-0.5">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {course.code} · {course.credits_or_weight} credits
                  </p>
                  <h3 className="text-base font-semibold">{course.title}</h3>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{course.level}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* ─── Full term schedule ─── */}
        {courseSections.map(({ course, units }) => (
          <section key={course.id} className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{course.code}</p>
              <h2 className="text-lg">{course.title}</h2>
            </div>

            <div className="space-y-4">
              {units.map((unit) => (
                <div key={unit.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <Link href={`/modules/${unit.id}`} className="block p-5 transition hover:bg-[var(--surface-muted)]">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Unit {unit.position + 1}
                          {unit.startsAt && unit.endsAt ? ` · ${formatScheduleDate(unit.startsAt)} – ${formatScheduleDate(unit.endsAt)}` : ""}
                        </p>
                        <h3 className="text-base font-semibold">{unit.title}</h3>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {unit.isComplete ? "Complete" : `${unit.completedTasks} of ${unit.totalTasks}`}
                      </p>
                    </div>
                  </Link>

                  {(unit.readings.length > 0 || unit.assignments.length > 0) ? (
                    <div className="border-t border-[var(--border)] px-5 py-4 grid gap-4 md:grid-cols-2">
                      {unit.readings.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                          <ol className="space-y-0.5 text-sm text-[var(--muted)]">
                            {unit.readings
                              .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                              .map((r) => {
                                const isUnread = isReadingIncomplete(r.status);
                                const targetDate = unit.startsAt && unit.endsAt
                                  ? computeReadingTargetDate({
                                      unitSchedule: { moduleId: unit.id, position: unit.position, startsAt: unit.startsAt, endsAt: unit.endsAt },
                                      readingPosition: unit.readings.indexOf(r),
                                      totalReadings: unit.readings.length,
                                    })
                                  : null;
                                return (
                                  <li key={r.id} className="flex items-center justify-between gap-3">
                                    <span className={isUnread ? "" : "line-through opacity-50"}>{r.title}</span>
                                    {targetDate ? (
                                      <span className={`text-xs uppercase tracking-[0.2em] shrink-0 ${isUnread && isPast(targetDate) ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                                        {formatScheduleDate(targetDate)}
                                      </span>
                                    ) : null}
                                  </li>
                                );
                              })}
                          </ol>
                        </div>
                      ) : null}
                      {unit.assignments.length > 0 ? (
                        <div className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                          <ol className="space-y-0.5 text-sm">
                            {unit.assignments.map((a) => {
                              const isFinal = finalSet.has(a.id);
                              const dueDate = unit.startsAt && unit.endsAt
                                ? computeWorkDueDate({
                                    unitSchedule: { moduleId: unit.id, position: unit.position, startsAt: unit.startsAt, endsAt: unit.endsAt },
                                    explicitDueAt: a.due_at,
                                  })
                                : null;
                              return (
                                <li key={a.id} className="flex items-center justify-between gap-3">
                                  <Link href={`/assignments/${a.id}`} className={`hover:text-[var(--text)] ${isFinal ? "line-through opacity-50 text-[var(--muted)]" : "font-semibold"}`}>
                                    {a.title}
                                  </Link>
                                  {dueDate ? (
                                    <span className={`text-xs uppercase tracking-[0.2em] shrink-0 ${!isFinal && isPast(dueDate) ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                                      {isFinal ? "Submitted" : formatScheduleDate(dueDate)}
                                    </span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ol>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ProtectedShell>
  );
}
