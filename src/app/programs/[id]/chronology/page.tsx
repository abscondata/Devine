import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getStandingStatus,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
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

type ChronologyEvent = {
  date: string;
  label: string;
  detail: string;
  linkLabel?: string;
  linkHref?: string;
};

export default async function ProgramChronologyPage({
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
    .select("id, title, code, sequence_position")
    .eq("program_id", id)
    .order("sequence_position", { ascending: true });

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
    : { data: [] };

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, status")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title, assignment_type")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final, created_at, version")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);

  const { data: critiques } = finalSubmissionIds.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id, submission_version, created_at")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("program_id", id);

  const thesisProjectIds = thesisProjects?.map((project) => project.id) ?? [];
  const { data: thesisMilestones } = thesisProjectIds.length
    ? await supabase
        .from("thesis_milestones")
        .select(
          "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
        )
        .in("thesis_project_id", thesisProjectIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubmissionIds),
  });

  const modulesByCourse = new Map<string, { id: string }[]>();
  modules?.forEach((module) => {
    const list = modulesByCourse.get(module.course_id) ?? [];
    list.push({ id: module.id });
    modulesByCourse.set(module.course_id, list);
  });

  const readingsByModule = new Map<string, typeof readings>();
  readings?.forEach((reading) => {
    const list = readingsByModule.get(reading.module_id) ?? [];
    list.push(reading);
    readingsByModule.set(reading.module_id, list);
  });

  const assignmentsByModule = new Map<string, typeof assignments>();
  assignments?.forEach((assignment) => {
    const list = assignmentsByModule.get(assignment.module_id) ?? [];
    list.push(assignment);
    assignmentsByModule.set(assignment.module_id, list);
  });

  const modulesById = new Map(modules?.map((module) => [module.id, module]) ?? []);
  const coursesById = new Map(courses?.map((course) => [course.id, course]) ?? []);
  const assignmentsById = new Map(
    assignments?.map((assignment) => [assignment.id, assignment]) ?? []
  );

  const moduleToCourse = new Map<string, string>();
  modules?.forEach((module) => {
    moduleToCourse.set(module.id, module.course_id);
  });

  const assignmentToCourse = new Map<string, string>();
  assignments?.forEach((assignment) => {
    const courseId = moduleToCourse.get(assignment.module_id);
    if (courseId) {
      assignmentToCourse.set(assignment.id, courseId);
    }
  });

  const courseFinalDates = new Map<string, string>();
  finalSubmissions.forEach((submission) => {
    const courseId = assignmentToCourse.get(submission.assignment_id);
    if (!courseId) return;
    const existing = courseFinalDates.get(courseId);
    if (!existing || new Date(submission.created_at) > new Date(existing)) {
      courseFinalDates.set(courseId, submission.created_at);
    }
  });

  const courseProgress = (courses ?? []).map((course) => {
    const courseModules = modulesByCourse.get(course.id) ?? [];
    const thesisSummary =
      course.code === "RSYN 720"
        ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
        : null;
    const standing = getCourseStanding({
      modules: courseModules,
      readingsByModule,
      assignmentsByModule,
      assignmentStatus,
      thesisSummary,
    });
    const status = getStandingStatus(standing.completion);
    return {
      ...course,
      status,
      isComplete: status === "completed",
    };
  });

  const events: ChronologyEvent[] = [];

  courseProgress.forEach((course) => {
    if (course.isComplete) {
      const finalDate = courseFinalDates.get(course.id);
      if (finalDate) {
        events.push({
          date: finalDate,
          label: "Course officially complete",
          detail: `${course.code ? `${course.code} - ` : ""}${course.title}`,
          linkLabel: "Course dossier",
          linkHref: `/courses/${course.id}/dossier`,
        });
      }
    }
  });

  finalSubmissions.forEach((submission) => {
    const assignment = assignmentsById.get(submission.assignment_id);
    if (!assignment) return;
    const module = modulesById.get(assignment.module_id);
    const courseId = assignmentToCourse.get(assignment.id);
    const course = courseId ? coursesById.get(courseId) : null;
    if (!module || !course) return;
    const courseLabel = course.code ? `${course.code} - ` : "";
    events.push({
      date: submission.created_at,
      label: "Final submission recorded",
      detail: `${courseLabel}${course.title} · ${module.title} · ${assignment.title} (v${submission.version})`,
      linkLabel: "Final submission record",
      linkHref: `/submissions/${submission.id}/record`,
    });
  });

  critiques?.forEach((critique) => {
    const submission = finalSubmissions.find(
      (final) => final.id === critique.submission_id
    );
    if (!submission) return;
    const assignment = assignmentsById.get(submission.assignment_id);
    if (!assignment) return;
    const module = modulesById.get(assignment.module_id);
    const courseId = assignmentToCourse.get(assignment.id);
    const course = courseId ? coursesById.get(courseId) : null;
    if (!module || !course) return;
    const courseLabel = course.code ? `${course.code} - ` : "";
    events.push({
      date: critique.created_at,
      label: "Critique recorded",
      detail: `${courseLabel}${course.title} · ${assignment.title} (v${
        critique.submission_version ?? submission.version
      })`,
      linkLabel: "Final submission record",
      linkHref: `/submissions/${submission.id}/record`,
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: `/programs/${program.id}/record`, label: "Academic record" }}
        documentType="Academic Chronology"
        title={program.title}
        description="Formal ledger of final academic work and completion milestones."
        recordDate={recordDate}
      >
        <DocumentSection title="Chronology">
          {events.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              {events.map((event, index) => (
                <div
                  key={`${event.label}-${event.date}-${index}`}
                  className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {event.label}
                    </p>
                    <p className="text-sm text-[var(--text)]">{event.detail}</p>
                  </div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {formatDate(event.date)}
                  </div>
                  {event.linkHref ? (
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] no-print">
                      <Link href={event.linkHref}>{event.linkLabel ?? "Record"}</Link>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No finalized academic activity has been recorded yet.
            </div>
          )}
        </DocumentSection>
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
