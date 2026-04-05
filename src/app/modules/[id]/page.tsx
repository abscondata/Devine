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
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {module.course?.program?.title ?? "Program"}
              </p>
              <h1 className="text-3xl font-semibold">{module.title}</h1>
              <p className="text-sm text-[var(--muted)]">
                {module.overview ?? "No module overview yet."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>
              Progress {completedTasks}/{totalTasks || 0}
            </span>
            <span>
              Estimated reading hours {totalHours ? totalHours.toFixed(1) : "0"}
            </span>
            <span>
              Finals {finalAssignments}/{totalAssignments}
            </span>
            {draftAssignments ? <span>Drafts {draftAssignments}</span> : null}
            {finalAssignments ? (
              <span>
                Critiqued {critiquedFinals}/{finalAssignments}
              </span>
            ) : null}
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Official Completion</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
            <p>
              Official completion requires all readings marked complete (skipped
              readings do not count) and final submissions for every assignment.
              Critiques are recommended but do not determine completion.
            </p>
            {unreadReadings === 0 && skippedReadings === 0 && missingFinals === 0 ? (
              <p className="text-sm font-semibold text-[var(--text)]">
                This module is officially complete.
              </p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Completion blockers
                </p>
                <ul className="list-disc pl-5 text-[var(--muted)]">
                  {unreadReadings > 0 ? (
                    <li>{unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete</li>
                  ) : null}
                  {skippedReadings > 0 ? (
                    <li>{skippedReadings} reading{skippedReadings === 1 ? "" : "s"} skipped (do not count)</li>
                  ) : null}
                  {missingFinals > 0 ? (
                    <li>{missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission</li>
                  ) : null}
                  {draftAssignments > 0 ? (
                    <li>{draftAssignments} assignment{draftAssignments === 1 ? "" : "s"} with draft only</li>
                  ) : null}
                </ul>
              </div>
            )}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Next Required Action</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            {nextAction ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {nextAction.title}
                </p>
                <p>{nextAction.reason}</p>
              </>
            ) : (
              <p>All required work in this module is complete.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Readings</h2>
          </div>

          {readings?.length ? (
            <div className="space-y-4">
              {readings.map((reading) => {
                const meta = [
                  reading.author,
                  reading.source_type,
                  reading.primary_or_secondary,
                  reading.tradition_or_era,
                  reading.pages_or_length,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={reading.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
                  >
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Reading {reading.position + 1}
                        </p>
                        <h3 className="text-lg font-semibold">{reading.title}</h3>
                        {meta ? (
                          <p className="text-sm text-[var(--muted)]">{meta}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>Status {reading.status.replace(/_/g, " ")}</span>
                      </div>
                  </div>
                  {isReadingSkipped(reading.status) ? (
                    <p className="text-xs text-[var(--muted)]">
                      Administratively skipped (does not count toward completion).
                    </p>
                  ) : null}

                    {reading.reference_url_or_citation ? (
                      <p className="text-sm text-[var(--muted)]">
                        Reference: {reading.reference_url_or_citation}
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
                        Update status
                      </label>
                      <select
                        name="status"
                        defaultValue={reading.status}
                        className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        {readingStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                      >
                        Save
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No readings assigned to this module yet.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Assignments</h2>
          </div>

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
              No assignments assigned to this module yet.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
