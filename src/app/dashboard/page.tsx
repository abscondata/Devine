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
  getStandingStatus,
  isReadingIncomplete,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import {
  computeTermSchedule,
  computeReadingTargetDate,
  getEffectiveDueDate,
  formatScheduleDate,
  isDueThisWeek,
  isPast,
  type TermAssignmentScheduleRow,
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

  const { data: currentTerm } = await supabase
    .from("academic_terms")
    .select("id, title, starts_at, ends_at")
    .eq("program_id", currentProgram.id)
    .eq("is_current", true)
    .maybeSingle();

  const { data: termCourseRows } = currentTerm
    ? await supabase.from("term_courses").select("course_id").eq("term_id", currentTerm.id)
    : { data: [] };
  const termCourseIds = (termCourseRows ?? []).map((r) => r.course_id);

  const { data: courses } = termCourseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, code, description, credits_or_weight, level, sequence_position")
        .in("id", termCourseIds)
        .order("sequence_position", { ascending: true })
    : { data: [] };

  const courseIds = (courses ?? []).map((c) => c.id);

  const { data: modules } = courseIds.length
    ? await supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds).order("position", { ascending: true })
    : { data: [] };

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: readings } = moduleIds.length
    ? await supabase.from("readings").select("id, module_id, title, author, status, estimated_hours, position").in("module_id", moduleIds).order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase.from("assignments").select("id, module_id, title, assignment_type, due_at").in("module_id", moduleIds).order("due_at", { ascending: true })
    : { data: [] };

  const assignmentIds = (assignments ?? []).map((a) => a.id);

  const { data: submissions } = assignmentIds.length
    ? await supabase.from("submissions").select("id, assignment_id, is_final, created_at").eq("user_id", user.id).in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds)
    : { data: [] as { id: string; submission_id: string }[] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = getFinalAssignmentSet(assignmentStatus);

  const { data: scheduleRows } = currentTerm
    ? await supabase.from("term_assignment_schedule").select("assignment_id, default_due_at, current_due_at, revised_at").eq("term_id", currentTerm.id)
    : { data: [] as TermAssignmentScheduleRow[] };
  const scheduleByAssignment = new Map<string, TermAssignmentScheduleRow>();
  (scheduleRows ?? []).forEach((row) => scheduleByAssignment.set(row.assignment_id, row));

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
    const courseModules = (modules ?? []).filter((m) => m.course_id === course.id).sort((a, b) => a.position - b.position);

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
      course, currentUnit, totalUnits: courseModules.length, completedTasks, totalTasks,
      finalAssignments: finalCount, totalAssignments: courseAssignments.length,
      unreadReadings, openWrittenWork, nextAction, isComplete,
    };
  });

  const allUnreadReadings = termCourseSummaries.flatMap((s) =>
    s.unreadReadings.map((r) => ({ ...r, courseCode: s.course.code }))
  );
  const allOpenWork = termCourseSummaries.flatMap((s) =>
    s.openWrittenWork.map((a) => ({ ...a, courseCode: s.course.code }))
  );
  allOpenWork.sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0;
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at.localeCompare(b.due_at);
  });

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

  const enrichedWork = allOpenWork.map((a) => {
    const schedRow = scheduleByAssignment.get(a.id);
    const unitSched = schedule?.unitSchedules.get(a.module_id) ?? null;
    const effective = getEffectiveDueDate({
      termScheduleRow: schedRow,
      canonicalDueAt: a.due_at,
      unitSchedule: unitSched,
    });
    return { ...a, computedDue: effective?.date ?? null, isRevised: effective?.isRevised ?? false, defaultDate: effective?.defaultDate };
  });
  enrichedWork.sort((a, b) => {
    if (!a.computedDue && !b.computedDue) return 0;
    if (!a.computedDue) return 1;
    if (!b.computedDue) return -1;
    return a.computedDue.getTime() - b.computedDue.getTime();
  });

  type WeekItem = {
    id: string;
    title: string | null;
    kind: "reading" | "writing";
    courseCode: string | null;
    date: Date;
    overdue: boolean;
    assignmentId?: string;
  };

  const thisWeekItems: WeekItem[] = [];

  enrichedReadings.forEach((r) => {
    if (r.targetDate && (isDueThisWeek(r.targetDate) || isPast(r.targetDate))) {
      thisWeekItems.push({
        id: r.id, title: r.title, kind: "reading", courseCode: r.courseCode,
        date: r.targetDate, overdue: isPast(r.targetDate),
      });
    }
  });

  enrichedWork.forEach((a) => {
    if (a.computedDue && (isDueThisWeek(a.computedDue) || isPast(a.computedDue))) {
      thisWeekItems.push({
        id: a.id, title: a.title, kind: "writing", courseCode: a.courseCode,
        date: a.computedDue, overdue: isPast(a.computedDue), assignmentId: a.id,
      });
    }
  });

  thisWeekItems.sort((a, b) => a.date.getTime() - b.date.getTime());

  const upcomingWork = enrichedWork.filter((a) => a.computedDue && !isPast(a.computedDue) && !isDueThisWeek(a.computedDue));
  const upcomingReadings = enrichedReadings.filter((r) => r.targetDate && !isPast(r.targetDate) && !isDueThisWeek(r.targetDate));

  // Find the single primary course + unit to feature
  const primaryCourse = termCourseSummaries.find((s) => s.currentUnit && !s.isComplete) ?? termCourseSummaries[0] ?? null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ─── Term heading ─── */}
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {currentProgram.title}
          </p>
          {currentTerm ? (
            <>
              <h1 className="text-3xl">{currentTerm.title}</h1>
              <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {schedule ? <span>Week {schedule.currentWeek} of {schedule.totalWeeks}</span> : null}
                <span>{formatDate(currentTerm.starts_at)} – {formatDate(currentTerm.ends_at)}</span>
                <span>{termCourseSummaries.length} course{termCourseSummaries.length === 1 ? "" : "s"}</span>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-3xl">College Home</h1>
              <p className="text-sm text-[var(--muted)]">
                No active term. The academic term has not yet been configured.
              </p>
            </>
          )}
        </header>

        {/* ─── Current work: the single most important truth ─── */}
        {primaryCourse?.currentUnit ? (
          <section className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Current Work</p>
            <Link
              href={`/modules/${primaryCourse.currentUnit.id}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition hover:border-[var(--accent-soft)]"
            >
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {primaryCourse.course.code} · Unit {primaryCourse.currentUnit.position + 1} of {primaryCourse.totalUnits}
                </p>
                <h2 className="text-xl">{primaryCourse.currentUnit.title}</h2>
                {primaryCourse.nextAction ? (
                  <p className="text-sm text-[var(--muted)]">{primaryCourse.nextAction.title}</p>
                ) : null}
                <p className="text-xs text-[var(--muted)]">
                  {primaryCourse.currentUnit.completedTasks} of {primaryCourse.currentUnit.totalTasks} tasks complete
                </p>
              </div>
            </Link>
          </section>
        ) : null}

        {/* ─── This week ─── */}
        {thisWeekItems.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">This Week</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {thisWeekItems.map((item) => {
                const inner = (
                  <div className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="space-y-0.5">
                      <p className={`text-sm ${item.kind === "writing" ? "font-semibold" : "text-[var(--muted)]"}`}>{item.title}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {item.courseCode} · {item.kind === "reading" ? "Reading" : "Written work"}
                      </p>
                    </div>
                    <span className={`text-xs uppercase tracking-[0.2em] shrink-0 ${item.overdue ? "text-[var(--danger)]" : "text-[var(--muted)]"}`}>
                      {item.overdue ? "Overdue" : formatScheduleDate(item.date)}
                    </span>
                  </div>
                );
                return item.kind === "writing" && item.assignmentId ? (
                  <Link key={item.id} href={`/assignments/${item.assignmentId}`} className="block transition hover:bg-[var(--surface-muted)]">
                    {inner}
                  </Link>
                ) : (
                  <div key={item.id}>{inner}</div>
                );
              })}
            </div>
          </section>
        ) : currentTerm ? (
          <section className="space-y-3">
            <h2 className="text-lg">This Week</h2>
            <p className="text-sm text-[var(--muted)]">No obligations due this week.</p>
          </section>
        ) : null}

        {/* ─── Term courses ─── */}
        {termCourseSummaries.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Term Courses</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {termCourseSummaries.map((summary) => (
                <Link
                  key={summary.course.id}
                  href={`/courses/${summary.course.id}`}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">
                      {summary.course.code} — {summary.course.title}
                    </p>
                    {summary.currentUnit ? (
                      <p className="text-xs text-[var(--muted)]">
                        Unit {summary.currentUnit.position + 1}: {summary.currentUnit.title}
                      </p>
                    ) : summary.isComplete ? (
                      <p className="text-xs text-[var(--muted)]">All units complete</p>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {summary.isComplete ? "Complete" : `${summary.completedTasks}/${summary.totalTasks}`}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {summary.course.credits_or_weight} credits
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Upcoming ─── */}
        {(upcomingWork.length > 0 || upcomingReadings.length > 0) ? (
          <section className="space-y-3">
            <h2 className="text-lg">Upcoming</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {upcomingWork.slice(0, 4).map((a) => (
                <Link
                  key={a.id}
                  href={`/assignments/${a.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-[var(--surface-muted)]"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-[var(--muted)]">{a.courseCode} · {a.assignment_type?.replace(/_/g, " ")}</p>
                  </div>
                  {a.computedDue ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                      {formatScheduleDate(a.computedDue)}{a.isRevised ? " · Revised" : ""}
                    </span>
                  ) : null}
                </Link>
              ))}
              {upcomingReadings.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm text-[var(--muted)]">{r.title}</p>
                    <p className="text-xs text-[var(--muted)]">{r.courseCode} · Reading</p>
                  </div>
                  {r.targetDate ? (
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">{formatScheduleDate(r.targetDate)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {/* ─── Quick links ─── */}
        {currentTerm ? (
          <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/term" className="hover:text-[var(--text)]">Full term view</Link>
            <Link href="/term/review" className="hover:text-[var(--text)]">Term review packet</Link>
          </nav>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
