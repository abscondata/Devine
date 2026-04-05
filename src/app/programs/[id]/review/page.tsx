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

export default async function ProgramReviewPacketPage({
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

  const { data: courses } = await supabase
    .from("courses")
    .select("id, code, title")
    .eq("program_id", id);

  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, is_final, created_at, assignment_id")
    .eq("user_id", user.id);

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);

  const { data: critiques } = finalSubmissions.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissions.map((final) => final.id))
    : { data: [] };

  const rsynCourse = (courses ?? []).find((course) => course.code === "RSYN 720") ?? null;
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
  const thesisSummary = rsynCourse
    ? thesisProject
      ? summarizeThesisProject({
          project: thesisProject,
          milestones: thesisMilestones ?? [],
          finalSubmissionIds: new Set(finalSubmissions.map((final) => final.id)),
        })
      : buildMissingThesisSummary()
    : null;

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: `/programs/${program.id}/record`, label: "Academic record" }}
        documentType="Program Review Packet"
        title={program.title}
        description="A consolidated index of Devine's formal academic records and standards."
        recordDate={recordDate}
      >
        <DocumentSection title="Program Overview">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            <p>
              This review packet gathers the formal institutional surfaces that
              document Devine College Core's standards, curriculum, and recorded
              academic work. It is not a marketing brochure or public catalog.
            </p>
            <p>
              Courses recorded: {courses?.length ?? 0}. Final submissions recorded:{" "}
              {finalSubmissions.length}. Critiques recorded: {critiques?.length ?? 0}.
            </p>
          </div>
        </DocumentSection>

        <DocumentSection title="Formal Records">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Program Charter</span>
              <Link href={`/programs/${program.id}/charter`}>Open</Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Academic Record</span>
              <Link href={`/programs/${program.id}/record`}>Open</Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Research and Synthesis Register</span>
              <Link href={`/programs/${program.id}/research`}>Open</Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Thesis Dossier</span>
              <Link href={`/programs/${program.id}/thesis`}>Open</Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Academic Work Record</span>
              <Link href={`/programs/${program.id}/work`}>Open</Link>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Academic Chronology</span>
              <Link href={`/programs/${program.id}/chronology`}>Open</Link>
            </div>
          </div>
        </DocumentSection>

        <DocumentSection title="Thesis Status">
          {rsynCourse ? (
            thesisSummary && thesisSummary.hasProject ? (
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
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                No thesis project is recorded yet.
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              RSYN 720 is not recorded for this program.
            </div>
          )}
        </DocumentSection>

        <DocumentSection title="Course Dossiers">
          {courses?.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
              <p>
                Course dossiers provide detailed curriculum and standing records for
                each course in the program.
              </p>
              <p className="text-xs text-[var(--muted)]">
                Use the Academic Record to access individual dossiers.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No courses are recorded yet.
            </div>
          )}
        </DocumentSection>
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
