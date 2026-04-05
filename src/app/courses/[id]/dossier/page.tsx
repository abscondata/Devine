import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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
import { ReviewShell } from "@/components/review-shell";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CourseDossierPage({
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

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, description, code, credits_or_weight, level, learning_outcomes, syllabus, status, sequence_position, program:programs(id, title), domain:domains(id, title, code)"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: requirementMappings } = await supabase
    .from("course_requirement_blocks")
    .select("requirement_block:requirement_block_id(id, title, category)")
    .eq("course_id", id);

  const requirementBlocks = (requirementMappings ?? [])
    .map((item) => item.requirement_block)
    .filter(Boolean);

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, overview, position")
    .eq("course_id", id)
    .order("position", { ascending: true });

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select(
          "id, module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, status, position"
        )
        .in("module_id", moduleIds)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title, assignment_type, due_at")
        .in("module_id", moduleIds)
        .order("due_at", { ascending: true })
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final, created_at")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);

  const { data: critiques } = finalSubmissionIds.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("course_id", course.id);

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

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: `/courses/${course.id}`, label: "Course" }}
        documentType="Course Dossier"
        title={`${course.code ? `${course.code} — ` : ""}${course.title}`}
        description={course.description ?? "No course description recorded."}
        recordDate={recordDate}
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Program
              </p>
              <p>{course.program?.title ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Domain
              </p>
              <p>
                {course.domain
                  ? `${course.domain.code ? `${course.domain.code} — ` : ""}${course.domain.title}`
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Standing
              </p>
              <p className="text-[var(--text)]">{courseStatus}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Status
              </p>
              <p>{course.status}</p>
            </div>
          </div>
          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            Progress {completedTasks}/{totalTasks} · Finals {finalAssignments}/{totalAssignments}
            {draftAssignments ? ` · Drafts ${draftAssignments}` : ""}
          </div>
            {requirementBlocks.length ? (
            <div className="pt-2 text-sm text-[var(--muted)]">
              Requirement blocks:{" "}
              {requirementBlocks
                .map((block) => `${block.title}${block.category ? ` (${block.category})` : ""}`)
                .join(" · ")}
            </div>
          ) : null}
        </div>

        <DocumentSection title="Official Completion">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            <p>
              Official completion requires all readings marked complete (skipped
              readings do not count) and final submissions for every assignment.
              Critiques are recommended but do not determine completion. RSYN 720
              additionally requires an active thesis project with all required
              milestones complete.
            </p>
            {unreadReadings === 0 &&
            skippedReadings === 0 &&
            missingFinals === 0 &&
            !courseStanding.completion.thesisIncomplete ? (
              <p className="text-sm font-semibold text-[var(--text)]">
                This course is officially complete.
              </p>
            ) : (
              <ul className="list-disc pl-5 text-[var(--muted)]">
                {unreadReadings > 0 ? (
                  <li>
                    {unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete
                  </li>
                ) : null}
                {skippedReadings > 0 ? (
                  <li>
                    {skippedReadings} reading{skippedReadings === 1 ? "" : "s"} skipped (do not count)
                  </li>
                ) : null}
                {missingFinals > 0 ? (
                  <li>
                    {missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission
                  </li>
                ) : null}
                {courseStanding.completion.thesisIncomplete ? (
                  <li>
                    {courseStanding.thesis?.hasProject
                      ? "Thesis milestones remain incomplete."
                      : "No thesis project recorded for RSYN 720."}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        </DocumentSection>

        <DocumentSection title="Current Work">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            {nextModule ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  Continue module {nextModule.position + 1}: {nextModule.title}
                </p>
                {nextModule.nextAction ? (
                  <>
                    <p>{nextModule.nextAction.title}</p>
                    <p>{nextModule.nextAction.reason}</p>
                  </>
                ) : (
                  <p>All required work in this module is complete.</p>
                )}
              </>
            ) : (
              <p>No incomplete modules remain in this course.</p>
            )}
          </div>
        </DocumentSection>

        <DocumentSection title="Module Sequence">
          {moduleSummaries.length ? (
            <div className="space-y-8">
              {moduleSummaries.map((module) => (
                <div key={module.id} className="space-y-4">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Module {module.position + 1}
                    </p>
                    <h3 className="text-lg font-semibold">{module.title}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {module.overview ?? "No overview recorded."}
                    </p>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Progress {module.standing.completion.completedTasks}/
                      {module.standing.completion.totalTasks}
                    </p>
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Readings
                    </h4>
                    {module.readings.length ? (
                      <div className="space-y-3 text-sm text-[var(--muted)]">
                        {module.readings.map((reading) => (
                          <div
                            key={reading.id}
                            className="flex flex-col gap-1 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span>
                                {reading.title}
                                {reading.author ? ` — ${reading.author}` : ""}
                              </span>
                              <span className="text-xs uppercase tracking-[0.2em]">
                                {reading.status.replace(/_/g, " ")}
                              </span>
                            </div>
                            <div className="text-xs text-[var(--muted)]">
                              {[reading.source_type, reading.primary_or_secondary, reading.tradition_or_era]
                                .filter(Boolean)
                                .join(" · ")}
                            </div>
                            {reading.pages_or_length ? (
                              <div className="text-xs text-[var(--muted)]">
                                {reading.pages_or_length}
                                {reading.estimated_hours
                                  ? ` · ${reading.estimated_hours} hr`
                                  : ""}
                              </div>
                            ) : null}
                            {reading.reference_url_or_citation ? (
                              <div className="text-xs text-[var(--muted)]">
                                {reading.reference_url_or_citation}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No readings recorded.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
                    <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">
                      Assignments
                    </h4>
                    {module.assignments.length ? (
                      <div className="space-y-3 text-sm text-[var(--muted)]">
                        {module.assignments.map((assignment) => {
                          const status = assignmentStatus.get(assignment.id);
                          const label = status?.hasFinal
                            ? status.hasCritique
                              ? "Final · Critiqued"
                              : "Final · Critique pending"
                            : status?.hasDraft
                            ? "Draft only"
                            : "No submission";
                          return (
                            <div
                              key={assignment.id}
                              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3 last:border-b-0 last:pb-0"
                            >
                              <span>
                                {assignment.title} ·{" "}
                                {assignment.assignment_type.replace(/_/g, " ")}
                              </span>
                              <span className="text-xs uppercase tracking-[0.2em]">
                                {assignment.due_at
                                  ? formatDate(assignment.due_at)
                                  : "No deadline"}
                              </span>
                              <span className="text-xs uppercase tracking-[0.2em]">
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-[var(--muted)]">
                        No assignments recorded.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No modules recorded for this course.
            </div>
          )}
        </DocumentSection>

        {course.learning_outcomes || course.syllabus ? (
          <DocumentSection title="Course Documentation">
            {course.learning_outcomes ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Learning Outcomes
                </p>
                <p className="whitespace-pre-wrap">{course.learning_outcomes}</p>
              </div>
            ) : null}
            {course.syllabus ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Syllabus
                </p>
                <p className="whitespace-pre-wrap">{course.syllabus}</p>
              </div>
            ) : null}
          </DocumentSection>
        ) : null}
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
