import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getModuleNextAction,
  getModuleStanding,
  getStandingLabel,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { getReviewProgram } from "@/lib/review-access";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ReviewCourseDossierPage({
  params,
}: {
  params: Promise<{ token: string; courseId: string }>;
}) {
  const { token, courseId } = await params;
  const review = await getReviewProgram(token);
  if (!review) {
    notFound();
  }
  const { program } = review;
  const admin = createAdminClient();

  const { data: course } = await admin
    .from("courses")
    .select(
      "id, title, description, code, credits_or_weight, level, learning_outcomes, syllabus, status, sequence_position, program_id, domain:domains(id, title, code)"
    )
    .eq("id", courseId)
    .eq("program_id", program.id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: requirementMappings } = await admin
    .from("course_requirement_blocks")
    .select("requirement_block:requirement_block_id(id, title, category)")
    .eq("course_id", course.id);

  const requirementBlocks = (requirementMappings ?? [])
    .map((item) => item.requirement_block)
    .filter(Boolean);

  const { data: modules } = await admin
    .from("modules")
    .select("id, title, overview, position")
    .eq("course_id", course.id)
    .order("position", { ascending: true });

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await admin
        .from("readings")
        .select(
          "id, module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, status, position"
        )
        .in("module_id", moduleIds)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await admin
        .from("assignments")
        .select("id, module_id, title, assignment_type, due_at")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await admin
        .from("submissions")
        .select("id, assignment_id, is_final, created_at")
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

  const { data: thesisProjects } = await admin
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("course_id", course.id);

  const thesisProjectIds = thesisProjects?.map((project) => project.id) ?? [];
  const { data: thesisMilestones } = thesisProjectIds.length
    ? await admin
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

  const moduleSummaries = (modules ?? []).map((module) => {
    const moduleReadings = readingsByModule.get(module.id) ?? [];
    const moduleAssignments = assignmentsByModule.get(module.id) ?? [];
    const moduleStanding = getModuleStanding({
      readings: moduleReadings,
      assignments: moduleAssignments,
      assignmentStatus,
    });
    const nextAction = getModuleNextAction({
      readings: moduleReadings,
      assignments: moduleAssignments,
      assignmentStatus,
    });
    return {
      ...module,
      readings: moduleReadings,
      assignments: moduleAssignments,
      standing: moduleStanding,
      nextAction,
    };
  });

  const courseStanding = getCourseStanding({
    modules: modules ?? [],
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    thesisSummary:
      course.code === "RSYN 720"
        ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary()
        : null,
  });

  const totalTasks = courseStanding.completion.totalTasks;
  const completedTasks = courseStanding.completion.completedTasks;
  const { unreadReadings, skippedReadings, missingFinals } =
    courseStanding.completion;
  const { totalAssignments, finalAssignments, draftAssignments } =
    courseStanding.assignmentSummary;
  const courseStatus = getStandingLabel(
    courseStanding.completion.isComplete
      ? "completed"
      : completedTasks > 0
      ? "in_progress"
      : "not_started"
  );

  const nextModule = moduleSummaries.find(
    (module) =>
      module.standing.completion.totalTasks > 0 &&
      module.standing.completion.completedTasks <
        module.standing.completion.totalTasks
  );

  const totalReadings = (readings ?? []).length;
  const completedReadings = (readings ?? []).filter((r) => r.status === "complete").length;
  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}`}>Program review packet</Link>
          <span>/</span>
          <Link href={`/review/${token}/record`}>Academic record</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Course Dossier
        </p>
        <h1 className="text-3xl">{course.code ? `${course.code} — ` : ""}{course.title}</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          {course.level ? <span>{course.level}</span> : null}
          {course.credits_or_weight ? <span>{course.credits_or_weight} credits</span> : null}
          {course.domain?.title ? <span>{course.domain.title}</span> : null}
          <span>{courseStatus}</span>
          <span>{completedTasks}/{totalTasks} tasks</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Course context ─── */}
      {course.description ? (
        <section className="space-y-3">
          <h2 className="text-lg">Course Description</h2>
          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{course.description}</p>
        </section>
      ) : null}

      {/* ─── Academic summary ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Academic Summary</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{(modules ?? []).length} units</span>
            <span>Readings: {completedReadings} of {totalReadings} complete</span>
            <span>Finals: {finalAssignments} of {totalAssignments}</span>
            {draftAssignments ? <span>Drafts: {draftAssignments}</span> : null}
          </div>
          {requirementBlocks.length ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Satisfies</p>
              <p className="text-sm text-[var(--muted)]">
                {requirementBlocks.map((b) => `${b.title}${b.category ? ` (${b.category})` : ""}`).join("; ")}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {/* ─── Official completion ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Official Completion</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
          {unreadReadings === 0 &&
          skippedReadings === 0 &&
          missingFinals === 0 &&
          !courseStanding.completion.thesisIncomplete ? (
            <p className="font-semibold text-[var(--text)]">
              This course is officially complete.
            </p>
          ) : (
            <>
              <p>The following items remain before official completion:</p>
              <ul className="list-disc pl-5">
                {unreadReadings > 0 ? (
                  <li>{unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete</li>
                ) : null}
                {skippedReadings > 0 ? (
                  <li>{skippedReadings} reading{skippedReadings === 1 ? "" : "s"} skipped (do not count toward completion)</li>
                ) : null}
                {missingFinals > 0 ? (
                  <li>{missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission</li>
                ) : null}
                {courseStanding.completion.thesisIncomplete ? (
                  <li>
                    {courseStanding.thesis?.hasProject
                      ? "Thesis milestones remain incomplete."
                      : "No thesis project recorded for RSYN 720."}
                  </li>
                ) : null}
              </ul>
            </>
          )}
        </div>
      </section>

      {/* ─── Current work ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Current Work</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm space-y-2">
          {nextModule ? (
            <>
              <p className="font-semibold text-[var(--text)]">
                Continue Unit {nextModule.position + 1}: {nextModule.title}
              </p>
              {nextModule.nextAction ? (
                <>
                  <p className="text-[var(--muted)]">{nextModule.nextAction.title}</p>
                  <p className="text-xs text-[var(--muted)]">{nextModule.nextAction.reason}</p>
                </>
              ) : (
                <p className="text-[var(--muted)]">All required work in this unit is complete.</p>
              )}
            </>
          ) : (
            <p className="text-[var(--muted)]">No incomplete units remain in this course.</p>
          )}
        </div>
      </section>

      {/* ─── Unit-by-unit record ─── */}
      {moduleSummaries.map((module) => (
        <section key={module.id} className="space-y-3">
          <div className="border-b border-[var(--border)] pb-2">
            <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Unit {module.position + 1}</span>
              <span>{module.standing.completion.completedTasks}/{module.standing.completion.totalTasks} tasks</span>
            </div>
            <h2 className="text-base font-semibold">{module.title}</h2>
          </div>

          {module.overview ? (
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{module.overview}</p>
          ) : null}

          {module.readings.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
              <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                {module.readings.map((reading) => (
                  <li key={reading.id} className={reading.status === "complete" ? "line-through opacity-50" : ""}>
                    {reading.author ? `${reading.author}, ` : ""}{reading.title}
                    {reading.pages_or_length ? ` (${reading.pages_or_length})` : ""}
                    <span className="text-xs uppercase tracking-[0.2em]">
                      {" "}· {reading.status === "complete" ? "Complete" : reading.status?.replace(/_/g, " ") ?? ""}
                    </span>
                    {reading.source_type ? (
                      <span className="text-xs text-[var(--muted)]"> · {reading.source_type}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {module.assignments.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
              <ul className="space-y-1 text-sm">
                {module.assignments.map((assignment) => {
                  const status = assignmentStatus.get(assignment.id);
                  const isFinal = status?.hasFinal;
                  const label = isFinal
                    ? status.hasCritique
                      ? "Final · Critiqued"
                      : "Final"
                    : status?.hasDraft
                    ? "Draft only"
                    : "Not submitted";
                  return (
                    <li key={assignment.id} className={isFinal ? "text-[var(--muted)]" : "font-semibold"}>
                      {assignment.title}
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {" "}· {assignment.assignment_type.replace(/_/g, " ")} · {label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ))}

      {!moduleSummaries.length ? (
        <section className="space-y-3">
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No units recorded for this course.
          </div>
        </section>
      ) : null}

      {/* ─── Course documentation ─── */}
      {(course.learning_outcomes || course.syllabus) ? (
        <section className="space-y-3">
          <h2 className="text-lg">Course Information</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            {course.syllabus ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Syllabus</p>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.syllabus}</p>
              </div>
            ) : null}
            {course.learning_outcomes ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Learning outcomes</p>
                <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.learning_outcomes}</p>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · {course.code ?? "Course"} · Course dossier · {completedTasks}/{totalTasks} tasks · Generated {now}
        </p>
      </footer>
    </div>
  );
}
