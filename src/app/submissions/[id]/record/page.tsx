import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewShell } from "@/components/review-shell";
import { getCritiqueSummary, getFinalSubmissionSummary } from "@/lib/scholarly-evaluation";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FinalSubmissionRecordPage({
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

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, user_id, content, version, is_final, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!submission || !submission.is_final) {
    notFound();
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, title, assignment_type, module_id")
    .eq("id", submission.assignment_id)
    .single();

  if (!assignment) {
    notFound();
  }

  const { data: module } = await supabase
    .from("modules")
    .select("id, title, position, course_id")
    .eq("id", assignment.module_id)
    .single();

  if (!module) {
    notFound();
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, code, program_id")
    .eq("id", module.course_id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: critique } = await supabase
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

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{
          href: `/programs/${course.program_id}/work`,
          label: "Academic work record",
        }}
        documentType="Final Submission Record"
        title={assignment.title}
        description="Formal record of a finalized academic submission."
        recordDate={recordDate}
        actions={[
          { href: `/assignments/${assignment.id}`, label: "Assignment record" },
          { href: `/courses/${course.id}/dossier`, label: "Course dossier" },
        ]}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Course
              </p>
              <p>
                {course.code ? `${course.code} - ` : ""}
                {course.title}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Module
              </p>
              <p>
                {module.title} (Module {module.position + 1})
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Assignment Type
              </p>
              <p>{assignment.assignment_type}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Final Status
              </p>
              <p className="text-[var(--text)]">
                {finalSummary.label} on {formatDate(submission.created_at)}.
              </p>
            </div>
          </div>
        </div>

        <DocumentSection title="Critique Status">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            {critique ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {critiqueSummary.detail}
                </p>
                <p>Critique date {formatDate(critique.created_at)}.</p>
                {critique.overall_verdict ? (
                  <p>Overall verdict: {critique.overall_verdict}.</p>
                ) : null}
              </>
            ) : (
              <p>{critiqueSummary.detail}</p>
            )}
            <p className="text-xs text-[var(--muted)]">
              Critique is recommended for rigor but does not determine official
              completion.
            </p>
          </div>
        </DocumentSection>

        <DocumentSection title="Final Submission">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--text)] whitespace-pre-wrap">
            {submission.content}
          </div>
        </DocumentSection>
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
