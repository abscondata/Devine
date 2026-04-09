import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCritiqueSummary, getFinalSubmissionSummary } from "@/lib/scholarly-evaluation";
import { getReviewProgram } from "@/lib/review-access";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReviewFinalSubmissionRecordPage({
  params,
}: {
  params: Promise<{ token: string; submissionId: string }>;
}) {
  const { token, submissionId } = await params;
  const review = await getReviewProgram(token);
  if (!review) {
    notFound();
  }
  const { program } = review;
  const admin = createAdminClient();

  const { data: submission } = await admin
    .from("submissions")
    .select("id, assignment_id, user_id, content, version, is_final, created_at")
    .eq("id", submissionId)
    .eq("user_id", program.owner_id)
    .single();

  if (!submission || !submission.is_final) {
    notFound();
  }

  const { data: assignment } = await admin
    .from("assignments")
    .select("id, title, assignment_type, module_id")
    .eq("id", submission.assignment_id)
    .single();

  if (!assignment) {
    notFound();
  }

  const { data: module } = await admin
    .from("modules")
    .select("id, title, position, course_id")
    .eq("id", assignment.module_id)
    .single();

  if (!module) {
    notFound();
  }

  const { data: course } = await admin
    .from("courses")
    .select("id, title, code, program_id")
    .eq("id", module.course_id)
    .single();

  if (!course || course.program_id !== program.id) {
    notFound();
  }

  const { data: critique } = await admin
    .from("critiques")
    .select("id, submission_id, submission_version, created_at, overall_verdict")
    .eq("submission_id", submission.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const finalSummary = getFinalSubmissionSummary(submission.version);
  const critiqueSummary = getCritiqueSummary({
    hasCritique: Boolean(critique),
    submissionVersion: submission.version,
    critiqueVersion: critique?.submission_version ?? null,
  });

  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}`}>Program review packet</Link>
          <span>/</span>
          <Link href={`/review/${token}/work`}>Academic work record</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Final Submission Record
        </p>
        <h1 className="text-3xl">{assignment.title}</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{course.code ? `${course.code} — ` : ""}{course.title}</span>
          <span>Unit {module.position + 1}: {module.title}</span>
          <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
          <span>{finalSummary.label}</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Submission context ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Submission Context</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Course</p>
              <p>
                <Link href={`/review/${token}/courses/${course.id}`} className="no-print">
                  {course.code ? `${course.code} — ` : ""}{course.title}
                </Link>
                <span className="hidden print:inline">{course.code ? `${course.code} — ` : ""}{course.title}</span>
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Unit</p>
              <p>{module.title} (Unit {module.position + 1})</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Assignment type</p>
              <p>{assignment.assignment_type.replace(/_/g, " ")}</p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Final status</p>
              <p className="text-[var(--text)]">{finalSummary.label} · {formatDate(submission.created_at)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Critique status ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Critique Status</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm space-y-2">
          {critique ? (
            <>
              <p className="font-semibold text-[var(--text)]">
                {critiqueSummary.detail}
              </p>
              <p className="text-[var(--muted)]">Critique recorded {formatDate(critique.created_at)}.</p>
              {critique.overall_verdict ? (
                <p className="text-[var(--muted)]">Overall verdict: {critique.overall_verdict}.</p>
              ) : null}
            </>
          ) : (
            <p className="text-[var(--muted)]">{critiqueSummary.detail}</p>
          )}
          <p className="text-xs text-[var(--muted)]">
            Critique is recommended for rigor but does not determine official completion.
          </p>
        </div>
      </section>

      {/* ─── Final submission ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Final Submission</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed">
          {submission.content}
        </div>
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · {course.code ?? "Course"} · {assignment.title} · {finalSummary.label} · Generated {now}
        </p>
      </footer>
    </div>
  );
}
