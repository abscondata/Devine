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
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

type ChronologyEvent = {
  date: string;
  label: string;
  detail: string;
  linkHref?: string;
};

export default async function ProgramChronologyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase.from("programs").select("id, title, description").eq("id", id).single();
  if (!program) notFound();

  const { data: courses } = await supabase.from("courses").select("id, title, code, sequence_position").eq("program_id", id).order("sequence_position", { ascending: true });
  const courseIds = courses?.map((c) => c.id) ?? [];
  const { data: modules } = courseIds.length ? await supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds) : { data: [] };
  const moduleIds = modules?.map((m) => m.id) ?? [];
  const { data: readings } = moduleIds.length ? await supabase.from("readings").select("id, module_id, title, status").in("module_id", moduleIds) : { data: [] };
  const { data: assignments } = moduleIds.length ? await supabase.from("assignments").select("id, module_id, title, assignment_type").in("module_id", moduleIds) : { data: [] };
  const assignmentIds = assignments?.map((a) => a.id) ?? [];
  const { data: submissions } = assignmentIds.length ? await supabase.from("submissions").select("id, assignment_id, is_final, created_at, version").eq("user_id", user.id).in("assignment_id", assignmentIds) : { data: [] };
  const finalSubmissions = (submissions ?? []).filter((s) => s.is_final);
  const finalSubmissionIds = finalSubmissions.map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length ? await supabase.from("critiques").select("id, submission_id, submission_version, created_at").in("submission_id", finalSubmissionIds) : { data: [] };

  const { data: thesisProjects } = await supabase.from("thesis_projects").select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at").eq("program_id", id);
  const thesisProjectIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = thesisProjectIds.length ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", thesisProjectIds) : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({ projects: thesisProjects ?? [], milestones: thesisMilestones ?? [], finalSubmissionIds: new Set(finalSubmissionIds) });

  const modulesByCourse = new Map<string, { id: string }[]>();
  modules?.forEach((m) => { const l = modulesByCourse.get(m.course_id) ?? []; l.push({ id: m.id }); modulesByCourse.set(m.course_id, l); });
  const readingsByModule = new Map<string, typeof readings>();
  readings?.forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, typeof assignments>();
  assignments?.forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const modulesById = new Map(modules?.map((m) => [m.id, m]) ?? []);
  const coursesById = new Map(courses?.map((c) => [c.id, c]) ?? []);
  const assignmentsById = new Map(assignments?.map((a) => [a.id, a]) ?? []);
  const moduleToCourse = new Map<string, string>();
  modules?.forEach((m) => moduleToCourse.set(m.id, m.course_id));
  const assignmentToCourse = new Map<string, string>();
  assignments?.forEach((a) => { const cid = moduleToCourse.get(a.module_id); if (cid) assignmentToCourse.set(a.id, cid); });

  const courseFinalDates = new Map<string, string>();
  finalSubmissions.forEach((s) => { const cid = assignmentToCourse.get(s.assignment_id); if (!cid) return; const existing = courseFinalDates.get(cid); if (!existing || new Date(s.created_at) > new Date(existing)) courseFinalDates.set(cid, s.created_at); });

  const courseProgress = (courses ?? []).map((course) => {
    const cm = modulesByCourse.get(course.id) ?? [];
    const ts = course.code === "RSYN 720" ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary() : null;
    const standing = getCourseStanding({ modules: cm, readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary: ts });
    return { ...course, isComplete: getStandingStatus(standing.completion) === "completed" };
  });

  const events: ChronologyEvent[] = [];

  courseProgress.forEach((course) => {
    if (course.isComplete) {
      const finalDate = courseFinalDates.get(course.id);
      if (finalDate) {
        events.push({
          date: finalDate,
          label: "Course officially complete",
          detail: `${course.code ? `${course.code} — ` : ""}${course.title}`,
          linkHref: `/courses/${course.id}/dossier`,
        });
      }
    }
  });

  finalSubmissions.forEach((submission) => {
    const assignment = assignmentsById.get(submission.assignment_id);
    if (!assignment) return;
    const mod = modulesById.get(assignment.module_id);
    const courseId = assignmentToCourse.get(assignment.id);
    const course = courseId ? coursesById.get(courseId) : null;
    if (!mod || !course) return;
    events.push({
      date: submission.created_at,
      label: "Final submission",
      detail: `${course.code ? `${course.code} — ` : ""}${course.title} · ${mod.title} · ${assignment.title} (v${submission.version})`,
      linkHref: `/submissions/${submission.id}/record`,
    });
  });

  critiques?.forEach((critique) => {
    const submission = finalSubmissions.find((f) => f.id === critique.submission_id);
    if (!submission) return;
    const assignment = assignmentsById.get(submission.assignment_id);
    if (!assignment) return;
    const courseId = assignmentToCourse.get(assignment.id);
    const course = courseId ? coursesById.get(courseId) : null;
    if (!course) return;
    events.push({
      date: critique.created_at,
      label: "Critique recorded",
      detail: `${course.code ? `${course.code} — ` : ""}${course.title} · ${assignment.title} (v${critique.submission_version ?? submission.version})`,
      linkHref: `/submissions/${submission.id}/record`,
    });
  });

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const completedCourses = courseProgress.filter((c) => c.isComplete).length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title} · Academic Chronology
          </p>
          <h1 className="text-3xl">Academic Chronology</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{events.length} events</span>
            <span>{finalSubmissions.length} final submissions</span>
            <span>{critiques?.length ?? 0} critiques</span>
            <span>{completedCourses} courses complete</span>
          </div>
        </header>

        {/* ─── Event ledger ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Chronology</h2>
          {events.length ? (
            <div className="divide-y divide-[var(--border)]">
              {events.map((event, index) => (
                <div
                  key={`${event.label}-${event.date}-${index}`}
                  className="flex flex-wrap items-start justify-between gap-4 py-3"
                >
                  <div className="space-y-0.5 flex-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{event.label}</p>
                    {event.linkHref ? (
                      <Link href={event.linkHref} className="text-sm hover:text-[var(--accent-soft)]">
                        {event.detail}
                      </Link>
                    ) : (
                      <p className="text-sm">{event.detail}</p>
                    )}
                  </div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                    {formatDate(event.date)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No finalized academic activity has been recorded yet.
            </p>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
