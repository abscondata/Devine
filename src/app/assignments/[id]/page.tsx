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
    month: "long",
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
      "id, title, instructions, assignment_type, due_at, module:modules(id, title, position, course:courses(id, title, code))"
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
  const finalCritique = finalSubmission
    ? (critiquesBySubmission.get(finalSubmission.id) ?? [])[0]
    : null;
  const hasFinal = Boolean(finalSubmission);

  const standingSummary = latestSubmission
    ? hasFinal
      ? `Final locked at version ${finalSubmission?.version ?? latestSubmission.version}.`
      : `Draft in progress (version ${latestSubmission.version}).`
    : "No submission yet.";

  const nextAction = !latestSubmission
    ? { title: "Draft your first submission.", reason: "No submission exists for this assignment yet." }
    : hasFinal
    ? finalCritique
      ? { title: "Review the critique.", reason: "Final is locked. Revisions require an explicit unlock." }
      : { title: "Run critique on the final submission.", reason: "Critique is advisory but provides formal academic review." }
    : { title: "Finalize or continue revising.", reason: "Drafts do not count toward official completion." };

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ─── Header ─── */}
        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">Home</Link>
            <span>/</span>
            <Link href={`/courses/${assignment.module?.course?.id}`}>
              {assignment.module?.course?.code ?? "Course"}
            </Link>
            <span>/</span>
            <Link href={`/modules/${assignment.module?.id}`}>
              Unit {(assignment.module?.position ?? 0) + 1}
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
            {assignment.due_at ? <span>Due {formatDate(assignment.due_at)}</span> : null}
            <span>{standingSummary}</span>
          </div>
          <h1 className="text-3xl">{assignment.title}</h1>
        </header>

        {/* ─── Prompt ─── */}
        <section className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Assignment prompt</p>
          <div className="prose-width">
            <p className="font-serif text-[var(--text)] leading-relaxed whitespace-pre-wrap">
              {assignment.instructions}
            </p>
          </div>
        </section>

        {/* ─── Next action ─── */}
        <section className="space-y-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Next required action</p>
          <p className="text-sm font-semibold">{nextAction.title}</p>
          <p className="text-sm text-[var(--muted)]">{nextAction.reason}</p>
        </section>

        {/* ─── Writing area ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Submission</h2>

          {error ? (
            <div className="border-l-2 border-[var(--danger)] pl-4 py-2 text-sm text-[var(--danger)]">
              {error}
            </div>
          ) : null}

          {hasFinal && finalSubmission ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>Final · Version {finalSubmission.version}</span>
                <span>{formatDate(finalSubmission.created_at)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
                <div className="font-serif text-sm leading-relaxed whitespace-pre-wrap prose-width">
                  {finalSubmission.content}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <form action={runCritique}>
                  <input type="hidden" name="submissionId" value={finalSubmission.id} />
                  <input type="hidden" name="assignmentId" value={assignment.id} />
                  <button type="submit" className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent-soft)] transition">
                    Request critique
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <form action={submitAssignment} className="space-y-4">
              <input type="hidden" name="assignmentId" value={assignment.id} />
              <textarea
                name="content"
                rows={16}
                required
                placeholder="Begin writing here."
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-5 py-4 font-serif leading-relaxed text-[var(--text)] prose-width placeholder:text-[var(--muted)]/40 focus:outline-none focus:border-[var(--accent-soft)]"
              />
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
                  <input
                    type="checkbox"
                    name="markFinal"
                    className="h-4 w-4 rounded border-[var(--border)]"
                  />
                  Mark as final submission
                </label>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-5 py-2 text-sm text-white transition hover:bg-[var(--accent-soft)]"
                >
                  Submit
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ─── Critique ─── */}
        {finalCritique ? (
          <section className="space-y-3">
            <div className="border-b border-[var(--border)] pb-2">
              <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <h2 className="text-lg">Critique</h2>
                <span>{formatDate(finalCritique.created_at)}</span>
                {finalCritique.score !== null && finalCritique.score !== undefined ? (
                  <span>Score {finalCritique.score}</span>
                ) : null}
              </div>
            </div>

            {finalCritique.overall_verdict ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Assessment</p>
                <p className="font-serif text-sm leading-relaxed prose-width">{finalCritique.overall_verdict}</p>
              </div>
            ) : null}

            {finalCritique.thesis_strength ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Thesis strength</p>
                <p className="text-sm text-[var(--muted)] prose-width">{finalCritique.thesis_strength}</p>
              </div>
            ) : null}

            {(() => {
              const issues = [
                ...(finalCritique.structural_failures ?? []).map((i: string) => ({ label: "Structure", text: i })),
                ...(finalCritique.unsupported_claims ?? []).map((i: string) => ({ label: "Unsupported", text: i })),
                ...(finalCritique.doctrinal_or_historical_imprecision ?? []).map((i: string) => ({ label: "Precision", text: i })),
                ...(finalCritique.vague_terms ?? []).map((i: string) => ({ label: "Vague", text: i })),
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

            {finalCritique.strongest_objection ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Strongest objection</p>
                <p className="text-sm text-[var(--muted)] prose-width">{finalCritique.strongest_objection}</p>
              </div>
            ) : null}

            {(finalCritique.rewrite_priorities ?? []).length ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Revision priorities</p>
                <ol className="space-y-1 text-sm text-[var(--muted)] list-decimal pl-5">
                  {(finalCritique.rewrite_priorities as string[]).map((item: string, idx: number) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}

        {/* ─── Submission history ─── */}
        {(submissions?.length ?? 0) > (hasFinal ? 1 : 0) ? (
          <section className="space-y-3">
            <h2 className="text-lg">Submission History</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {submissions?.filter((s) => !s.is_final).map((submission) => {
                const critiqueList = critiquesBySubmission.get(submission.id) ?? [];
                const isLatest = latestVersion === submission.version;
                const latestCritiqueForVersion = critiqueList[0];

                return (
                  <div key={submission.id} className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        <span>Version {submission.version}</span>
                        <span>Draft</span>
                        <span>{formatDate(submission.created_at)}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!hasFinal && isLatest ? (
                          <form action={setFinalSubmission}>
                            <input type="hidden" name="submissionId" value={submission.id} />
                            <input type="hidden" name="assignmentId" value={assignment.id} />
                            <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] transition">
                              Mark final
                            </button>
                          </form>
                        ) : null}
                        <form action={runCritique}>
                          <input type="hidden" name="submissionId" value={submission.id} />
                          <input type="hidden" name="assignmentId" value={assignment.id} />
                          <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] transition">
                            Request critique
                          </button>
                        </form>
                      </div>
                    </div>

                    {isLatest ? (
                      <div className="font-serif text-sm leading-relaxed text-[var(--muted)] whitespace-pre-wrap max-h-48 overflow-y-auto">
                        {submission.content}
                      </div>
                    ) : (
                      <p className="text-xs text-[var(--muted)]">
                        {submission.content.length} characters
                      </p>
                    )}

                    {latestCritiqueForVersion ? (
                      <div className="border-t border-[var(--border)] pt-3 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Critique · {formatDate(latestCritiqueForVersion.created_at)}
                        </p>
                        {latestCritiqueForVersion.overall_verdict ? (
                          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{latestCritiqueForVersion.overall_verdict}</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
