import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAssignmentStatusMap } from "@/lib/academic-standing";
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

type WorkRow = {
  assignmentId: string;
  assignmentTitle: string;
  assignmentType: string;
  moduleTitle: string;
  modulePosition: number;
  courseTitle: string;
  courseCode: string | null;
  courseSequence: number | null;
  courseId: string;
  finalSubmissionId: string;
  finalVersion: number;
  finalDate: string;
  finalLabel: string;
  critiqueLabel: string;
};

export default async function ReviewWorkPage({
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
    .select("id, title, code, sequence_position")
    .eq("program_id", program.id)
    .order("sequence_position", { ascending: true });

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await admin
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
        .order("position", { ascending: true })
    : { data: [] };

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: assignments } = moduleIds.length
    ? await admin
        .from("assignments")
        .select("id, module_id, title, assignment_type")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await admin
        .from("submissions")
        .select("id, assignment_id, is_final, created_at, version")
        .eq("user_id", program.owner_id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);
  const { data: critiques } = finalSubmissionIds.length
    ? await admin
        .from("critiques")
        .select("id, submission_id, submission_version, created_at")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const finalByAssignment = new Map<string, typeof finalSubmissions[0]>();
  finalSubmissions.forEach((submission) => {
    finalByAssignment.set(submission.assignment_id, submission);
  });
  const critiqueBySubmission = new Map<
    string,
    { submission_version: number | null; created_at: string }
  >();
  critiques?.forEach((critique) => {
    const existing = critiqueBySubmission.get(critique.submission_id);
    if (!existing || new Date(critique.created_at) > new Date(existing.created_at)) {
      critiqueBySubmission.set(critique.submission_id, {
        submission_version: critique.submission_version ?? null,
        created_at: critique.created_at,
      });
    }
  });

  const modulesById = new Map(modules?.map((module) => [module.id, module]) ?? []);
  const coursesById = new Map(courses?.map((course) => [course.id, course]) ?? []);

  const workRows: WorkRow[] = (assignments ?? [])
    .map((assignment) => {
      const finalSubmission = finalByAssignment.get(assignment.id);
      if (!finalSubmission) return null;
      const module = modulesById.get(assignment.module_id);
      const course = module ? coursesById.get(module.course_id) : null;
      if (!module || !course) return null;
      const status = assignmentStatus.get(assignment.id);
      const critiqueRecord = critiqueBySubmission.get(finalSubmission.id);
      const critiqueSummary = getCritiqueSummary({
        hasCritique: status?.hasCritique ?? false,
        submissionVersion: finalSubmission.version,
        critiqueVersion: critiqueRecord?.submission_version ?? null,
      });
      const finalSummary = getFinalSubmissionSummary(finalSubmission.version);
      return {
        assignmentId: assignment.id,
        assignmentTitle: assignment.title,
        assignmentType: assignment.assignment_type,
        moduleTitle: module.title,
        modulePosition: module.position,
        courseTitle: course.title ?? "Untitled course",
        courseCode: course.code ?? null,
        courseSequence: course.sequence_position ?? null,
        courseId: course.id,
        finalSubmissionId: finalSubmission.id,
        finalVersion: finalSubmission.version,
        finalDate: finalSubmission.created_at,
        finalLabel: finalSummary.label,
        critiqueLabel: critiqueSummary.label,
      };
    })
    .filter((row): row is WorkRow => Boolean(row));

  workRows.sort((a, b) => {
    const seqA = a.courseSequence ?? 9999;
    const seqB = b.courseSequence ?? 9999;
    if (seqA !== seqB) return seqA - seqB;
    const codeA = (a.courseCode ?? a.courseTitle).toLowerCase();
    const codeB = (b.courseCode ?? b.courseTitle).toLowerCase();
    if (codeA !== codeB) return codeA.localeCompare(codeB);
    if (a.modulePosition !== b.modulePosition) {
      return a.modulePosition - b.modulePosition;
    }
    return a.assignmentTitle.localeCompare(b.assignmentTitle);
  });

  const critiquedCount = workRows.filter((r) => r.critiqueLabel !== "No critique").length;
  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}`}>Program review packet</Link>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}/charter`}>Charter</Link>
          <Link href={`/review/${token}/record`}>Record</Link>
          <Link href={`/review/${token}/chronology`}>Chronology</Link>
          <span className="text-[var(--text)]">Work</span>
          <Link href={`/review/${token}/research`}>Research</Link>
          <Link href={`/review/${token}/thesis`}>Thesis</Link>
          <Link href={`/review/${token}/readiness`}>Readiness</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Academic Work Record
        </p>
        <h1 className="text-3xl">Academic Work Record</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{workRows.length} finalized submissions</span>
          <span>{critiquedCount} critiqued</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Scope ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Scope</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            This record lists finalized submissions only. Drafts and in-progress work
            are excluded. Critique status is shown when a critique is attached to the
            finalized version, but critique is not required for official completion.
          </p>
        </div>
      </section>

      {/* ─── Final work archive ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Final Work Archive</h2>
        {workRows.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="hidden md:grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[140px_1fr_1fr_140px_180px] pb-2 border-b border-[var(--border)]">
              <span>Course</span>
              <span>Module</span>
              <span>Assignment</span>
              <span>Final date</span>
              <span>Critique</span>
            </div>
            <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">
              {workRows.map((row) => (
                <div
                  key={row.finalSubmissionId}
                  className="grid gap-2 md:grid-cols-[140px_1fr_1fr_140px_180px]"
                >
                  <span>{row.courseCode ?? "—"}</span>
                  <span>
                    {row.moduleTitle} (Unit {row.modulePosition + 1})
                  </span>
                  <span>
                    {row.assignmentTitle} · {row.assignmentType.replace(/_/g, " ")} · {row.finalLabel}
                  </span>
                  <span>{formatDate(row.finalDate)}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {row.critiqueLabel}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:col-span-5 no-print">
                    <span className="flex flex-wrap gap-4">
                      <Link href={`/review/${token}/submissions/${row.finalSubmissionId}`}>
                        Final submission record
                      </Link>
                      <Link href={`/review/${token}/courses/${row.courseId}`}>
                        Course dossier
                      </Link>
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-[var(--muted)]">
              Only final submissions appear in this archive. Assignment records retain
              full draft history and critique details.
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No finalized academic work has been recorded yet.
          </div>
        )}
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · Academic work record · {workRows.length} finalized submissions · {critiquedCount} critiqued · Generated {now}
        </p>
      </footer>
    </div>
  );
}
