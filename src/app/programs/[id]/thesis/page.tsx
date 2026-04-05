import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildMissingThesisSummary,
  summarizeThesisProject,
} from "@/lib/thesis-governance";
import { ReviewShell } from "@/components/review-shell";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ThesisDossierPage({
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

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  const { data: rsynCourse } = await supabase
    .from("courses")
    .select("id, title, code")
    .eq("program_id", program.id)
    .eq("code", "RSYN 720")
    .maybeSingle();

  const { data: thesisProject } = rsynCourse
    ? await supabase
        .from("thesis_projects")
        .select(
          "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
        )
        .eq("program_id", program.id)
        .eq("course_id", rsynCourse.id)
        .maybeSingle()
    : { data: null };

  const { data: thesisMilestones } = thesisProject
    ? await supabase
        .from("thesis_milestones")
        .select(
          "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
        )
        .eq("thesis_project_id", thesisProject.id)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: finalSubmissions } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", user.id)
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
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: `/programs/${program.id}/research`, label: "Research register" }}
        documentType="Thesis Dossier"
        title={thesisProject?.title ?? "Thesis Project"}
        description="Formal dossier for the terminal synthesis project."
        recordDate={recordDate}
        actions={[
          { href: `/programs/${program.id}/record`, label: "Academic record" },
          { href: `/programs/${program.id}/work`, label: "Academic work record" },
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
                {thesisSummary.finalSynthesisReady
                  ? "Recorded"
                  : "Not yet recorded"}
                .
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
                      <Link href={`/submissions/${milestone.submission_id}/record`}>
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
    </ReviewShell>
  );
}
