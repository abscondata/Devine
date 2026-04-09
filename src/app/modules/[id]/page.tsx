import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateReadingStatus } from "@/lib/actions";
import {
  buildAssignmentStatusMap,
  getModuleNextAction,
  getModuleStanding,
  isReadingComplete,
  isReadingSkipped,
  READING_STATUS_ALLOWED,
} from "@/lib/academic-standing";
import { ProtectedShell } from "@/components/protected-shell";
import {
  computeTermSchedule,
  getEffectiveDueDate,
  formatScheduleDate,
  type TermAssignmentScheduleRow,
} from "@/lib/term-schedule";

const readingStatuses = READING_STATUS_ALLOWED;

export default async function ModulePage({
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

  const { data: module } = await supabase
    .from("modules")
    .select(
      "id, title, overview, position, course:courses(id, title, code, program:programs(id, title))"
    )
    .eq("id", id)
    .single();

  if (!module) {
    notFound();
  }

  const { data: readings } = await supabase
    .from("readings")
    .select(
      "id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, status, notes, position"
    )
    .eq("module_id", id)
    .order("position", { ascending: true });

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, assignment_type, due_at")
    .eq("module_id", id)
    .order("due_at", { ascending: true });

  const assignmentIds = assignments?.map((a) => a.id) ?? [];
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

  const { count: siblingModuleCount } = module.course?.id
    ? await supabase.from("modules").select("id", { count: "exact", head: true }).eq("course_id", module.course.id)
    : { count: 0 };
  const totalUnits = siblingModuleCount ?? 0;

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalSet = new Set(assignmentIds.filter((aid) => assignmentStatus.get(aid)?.hasFinal));
  const totalHours = (readings ?? []).reduce((s, r) => s + (r.estimated_hours ?? 0), 0);
  const standing = getModuleStanding({ readings, assignments, assignmentStatus });
  const nextAction = getModuleNextAction({ readings, assignments, assignmentStatus });

  const completedReadings = (readings ?? []).filter((r) => isReadingComplete(r.status)).length;
  const totalReadings = (readings ?? []).length;

  // Term schedule for date window
  const { data: currentTerm } = module.course?.program?.id
    ? await supabase
        .from("academic_terms")
        .select("id, starts_at, ends_at")
        .eq("program_id", module.course.program.id)
        .eq("is_current", true)
        .maybeSingle()
    : { data: null };

  const allModules = module.course?.id
    ? (await supabase.from("modules").select("id, position").eq("course_id", module.course.id).order("position", { ascending: true })).data ?? []
    : [];

  const schedule = currentTerm?.starts_at && currentTerm?.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at,
        termEndsAt: currentTerm.ends_at,
        courses: [{ id: module.course?.id ?? "", modules: allModules.map((m) => ({ id: m.id, position: m.position })) }],
      })
    : null;

  const unitSched = schedule?.unitSchedules.get(module.id);

  // Term schedule rows for this unit's assignments
  const { data: currentTermForSched } = module.course?.program?.id
    ? await supabase.from("academic_terms").select("id").eq("program_id", module.course.program.id).eq("is_current", true).maybeSingle()
    : { data: null };
  const assignmentIdsForSched = (assignments ?? []).map((a) => a.id);
  const { data: scheduleRows } = currentTermForSched && assignmentIdsForSched.length
    ? await supabase.from("term_assignment_schedule").select("assignment_id, default_due_at, current_due_at, revised_at").eq("term_id", currentTermForSched.id).in("assignment_id", assignmentIdsForSched)
    : { data: [] as TermAssignmentScheduleRow[] };
  const scheduleByAssignment = new Map<string, TermAssignmentScheduleRow>();
  (scheduleRows ?? []).forEach((row) => scheduleByAssignment.set(row.assignment_id, row));

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">Home</Link>
            <span>/</span>
            <Link href={`/courses/${module.course?.id}`}>{module.course?.code ?? "Course"}</Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>Unit {module.position + 1} of {totalUnits}</span>
            {unitSched ? <span>{formatScheduleDate(unitSched.startsAt)} – {formatScheduleDate(unitSched.endsAt)}</span> : null}
            {totalHours ? <span>{totalHours.toFixed(1)}h reading</span> : null}
            <span>{standing.completion.completedTasks}/{standing.completion.totalTasks} requirements</span>
          </div>
          <h1 className="text-3xl">{module.title}</h1>
          {module.overview ? (
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{module.overview}</p>
          ) : null}
        </header>

        {/* ─── Next required action ─── */}
        {standing.completion.isComplete ? (
          <p className="text-sm font-semibold text-[var(--text)]">This unit is complete.</p>
        ) : nextAction ? (
          <section className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Next required action</p>
            <p className="text-sm font-semibold">{nextAction.title}</p>
            <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
          </section>
        ) : null}

        {/* ─── Reading sequence ─── */}
        {totalReadings > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Readings</h2>
            <ol className="divide-y divide-[var(--border)]">
              {(readings ?? []).map((reading, index) => {
                const done = isReadingComplete(reading.status);
                const skipped = isReadingSkipped(reading.status);
                return (
                  <li key={reading.id} className={`py-4 first:pt-0 ${done ? "opacity-50" : ""}`}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-0.5 flex-1">
                        <h3 className={`text-sm ${done ? "line-through text-[var(--muted)]" : "font-semibold"}`}>
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] mr-2">{index + 1}.</span>
                          {reading.title}
                        </h3>
                        <p className="text-xs text-[var(--muted)]">
                          {[reading.author, reading.source_type, reading.tradition_or_era, reading.pages_or_length, reading.estimated_hours ? `${reading.estimated_hours}h` : null].filter(Boolean).join(" · ")}
                        </p>
                        {skipped ? <p className="text-xs text-[var(--muted)]">Skipped (does not count toward completion).</p> : null}
                        {reading.reference_url_or_citation ? <p className="text-xs text-[var(--muted)]">{reading.reference_url_or_citation}</p> : null}
                      </div>
                      <form action={updateReadingStatus} className="flex items-center gap-1.5 shrink-0">
                        <input type="hidden" name="readingId" value={reading.id} />
                        <input type="hidden" name="moduleId" value={module.id} />
                        <select
                          name="status"
                          defaultValue={reading.status}
                          className="border-0 bg-transparent text-xs text-[var(--muted)] cursor-pointer py-1 pr-5 focus:outline-none"
                        >
                          {readingStatuses.map((s) => (
                            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                        <button type="submit" className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                          save
                        </button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {/* ─── Written work ─── */}
        {(assignments ?? []).length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Written Work</h2>
            <div className="divide-y divide-[var(--border)]">
              {(assignments ?? []).map((a) => {
                const status = assignmentStatus.get(a.id);
                const isFinal = status?.hasFinal;
                const effective = getEffectiveDueDate({
                  termScheduleRow: scheduleByAssignment.get(a.id),
                  canonicalDueAt: a.due_at,
                  unitSchedule: unitSched ?? undefined,
                });
                const dueDate = effective?.date ?? null;
                const isRevised = effective?.isRevised ?? false;
                return (
                  <Link
                    key={a.id}
                    href={`/assignments/${a.id}`}
                    className={`flex flex-wrap items-center justify-between gap-4 py-4 first:pt-0 group ${isFinal ? "opacity-50" : ""}`}
                  >
                    <div className="space-y-0.5">
                      <h3 className={`text-sm ${isFinal ? "line-through text-[var(--muted)]" : "font-semibold group-hover:text-[var(--accent-soft)]"}`}>{a.title}</h3>
                      <p className="text-xs text-[var(--muted)]">
                        {a.assignment_type.replace(/_/g, " ")}
                        {status?.hasFinal ? " · Final submitted" : status?.hasDraft ? " · Draft" : " · Not submitted"}
                      </p>
                    </div>
                    {dueDate ? (
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                        {isFinal ? "Submitted" : `Due ${formatScheduleDate(dueDate)}${isRevised ? " · Revised" : ""}`}
                      </p>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* ─── Completion rule ─── */}
        {!standing.completion.isComplete ? (
          <section className="text-xs text-[var(--muted)] space-y-1">
            <p>Unit completion requires all readings marked complete and final submissions for all written work.</p>
            {standing.completion.unreadReadings > 0 ? <p>Unread readings block unit completion.</p> : null}
          </section>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
