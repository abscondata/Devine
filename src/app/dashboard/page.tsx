import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getFinalAssignmentSet,
  getModuleNextAction,
  getModuleStanding,
  isReadingIncomplete,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import {
  computeTermSchedule,
  computeReadingTargetDate,
  computeWorkDueDate,
  formatScheduleDate,
  isDueThisWeek,
  isPast,
} from "@/lib/term-schedule";

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // ─── RESOLVE PROGRAM ───
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
          <h1 className="text-3xl">College Home</h1>
          <p className="text-sm text-[var(--muted)]">No program enrollment found.</p>
        </div>
      </ProtectedShell>
    );
  }

  // ─── RESOLVE CURRENT TERM ───
  const { data: currentTerm } = await supabase
    .from("academic_terms")
    .select("id, title, starts_at, ends_at")
    .eq("program_id", currentProgram.id)
    .eq("is_current", true)
    .maybeSingle();

  // ─── TERM COURSES ───
  const { data: termCourseRows } = currentTerm
    ? await supabase
        .from("term_courses")
        .select("course_id")
        .eq("term_id", currentTerm.id)
    : { data: [] };
  const termCourseIds = (termCourseRows ?? []).map((r) => r.course_id);

  // ─── LOAD TERM COURSE DATA ───
  const { data: courses } = termCourseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, code, description, credits_or_weight, level, sequence_position")
        .in("id", termCourseIds)
        .order("sequence_position", { ascending: true })
    : { data: [] };

  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, position")
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
        .select("id, assignment_id, is_final, created_at")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] as { id: string; submission_id: string }[] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = getFinalAssignmentSet(assignmentStatus);

  // ─── BUILD PER-MODULE MAPS ───
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

  const moduleToCourse = new Map<string, string>();
  (modules ?? []).forEach((m) => moduleToCourse.set(m.id, m.course_id));

  // ─── PER-COURSE SUMMARIES ───
  type CourseSummary = {
    course: NonNullable<typeof courses>[number];
    currentUnit: { id: string; title: string; position: number; completedTasks: number; totalTasks: number } | null;
    totalUnits: number;
    completedTasks: number;
    totalTasks: number;
    finalAssignments: number;
    totalAssignments: number;
    unreadReadings: { id: string; title: string | null; module_id: string }[];
    openWrittenWork: { id: string; title: string; assignment_type: string; due_at: string | null; module_id: string }[];
    nextAction: { title: string; reason: string } | null;
    isComplete: boolean;
  };

  const termCourseSummaries: CourseSummary[] = (courses ?? []).map((course) => {
    const courseModules = (modules ?? [])
      .filter((m) => m.course_id === course.id)
      .sort((a, b) => a.position - b.position);

    let completedTasks = 0;
    let totalTasks = 0;
    let currentUnitId: string | null = null;
    let currentUnitTitle = "";
    let currentUnitPosition = 0;
    let currentUnitCompleted = 0;
    let currentUnitTotal = 0;

    courseModules.forEach((mod) => {
      const modReadings = readingsByModule.get(mod.id) ?? [];
      const modAssignments = assignmentsByModule.get(mod.id) ?? [];
      const standing = getModuleStanding({ readings: modReadings, assignments: modAssignments, assignmentStatus });
      totalTasks += standing.completion.totalTasks;
      completedTasks += standing.completion.completedTasks;
      if (!currentUnitId && standing.completion.totalTasks > 0 && standing.completion.completedTasks < standing.completion.totalTasks) {
        currentUnitId = mod.id;
        currentUnitTitle = mod.title;
        currentUnitPosition = mod.position;
        currentUnitCompleted = standing.completion.completedTasks;
        currentUnitTotal = standing.completion.totalTasks;
      }
    });

    const currentUnit: CourseSummary["currentUnit"] = currentUnitId
      ? { id: currentUnitId, title: currentUnitTitle, position: currentUnitPosition, completedTasks: currentUnitCompleted, totalTasks: currentUnitTotal }
      : null;

    const courseAssignments = (assignments ?? []).filter((a) => moduleToCourse.get(a.module_id) === course.id);
    const finalCount = courseAssignments.filter((a) => finalSet.has(a.id)).length;

    const unreadReadings = currentUnitId
      ? (readingsByModule.get(currentUnitId) ?? []).filter((r) => isReadingIncomplete(r.status))
      : [];

    const openWrittenWork = currentUnitId
      ? (assignmentsByModule.get(currentUnitId) ?? []).filter((a) => !finalSet.has(a.id))
      : [];

    const nextAction = currentUnitId
      ? getModuleNextAction({
          readings: readingsByModule.get(currentUnitId) ?? [],
          assignments: assignmentsByModule.get(currentUnitId) ?? [],
          assignmentStatus,
        })
      : null;

    const isComplete = totalTasks > 0 && completedTasks >= totalTasks;

    return {
      course,
      currentUnit,
      totalUnits: courseModules.length,
      completedTasks,
      totalTasks,
      finalAssignments: finalCount,
      totalAssignments: courseAssignments.length,
      unreadReadings,
      openWrittenWork,
      nextAction,
      isComplete,
    };
  });

  // ─── CROSS-COURSE QUEUES ───
  const allUnreadReadings = termCourseSummaries.flatMap((s) =>
    s.unreadReadings.map((r) => ({ ...r, courseCode: s.course.code }))
  );
  const allOpenWork = termCourseSummaries.flatMap((s) =>
    s.openWrittenWork.map((a) => ({ ...a, courseCode: s.course.code }))
  );
  // Sort open work by due date (nulls last)
  allOpenWork.sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at.localeCompare(b.due_at);
  });

  // ─── TERM SCHEDULE ───
  const schedule = currentTerm?.starts_at && currentTerm?.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at,
        termEndsAt: currentTerm.ends_at,
        courses: (courses ?? []).map((c) => ({
          id: c.id,
          modules: (modules ?? []).filter((m) => m.course_id === c.id).map((m) => ({ id: m.id, position: m.position })),
        })),
      })
    : null;

  // Enrich reading queue with target dates
  const enrichedReadings = allUnreadReadings.map((r) => {
    const unitSched = schedule?.unitSchedules.get(r.module_id);
    if (!unitSched) return { ...r, targetDate: null as Date | null };
    const totalInUnit = (readingsByModule.get(r.module_id) ?? []).length;
    const posInUnit = (readingsByModule.get(r.module_id) ?? []).findIndex((x) => x.id === r.id);
    const targetDate = computeReadingTargetDate({ unitSchedule: unitSched, readingPosition: Math.max(0, posInUnit), totalReadings: totalInUnit });
    return { ...r, targetDate };
  });
  enrichedReadings.sort((a, b) => {
    if (!a.targetDate && !b.targetDate) return 0;
    if (!a.targetDate) return 1;
    if (!b.targetDate) return -1;
    return a.targetDate.getTime() - b.targetDate.getTime();
  });

  // Enrich writing queue with computed due dates
  const enrichedWork = allOpenWork.map((a) => {
    const unitSched = schedule?.unitSchedules.get(a.module_id);
    if (!unitSched) return { ...a, computedDue: a.due_at ? new Date(a.due_at) : null as Date | null };
    const computedDue = computeWorkDueDate({ unitSchedule: unitSched, explicitDueAt: a.due_at });
    return { ...a, computedDue };
  });
  enrichedWork.sort((a, b) => {
    if (!a.computedDue && !b.computedDue) return 0;
    if (!a.computedDue) return 1;
    if (!b.computedDue) return -1;
    return a.computedDue.getTime() - b.computedDue.getTime();
  });

  const nextDue = enrichedWork[0] ?? null;
  const dueThisWeek = enrichedWork.filter((a) => a.computedDue && isDueThisWeek(a.computedDue));
  const overdueWork = enrichedWork.filter((a) => a.computedDue && isPast(a.computedDue));

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">

        {/* ─── Term header ─── */}
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {currentProgram.title}
          </p>
          {currentTerm ? (
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <h1 className="text-3xl">{currentTerm.title}</h1>
              <div className="flex flex-wrap gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {schedule ? <span>Week {schedule.currentWeek} of {schedule.totalWeeks}</span> : null}
                <span>{termCourseSummaries.length} course{termCourseSummaries.length === 1 ? "" : "s"}</span>
                {currentTerm.ends_at ? <span>Ends {formatScheduleDate(new Date(currentTerm.ends_at))}</span> : null}
              </div>
            </div>
          ) : (
            <h1 className="text-3xl">College Home</h1>
          )}
        </header>

        {/* ─── No term fallback ─── */}
        {!currentTerm || !termCourseSummaries.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <p className="text-sm text-[var(--muted)]">
              No active term. Contact administration to set up a term with courses.
            </p>
          </div>
        ) : null}

        {/* ─── Active courses ─── */}
        {termCourseSummaries.length > 0 ? (
          <section className="space-y-4">
            {termCourseSummaries.map((summary) => (
              <div key={summary.course.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                {/* Course header */}
                <Link
                  href={`/courses/${summary.course.id}`}
                  className="block p-5 transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {summary.course.code} · {summary.course.credits_or_weight} credits
                      </p>
                      <h2 className="text-xl font-semibold">{summary.course.title}</h2>
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                      {summary.isComplete
                        ? "Complete"
                        : `${summary.completedTasks} of ${summary.totalTasks} fulfilled`}
                    </p>
                  </div>
                </Link>

                {/* Current unit + next action */}
                {summary.currentUnit ? (
                  <div className="border-t border-[var(--border)] px-5 py-4 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <Link href={`/modules/${summary.currentUnit.id}`} className="text-sm font-semibold hover:text-[var(--accent-soft)]">
                        Unit {summary.currentUnit.position + 1} of {summary.totalUnits}: {summary.currentUnit.title}
                      </Link>
                      <div className="flex flex-wrap gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>{summary.currentUnit.completedTasks} of {summary.currentUnit.totalTasks} fulfilled</span>
                        {schedule?.unitSchedules.get(summary.currentUnit.id) ? (
                          <span>Due {formatScheduleDate(schedule.unitSchedules.get(summary.currentUnit.id)!.endsAt)}</span>
                        ) : null}
                      </div>
                    </div>
                    {summary.nextAction ? (
                      <p className="text-xs text-[var(--muted)]">
                        Next: {summary.nextAction.title}
                      </p>
                    ) : null}
                  </div>
                ) : summary.isComplete ? null : (
                  <div className="border-t border-[var(--border)] px-5 py-4">
                    <p className="text-xs text-[var(--muted)]">All units complete.</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        ) : null}

        {/* ─── Reading queue (cross-course, with target dates) ─── */}
        {enrichedReadings.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Reading Queue</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {enrichedReadings.slice(0, 8).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm text-[var(--muted)]">{r.title}</p>
                    <p className="text-xs text-[var(--muted)]">{r.courseCode}</p>
                  </div>
                  {r.targetDate ? (
                    <span className={`text-xs uppercase tracking-[0.2em] shrink-0 ${isPast(r.targetDate) ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                      {isPast(r.targetDate) ? "Overdue" : formatScheduleDate(r.targetDate)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Writing queue (cross-course, with due dates) ─── */}
        {enrichedWork.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Writing Queue</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {enrichedWork.slice(0, 8).map((a) => (
                <Link
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {a.courseCode} · {a.assignment_type?.replace(/_/g, " ")}
                    </p>
                  </div>
                  {a.computedDue ? (
                    <span className={`text-xs uppercase tracking-[0.2em] shrink-0 ${isPast(a.computedDue) ? "text-[var(--danger)]" : isDueThisWeek(a.computedDue) ? "text-[var(--text)] font-semibold" : "text-[var(--muted)]"}`}>
                      {isPast(a.computedDue) ? "Overdue" : isDueThisWeek(a.computedDue) ? `Due ${formatScheduleDate(a.computedDue)}` : formatScheduleDate(a.computedDue)}
                    </span>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Quick links ─── */}
        <section className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <Link href={`/programs/${currentProgram.id}/record`} className="hover:text-[var(--text)]">Academic record</Link>
          <Link href={`/programs/${currentProgram.id}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
          <Link href={`/programs/${currentProgram.id}/work`} className="hover:text-[var(--text)]">Submissions</Link>
          <Link href="/courses" className="hover:text-[var(--text)]">Curriculum</Link>
        </section>
      </div>
    </ProtectedShell>
  );
}
