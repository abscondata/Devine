import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  deriveThesisStatus,
  getThesisStatusLabel,
  summarizeThesisProject,
} from "@/lib/thesis-governance";
import {
  updateThesisProject,
  updateThesisMilestone,
} from "@/lib/actions";
import { FormalDocumentLayout, DocumentSection } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ThesisAdminDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/admin/thesis?error=Thesis project not found.");
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, owner_id")
    .eq("id", project.program_id)
    .single();

  if (!program) {
    redirect("/admin/thesis?error=Program not found.");
  }

  const { data: membership } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", program.id)
    .eq("user_id", user.id)
    .maybeSingle();

  const allowedRoles = new Set(["owner", "admin", "staff"]);
  if (program.owner_id !== user.id && !allowedRoles.has(membership?.role ?? "")) {
    redirect("/dashboard?error=Access denied.");
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id, code, title")
    .eq("id", project.course_id)
    .single();

  const { data: milestones } = await supabase
    .from("thesis_milestones")
    .select(
      "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
    )
    .eq("thesis_project_id", project.id)
    .order("position", { ascending: true });

  const milestoneSubmissionIds = (milestones ?? [])
    .map((milestone) => milestone.submission_id)
    .filter((id): id is string => Boolean(id));

  const { data: finalSubmissionsForMilestones } = milestoneSubmissionIds.length
    ? await supabase
        .from("submissions")
        .select("id, is_final")
        .in("id", milestoneSubmissionIds)
        .eq("is_final", true)
    : { data: [] as { id: string; is_final: boolean }[] };

  const finalSubmissionIds = new Set(
    (finalSubmissionsForMilestones ?? []).map((submission) => submission.id)
  );

  const summary = summarizeThesisProject({
    project,
    milestones: milestones ?? [],
    finalSubmissionIds,
  });
  const derivedStatus = deriveThesisStatus(summary);
  const statusLabel = getThesisStatusLabel(derivedStatus);

  const { data: modules } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", project.course_id);

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, title, assignment_type, module_id")
        .in("module_id", moduleIds)
    : { data: [] as { id: string; title: string; assignment_type: string; module_id: string }[] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, version, is_final, created_at")
        .eq("user_id", program.owner_id)
        .in("assignment_id", assignmentIds)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; assignment_id: string; version: number; is_final: boolean; created_at: string }[] };

  const assignmentById = new Map(
    (assignments ?? []).map((assignment) => [assignment.id, assignment])
  );

  const submissionOptions = (submissions ?? []).map((submission) => {
    const assignment = assignmentById.get(submission.assignment_id);
    const labelParts = [
      assignment?.title ?? "Assignment",
      `v${submission.version}`,
      submission.is_final ? "final" : "draft",
      formatDate(submission.created_at),
    ];
    return {
      id: submission.id,
      isFinal: submission.is_final,
      label: labelParts.filter(Boolean).join(" · "),
    };
  });

  const recordDate = formatDate(new Date().toISOString());

  return (
    <FormalDocumentLayout
      backLink={{ href: "/admin/thesis", label: "Thesis administration" }}
      documentType="Thesis Dossier (Administration)"
      title={project.title}
      description={`RSYN 720 · ${course?.title ?? "Research and Synthesis"}`}
      recordDate={recordDate}
      actions={[
        { href: `/programs/${program.id}/thesis`, label: "Public thesis dossier" },
      ]}
    >
      <DocumentSection title="Thesis Identity">
        <form
          action={updateThesisProject}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 text-sm text-[var(--muted)]"
        >
          <input type="hidden" name="projectId" value={project.id} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Program
              </label>
              <p className="text-[var(--text)]">{program.title}</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Status
              </label>
              <p className="text-[var(--text)]">{statusLabel}</p>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Thesis Title
            </label>
            <input
              name="title"
              defaultValue={project.title}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Research Question
            </label>
            <input
              name="researchQuestion"
              defaultValue={project.research_question}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Governing Problem
            </label>
            <textarea
              name="governingProblem"
              defaultValue={project.governing_problem}
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Thesis Claim (Optional)
            </label>
            <textarea
              name="thesisClaim"
              defaultValue={project.thesis_claim ?? ""}
              rows={2}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Scope Statement
            </label>
            <textarea
              name="scopeStatement"
              defaultValue={project.scope_statement}
              rows={3}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Candidacy established: {formatDate(project.candidacy_established_at)} ·
            Prospectus locked: {formatDate(project.prospectus_locked_at)} · Final
            submitted: {formatDate(project.final_submitted_at)}
          </div>
          <button
            type="submit"
            className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
          >
            Update thesis metadata
          </button>
        </form>
      </DocumentSection>

      <DocumentSection title="Milestone Ledger">
        <div className="space-y-4">
          {(milestones ?? []).map((milestone) => {
            const isFinalMilestone =
              milestone.milestone_key === "final_thesis" ||
              milestone.milestone_key === "final_synthesis_reflection";
            const options = submissionOptions.filter(
              (option) => !isFinalMilestone || option.isFinal
            );
            return (
              <div
                key={milestone.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Milestone {milestone.position + 1}
                    </p>
                    <h3 className="text-base font-semibold text-[var(--text)]">
                      {milestone.title}
                    </h3>
                    <p>
                      Required: {milestone.required ? "Yes" : "No"} · Completed:{" "}
                      {milestone.completed_at ? "Yes" : "No"}
                    </p>
                    <p>Completed at: {formatTimestamp(milestone.completed_at)}</p>
                  </div>
                  {milestone.submission_id ? (
                    <Link
                      href={`/submissions/${milestone.submission_id}/record`}
                      className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                    >
                      View submission record
                    </Link>
                  ) : null}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <form action={updateThesisMilestone} className="space-y-2">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="milestoneId" value={milestone.id} />
                    <input type="hidden" name="action" value="complete" />
                    <div className="space-y-1">
                      <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Linked submission
                      </label>
                      <select
                        name="submissionId"
                        defaultValue={milestone.submission_id ?? ""}
                        required
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      >
                        <option value="">Select submission</option>
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {isFinalMilestone ? (
                        <p className="text-xs text-[var(--muted)]">
                          Final milestones require a final locked submission.
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
                    >
                      Mark complete
                    </button>
                  </form>
                  <form action={updateThesisMilestone} className="flex items-end">
                    <input type="hidden" name="projectId" value={project.id} />
                    <input type="hidden" name="milestoneId" value={milestone.id} />
                    <input type="hidden" name="action" value="clear" />
                    <button
                      type="submit"
                      className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
                    >
                      Clear
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      </DocumentSection>
    </FormalDocumentLayout>
  );
}
