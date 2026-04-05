import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateReadingStatus } from "@/lib/actions";
import {
  buildAssignmentStatusMap,
  getModuleNextAction,
  getModuleStanding,
  isReadingSkipped,
  READING_STATUS_ALLOWED,
} from "@/lib/academic-standing";
import { ProtectedShell } from "@/components/protected-shell";
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
      "id, title, overview, position, course:courses(id, title, program:programs(id, title))"
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

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  // Count sibling modules for "Unit X of Y" display
  const { count: siblingModuleCount } = module.course?.id
    ? await supabase
        .from("modules")
        .select("id", { count: "exact", head: true })
        .eq("course_id", module.course.id)
    : { count: 0 };
  const totalModules = siblingModuleCount ?? 0;

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const totalHours = (readings ?? []).reduce(
    (sum, reading) => sum + (reading.estimated_hours ?? 0),
    0
  );
  const moduleStanding = getModuleStanding({
    readings,
    assignments,
    assignmentStatus,
  });
  const { totalTasks, completedTasks, missingFinals, unreadReadings, skippedReadings } =
    moduleStanding.completion;
  const { totalAssignments, finalAssignments, draftAssignments, critiquedFinals } =
    moduleStanding.assignmentSummary;
  const nextAction = getModuleNextAction({
    readings,
    assignments,
    assignmentStatus,
  });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-3">
          <Link
            href={`/courses/${module.course?.id}`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            {module.course?.title ?? "Course"}
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              {module.course?.program?.title ?? "Program"} · Unit {module.position + 1}{totalModules ? ` of ${totalModules}` : ""}
            </p>
            <h1 className="text-3xl">{module.title}</h1>
            {module.overview ? (
              <p className="text-sm text-[var(--muted)]">
                {module.overview}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{completedTasks} of {totalTasks || 0} requirements fulfilled</span>
            {totalHours ? (
              <span>Estimated reading: {totalHours.toFixed(1)} hours</span>
            ) : null}
            <span>{finalAssignments} of {totalAssignments} final submissions</span>
          </div>
        </header>

        {nextAction ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Next obligation
            </p>
            <p className="text-sm font-semibold text-[var(--text)]">
              {nextAction.title}
            </p>
            <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
          </section>
        ) : unreadReadings === 0 && missingFinals === 0 ? (
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <p className="text-sm font-semibold text-[var(--text)]">
              All required work in this unit is complete.
            </p>
          </section>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-xl">Assigned Readings</h2>

          {readings?.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {readings.map((reading) => (
                <div key={reading.id} className="p-5 space-y-3">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <h3 className="text-base font-semibold">{reading.title}</h3>
                      <p className="text-sm text-[var(--muted)]">
                        {[reading.author, reading.tradition_or_era, reading.pages_or_length]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {reading.source_type ? (
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {reading.source_type}{reading.primary_or_secondary ? ` · ${reading.primary_or_secondary}` : ""}
                          {reading.estimated_hours ? ` · ${reading.estimated_hours}h` : ""}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:text-right shrink-0">
                      {reading.status === "complete" ? "Complete" : reading.status.replace(/_/g, " ")}
                    </p>
                  </div>
                  {isReadingSkipped(reading.status) ? (
                    <p className="text-xs text-[var(--muted)]">
                      Skipped (does not count toward completion).
                    </p>
                  ) : null}
                  {reading.reference_url_or_citation ? (
                    <p className="text-xs text-[var(--muted)]">
                      {reading.reference_url_or_citation}
                    </p>
                  ) : null}
                  {reading.notes ? (
                    <p className="text-sm text-[var(--muted)]">{reading.notes}</p>
                  ) : null}
                  <form
                    action={updateReadingStatus}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input type="hidden" name="readingId" value={reading.id} />
                    <input type="hidden" name="moduleId" value={module.id} />
                    <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Mark as
                    </label>
                    <select
                      name="status"
                      defaultValue={reading.status}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1.5 text-sm"
                    >
                      {readingStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--border)] px-2 py-1.5 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                    >
                      Save
                    </button>
                  </form>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No readings have been assigned for this unit.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl">Written Work</h2>

          {assignments?.length ? (
            <div className="space-y-4">
              {assignments.map((assignment) => (
                <Link
                  key={assignment.id}
                  href={`/assignments/${assignment.id}`}
                  className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold">{assignment.title}</h3>
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {assignment.due_at
                        ? new Date(assignment.due_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No deadline"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
                    {(() => {
                      const status = assignmentStatus.get(assignment.id);
                      if (status?.hasFinal) {
                        return (
                          <span>
                            Final · {status.hasCritique ? "Critiqued" : "Critique pending (completion unaffected)"}
                          </span>
                        );
                      }
                      if (status?.hasDraft) {
                        return <span>Draft · Not final</span>;
                      }
                      return <span>No submission</span>;
                    })()}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No written work has been assigned for this unit.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
