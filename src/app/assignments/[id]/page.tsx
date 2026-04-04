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
      <div className="space-y-10">
        <header className="space-y-3">
          <Link
            href={`/modules/${assignment.module?.id}`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            {assignment.module?.title ?? "Module"}
          </Link>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
              {assignment.module?.course?.title ?? "Course"}
            </p>
            <h1 className="text-3xl font-semibold">{assignment.title}</h1>
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
              <span>{assignment.due_at ? formatDate(assignment.due_at) : "No deadline"}</span>
            </div>
          </div>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Instructions</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="markdown whitespace-pre-wrap text-sm text-[var(--muted)]">
              {assignment.instructions}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Submit Work</h2>

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
                rows={10}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
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
                Submit Version
              </button>
            </form>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Assignment Standing</h2>
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

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Submission History</h2>
          {hasPostFinalDrafts && finalSubmission ? (
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
              Drafts exist after the locked final (version {finalSubmission.version}).
              These later drafts do not alter the official record.
            </div>
          ) : null}
          {submissions?.length ? (
            <div className="space-y-6">
              {submissions.map((submission) => {
                const critiqueList = critiquesBySubmission.get(submission.id) ?? [];
                const isLatest = latestVersion === submission.version;

                return (
                  <div
                    key={submission.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Version {submission.version}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          Submitted {formatDate(submission.created_at)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {submission.is_final ? "Final" : "Draft"}
                        </span>
                        {!submission.is_final && !hasFinal && isLatest ? (
                          <form action={setFinalSubmission}>
                            <input
                              type="hidden"
                              name="submissionId"
                              value={submission.id}
                            />
                            <input
                              type="hidden"
                              name="assignmentId"
                              value={assignment.id}
                            />
                            <button
                              type="submit"
                              className="rounded-md border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                            >
                                Mark Final
                              </button>
                            </form>
                        ) : null}
                        <form action={runCritique}>
                          <input
                            type="hidden"
                            name="submissionId"
                            value={submission.id}
                          />
                          <input
                            type="hidden"
                            name="assignmentId"
                            value={assignment.id}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-[var(--border)] px-3 py-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                          >
                            Run Critique
                          </button>
                        </form>
                      </div>
                    </div>

                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm whitespace-pre-wrap">
                      {submission.content}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                        Critiques
                      </h3>
                      <p className="text-sm text-[var(--muted)]">
                        Critiques are advisory and recommended for depth. Official completion
                        is determined by finalized submissions and completed readings, not by
                        critique presence.
                      </p>
                      {critiqueList.length ? (
                        <div className="space-y-4">
                          {critiqueList.map((critique) => {
                            const structuralFailures = critique.structural_failures ?? [];
                            const unsupportedClaims = critique.unsupported_claims ?? [];
                            const vagueTerms = critique.vague_terms ?? [];
                            const doctrinalImprecision =
                              critique.doctrinal_or_historical_imprecision ?? [];
                            const rewritePriorities = critique.rewrite_priorities ?? [];

                            return (
                              <div
                                key={critique.id}
                                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
                              >
                                <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  <span>Version {critique.submission_version}</span>
                                  <span>{formatDate(critique.created_at)}</span>
                                  {critique.model ? <span>{critique.model}</span> : null}
                                  {critique.prompt_version ? (
                                    <span>Prompt {critique.prompt_version}</span>
                                  ) : null}
                                  {critique.score !== null && critique.score !== undefined ? (
                                    <span>Score {critique.score}</span>
                                  ) : null}
                                </div>
                                <p className="text-xs text-[var(--muted)]">
                                  Critique attached to submission version{" "}
                                  {critique.submission_version}.
                                </p>

                              {critique.overall_verdict ? (
                                <p className="text-sm">
                                  <span className="font-semibold">Verdict:</span>{" "}
                                  {critique.overall_verdict}
                                </p>
                              ) : null}

                              {critique.thesis_strength ? (
                                <p className="text-sm">
                                  <span className="font-semibold">Thesis strength:</span>{" "}
                                  {critique.thesis_strength}
                                </p>
                              ) : null}

                              {critique.strongest_objection ? (
                                <p className="text-sm">
                                  <span className="font-semibold">Strongest objection:</span>{" "}
                                  {critique.strongest_objection}
                                </p>
                              ) : null}

                              {structuralFailures.length ? (
                                <div className="text-sm">
                                  <p className="font-semibold">Structural failures</p>
                                  <ul className="list-disc pl-5 text-[var(--muted)]">
                                    {structuralFailures.map((item, index) => (
                                      <li key={`${critique.id}-sf-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {unsupportedClaims.length ? (
                                <div className="text-sm">
                                  <p className="font-semibold">Unsupported claims</p>
                                  <ul className="list-disc pl-5 text-[var(--muted)]">
                                    {unsupportedClaims.map((item, index) => (
                                      <li key={`${critique.id}-uc-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {vagueTerms.length ? (
                                <div className="text-sm">
                                  <p className="font-semibold">Vague terms</p>
                                  <ul className="list-disc pl-5 text-[var(--muted)]">
                                    {vagueTerms.map((item, index) => (
                                      <li key={`${critique.id}-vt-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {doctrinalImprecision.length ? (
                                <div className="text-sm">
                                  <p className="font-semibold">
                                    Doctrinal or historical imprecision
                                  </p>
                                  <ul className="list-disc pl-5 text-[var(--muted)]">
                                    {doctrinalImprecision.map((item, index) => (
                                      <li key={`${critique.id}-dh-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}

                              {rewritePriorities.length ? (
                                <div className="text-sm">
                                  <p className="font-semibold">Rewrite priorities</p>
                                  <ul className="list-disc pl-5 text-[var(--muted)]">
                                    {rewritePriorities.map((item, index) => (
                                      <li key={`${critique.id}-rp-${index}`}>{item}</li>
                                    ))}
                                  </ul>
                                </div>
                              ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">No critiques yet.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No submissions yet.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
