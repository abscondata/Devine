import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildMissingThesisSummary,
  summarizeThesisProject,
} from "@/lib/thesis-governance";
import { getReviewProgram } from "@/lib/review-access";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReviewThesisDossierPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await getReviewProgram(token);
  if (!review) {
    notFound();
  }
  const { program } = review;
  const admin = createAdminClient();

  const { data: rsynCourse } = await admin
    .from("courses")
    .select("id, title, code")
    .eq("program_id", program.id)
    .eq("code", "RSYN 720")
    .maybeSingle();

  const { data: thesisProject } = rsynCourse
    ? await admin
        .from("thesis_projects")
        .select(
          "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
        )
        .eq("program_id", program.id)
        .eq("course_id", rsynCourse.id)
        .maybeSingle()
    : { data: null };

  const { data: thesisMilestones } = thesisProject
    ? await admin
        .from("thesis_milestones")
        .select(
          "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
        )
        .eq("thesis_project_id", thesisProject.id)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: finalSubmissions } = await admin
    .from("submissions")
    .select("id")
    .eq("user_id", program.owner_id)
    .eq("is_final", true);

  const thesisSummary = thesisProject
    ? summarizeThesisProject({
        project: thesisProject,
        milestones: thesisMilestones ?? [],
        finalSubmissionIds: new Set((finalSubmissions ?? []).map((row) => row.id)),
      })
    : buildMissingThesisSummary();

  const recordDate = formatDate(new Date().toISOString());

  return (
    <FormalDocumentLayout
      backLink={{ href: `/review/${token}/research`, label: "Research register" }}
      documentType="Thesis Dossier"
      title={thesisProject?.title ?? "Thesis Project"}
      description="Formal dossier for the terminal synthesis project."
      recordDate={recordDate}
      actions={[
        { href: `/review/${token}/record`, label: "Academic record" },
        { href: `/review/${token}/work`, label: "Academic work record" },
      ]}
    >
      <DocumentSection title="Program and Course">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            Program: <span className="text-[var(--text)]">{program.title}</span>
          </p>
          <p>
            Course:{" "}
            <span className="text-[var(--text)]">
              {rsynCourse ? `${rsynCourse.code} — ${rsynCourse.title}` : "RSYN 720 not recorded"}
            </span>
          </p>
        </div>
      </DocumentSection>

      <DocumentSection title="Project Status">
        {thesisProject ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            <p className="text-sm font-semibold text-[var(--text)]">
              {thesisSummary.statusLabel}
            </p>
            <p>
              Required milestones complete {thesisSummary.requiredCompleted}/
              {thesisSummary.requiredTotal}.
            </p>
            <p>
              Candidacy readiness:{" "}
              {thesisSummary.candidacyReady ? "Established" : "Not yet established"}.
            </p>
            <p>
              Final thesis status:{" "}
              {thesisSummary.finalThesisReady ? "Final recorded" : "Not yet final"}.
            </p>
            <p>
              Final synthesis reflection:{" "}
              {thesisSummary.finalSynthesisReady ? "Recorded" : "Not yet recorded"}.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No thesis project is recorded yet.
          </div>
        )}
      </DocumentSection>

      <DocumentSection title="Research Question and Scope">
        {thesisProject ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 text-sm text-[var(--muted)]">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Research Question
              </p>
              <p>{thesisProject.research_question}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Governing Problem
              </p>
              <p>{thesisProject.governing_problem}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Scope Statement
              </p>
              <p>{thesisProject.scope_statement}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Thesis Claim
              </p>
              <p>{thesisProject.thesis_claim ?? "Not yet defined."}</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No thesis question, scope, or claim is recorded yet.
          </div>
        )}
      </DocumentSection>

      <DocumentSection title="Milestone Ledger">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[1fr_140px_160px]">
            <span>Milestone</span>
            <span>Status</span>
            <span>Artifact</span>
          </div>
          <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
            {thesisSummary.milestones.map((milestone) => (
              <div
                key={milestone.key}
                className="grid gap-2 md:grid-cols-[1fr_140px_160px]"
              >
                <span>{milestone.title}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {milestone.completed ? `Complete ${formatDate(milestone.completed_at)}` : "Pending"}
                </span>
                <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {milestone.submission_id ? (
                    <Link href={`/review/${token}/submissions/${milestone.submission_id}`}>
                      Final record
                    </Link>
                  ) : (
                    "--"
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      </DocumentSection>
    </FormalDocumentLayout>
  );
}
