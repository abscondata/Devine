import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  runCritique,
  setFinalSubmission,
  submitAssignment,
} from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function AssignmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      "id, title, instructions, assignment_type, due_at, module:modules(id, title, course:courses(id, title))"
    )
    .eq("id", id)
    .single();

  if (!assignment) {
    notFound();
  }

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, content, version, is_final, created_at")
    .eq("assignment_id", assignment.id)
    .eq("user_id", user.id)
    .order("version", { ascending: false });

  const submissionIds = submissions?.map((submission) => submission.id) ?? [];

  const { data: critiques } = submissionIds.length
    ? await supabase
        .from("critiques")
        .select(
          "id, submission_id, submission_version, model, prompt_version, overall_verdict, thesis_strength, structural_failures, unsupported_claims, vague_terms, strongest_objection, doctrinal_or_historical_imprecision, rewrite_priorities, score, critique_json, created_at"
        )
        .in("submission_id", submissionIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const critiquesBySubmission = new Map<string, typeof critiques>();
  critiques?.forEach((critique) => {
    const list = critiquesBySubmission.get(critique.submission_id) ?? [];
    list.push(critique);
    critiquesBySubmission.set(critique.submission_id, list);
  });

  const finalSubmission = submissions?.find((submission) => submission.is_final);
  const latestVersion = submissions?.[0]?.version ?? null;
  const latestSubmission = submissions?.[0] ?? null;
  const latestCritique = latestSubmission
    ? (critiquesBySubmission.get(latestSubmission.id) ?? [])[0]
    : null;
  const finalCritique = finalSubmission
    ? (critiquesBySubmission.get(finalSubmission.id) ?? [])[0]
    : null;
  const hasFinal = Boolean(finalSubmission);
  const hasPostFinalDrafts =
    hasFinal && latestVersion !== null && finalSubmission
      ? latestVersion > finalSubmission.version
      : false;

  const standingSummary = latestSubmission
    ? hasFinal
      ? `Final locked at version ${finalSubmission?.version ?? latestSubmission.version}.`
      : `Draft in progress (latest version ${latestSubmission.version}).`
    : "No submission yet.";

  const nextAction = !latestSubmission
    ? {
        title: "Draft your first submission.",
        reason: "No submission exists for this assignment yet.",
      }
    : hasFinal
    ? finalCritique
      ? {
          title: "Review critique; revisions require an explicit unlock.",
          reason: "Final submissions are locked and cannot be revised without an unlock.",
        }
      : {
          title: "Run critique (recommended) to review the final.",
          reason: "Critique is advisory but provides formal review.",
        }
    : latestCritique
    ? {
        title: "Revise draft based on critique.",
        reason: "Drafts do not count toward official completion.",
      }
    : {
        title: "Run critique (recommended) before finalizing.",
        reason: "Critique provides diagnostic review before final lock.",
      };

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
            <span>/</span>
            <Link href={`/courses/${assignment.module?.course?.id}`}>
              {assignment.module?.course?.title ?? "Course"}
            </Link>
            <span>/</span>
            <Link href={`/modules/${assignment.module?.id}`}>
              {assignment.module?.title ?? "Unit"}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
            {assignment.due_at ? <span>Due {formatDate(assignment.due_at)}</span> : null}
            <span>{hasFinal ? "Final submitted" : latestSubmission ? `Draft v${latestSubmission.version}` : "Not submitted"}</span>
          </div>
          <h1 className="text-3xl">{assignment.title}</h1>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg">Instructions</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="font-serif text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {assignment.instructions}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg">Your Submission</h2>

          {error ? (
            <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          {hasFinal && finalSubmission ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)] space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Final lock
              </p>
              <p>
                Final submission locked at version {finalSubmission.version} on{" "}
                {formatDate(finalSubmission.created_at)}. Further revisions
                require an explicit unlock.
              </p>
            </div>
          ) : (
            <form action={submitAssignment} className="space-y-4">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <textarea
                name="content"
                rows={12}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-serif leading-relaxed"
              />
              <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
                <input
                  type="checkbox"
                  name="markFinal"
                  className="h-4 w-4 rounded border border-[var(--border)]"
                />
                Mark this submission as final (locks further submissions)
              </label>
              <button
                type="submit"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                Submit
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg">Standing</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            <p className="text-sm font-semibold text-[var(--text)]">
              {standingSummary}
            </p>
            {latestSubmission ? (
              <p>
                Latest submission date {formatDate(latestSubmission.created_at)}.
              </p>
            ) : null}
            {finalSubmission ? (
              <p>
                Final submission date {formatDate(finalSubmission.created_at)}.
              </p>
            ) : null}
            <div className="pt-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Next required action
              </p>
              <p className="text-sm font-semibold text-[var(--text)]">
                {nextAction.title}
              </p>
              <p>{nextAction.reason}</p>
            </div>
          </div>
        </section>

        {/* ─���─ Submission record ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Submission Record</h2>
          {submissions?.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {submissions.map((submission) => {
                const critiqueList = critiquesBySubmission.get(submission.id) ?? [];
                const isLatest = latestVersion === submission.version;
                const latestCritiqueForVersion = critiqueList[0];

                return (
                  <div key={submission.id} className="p-5 space-y-4">
                    {/* Version header */}
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>Version {submission.version}</span>
                        <span>{submission.is_final ? "Final" : "Draft"}</span>
                        <span>{formatDate(submission.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!submission.is_final && !hasFinal && isLatest ? (
                          <form action={setFinalSubmission}>
                            <input type="hidden" name="submissionId" value={submission.id} />
                            <input type="hidden" name="assignmentId" value={assignment.id} />
                            <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                              Mark final
                            </button>
                          </form>
                        ) : null}
                        <form action={runCritique}>
                          <input type="hidden" name="submissionId" value={submission.id} />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                            Request critique
                          </button>
                        </form>
                      </div>
                    </div>

                    {/* Submission text — shown for latest/final, collapsed hint for older */}
                    {(isLatest || submission.is_final) ? (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-serif text-sm leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto">
                        {submission.content}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        {submission.content.length} characters · Expand assignment to view full text.
                      </p>
                    )}

                    {/* Critique �� structured academic feedback */}
                    {latestCritiqueForVersion ? (
                      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                        <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          <span>Critique</span>
                          <span>{formatDate(latestCritiqueForVersion.created_at)}</span>
                          {latestCritiqueForVersion.score !== null && latestCritiqueForVersion.score !== undefined ? (
                            <span>Score {latestCritiqueForVersion.score}</span>
                          ) : null}
                        </div>

                        {/* Assessment — the most important part, shown first */}
                        {latestCritiqueForVersion.overall_verdict ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Assessment</p>
                            <p className="font-serif text-sm leading-relaxed">{latestCritiqueForVersion.overall_verdict}</p>
                          </div>
                        ) : null}

                        {/* Strengths */}
                        {latestCritiqueForVersion.thesis_strength ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Thesis strength</p>
                            <p className="text-sm text-[var(--muted)]">{latestCritiqueForVersion.thesis_strength}</p>
                          </div>
                        ) : null}

                        {/* Critical issues ��� grouped */}
                        {(() => {
                          const issues = [
                            ...(latestCritiqueForVersion.structural_failures ?? []).map((i: string) => ({ label: "Structure", text: i })),
                            ...(latestCritiqueForVersion.unsupported_claims ?? []).map((i: string) => ({ label: "Unsupported", text: i })),
                            ...(latestCritiqueForVersion.doctrinal_or_historical_imprecision ?? []).map((i: string) => ({ label: "Precision", text: i })),
                            ...(latestCritiqueForVersion.vague_terms ?? []).map((i: string) => ({ label: "Vague", text: i })),
                          ];
                          return issues.length ? (
                            <div className="space-y-1">
                              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Issues identified</p>
                              <ul className="space-y-1 text-sm text-[var(--muted)]">
                                {issues.map((issue, idx) => (
                                  <li key={idx}><span className="text-xs uppercase tracking-[0.2em]">{issue.label}:</span> {issue.text}</li>
                                ))}
                              </ul>
                            </div>
                          ) : null;
                        })()}

                        {/* Strongest objection */}
                        {latestCritiqueForVersion.strongest_objection ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Strongest objection</p>
                            <p className="text-sm text-[var(--muted)]">{latestCritiqueForVersion.strongest_objection}</p>
                          </div>
                        ) : null}

                        {/* Revision direction */}
                        {(latestCritiqueForVersion.rewrite_priorities ?? []).length ? (
                          <div className="space-y-1">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Revision priorities</p>
                            <ol className="space-y-1 text-sm text-[var(--muted)]">
                              {(latestCritiqueForVersion.rewrite_priorities as string[]).map((item: string, idx: number) => (
                                <li key={idx}>{item}</li>
                              ))}
                            </ol>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No submissions yet.</p>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
