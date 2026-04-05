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

export default async function ReviewPacketPage({
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

  const { data: courses } = await admin
    .from("courses")
    .select("id, code, title")
    .eq("program_id", program.id);

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await admin
        .from("modules")
        .select("id, course_id")
        .in("course_id", courseIds)
    : { data: [] };

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: assignments } = moduleIds.length
    ? await admin
        .from("assignments")
        .select("id, module_id")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await admin
        .from("submissions")
        .select("id, is_final, created_at")
        .eq("user_id", program.owner_id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await admin
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const rsynCourse = (courses ?? []).find((course) => course.code === "RSYN 720") ?? null;
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
    <FormalDocumentLayout
      documentType="Program Review Packet"
      title={program.title}
      description="A consolidated index of Devine's formal academic records and standards."
      recordDate={recordDate}
      actions={[
        { href: `/review/${token}/charter`, label: "Program charter" },
        { href: `/review/${token}/record`, label: "Academic record" },
        { href: `/review/${token}/research`, label: "Research register" },
        { href: `/review/${token}/work`, label: "Academic work record" },
        { href: `/review/${token}/chronology`, label: "Academic chronology" },
      ]}
    >
      <DocumentSection title="Program Overview">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            This review packet gathers the formal institutional surfaces that document
            Devine College Core's standards, curriculum, and recorded academic work.
            It is not a marketing brochure or public catalog.
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
            <Link href={`/review/${token}/charter`}>Open</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Academic Record</span>
            <Link href={`/review/${token}/record`}>Open</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Research and Synthesis Register</span>
            <Link href={`/review/${token}/research`}>Open</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Thesis Dossier</span>
            <Link href={`/review/${token}/thesis`}>Open</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Academic Work Record</span>
            <Link href={`/review/${token}/work`}>Open</Link>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Academic Chronology</span>
            <Link href={`/review/${token}/chronology`}>Open</Link>
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
              Course dossiers provide detailed curriculum and standing records for each
              course in the program.
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
  );
}
