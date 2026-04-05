import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getCurrentWorkSelection,
  getStandingLabel,
  getStandingStatus,
  summarizeRequirementBlocks,
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

export default async function ProgramResearchRegisterPage({
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

  const { data: requirementBlocks } = await supabase
    .from("requirement_blocks")
    .select(
      "id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position"
    )
    .eq("program_id", id)
    .order("position", { ascending: true });

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight, sequence_position")
    .eq("program_id", id)
    .order("sequence_position", { ascending: true });

  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await supabase
        .from("course_requirement_blocks")
        .select("requirement_block_id, course_id")
        .in("requirement_block_id", blockIds)
    : { data: [] };

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
        .select("id, module_id, title")
        .in("module_id", moduleIds)
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
      completedTasks: standing.completion.completedTasks,
      totalTasks: standing.completion.totalTasks,
      isComplete: status === "completed",
    };
  });

  const completionByCourse = new Map<string, boolean>();
  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseProgress.forEach((course) => {
    completionByCourse.set(course.id, course.isComplete);
    if (course.isComplete) {
      completedCourseIds.add(course.id);
    } else if (course.completedTasks > 0) {
      inProgressCourseIds.add(course.id);
    }
  });

  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );
  const blockMappings: { requirement_block_id: string; course_id: string }[] =
    (mappings ?? []).map((mapping) => ({
      requirement_block_id: mapping.requirement_block_id,
      course_id: mapping.course_id,
    }));

  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings,
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });

  const researchBlocks = blockSummaries.filter(
    (summary) => summary.block.category === "Research"
  );
  const researchBlockIds = new Set(researchBlocks.map((summary) => summary.block.id));
  const researchCourseIds = blockMappings
    .filter((mapping) => researchBlockIds.has(mapping.requirement_block_id))
    .map((mapping) => mapping.course_id);
  const researchCourses = courseProgress.filter((course) =>
    researchCourseIds.includes(course.id)
  );

  const rsynCourse = researchCourses.find((course) => course.code === "RSYN 720") ?? null;
  const thesisSummary =
    rsynCourse && thesisSummaryByCourseId.get(rsynCourse.id)
      ? thesisSummaryByCourseId.get(rsynCourse.id)
      : rsynCourse
      ? buildMissingThesisSummary()
      : null;

  const researchModuleIds = modules
    ?.filter((module) => researchCourseIds.includes(module.course_id))
    .map((module) => module.id) ?? [];
  const researchAssignments = assignments?.filter((assignment) =>
    researchModuleIds.includes(assignment.module_id)
  );
  const researchAssignmentIds = researchAssignments?.map((assignment) => assignment.id) ?? [];
  const researchFinals = finalSubmissions.filter((submission) =>
    researchAssignmentIds.includes(submission.assignment_id)
  );

  const researchModulesProgress =
    modules
      ?.filter((module) => researchCourseIds.includes(module.course_id))
      .map((module) => {
        const standing = getCourseStanding({
          modules: [{ id: module.id }],
          readingsByModule,
          assignmentsByModule,
          assignmentStatus,
        });
        return {
          id: module.id,
          course_id: module.course_id,
          title: module.title,
          position: module.position,
          totalTasks: standing.completion.totalTasks,
          completedTasks: standing.completion.completedTasks,
        };
      }) ?? [];

  const currentResearchWork = getCurrentWorkSelection({
    moduleProgress: researchModulesProgress,
    coursesById,
    readingsByModule,
    assignmentsByModule,
    assignmentStatus,
    finalAssignmentIds: new Set(researchFinals.map((submission) => submission.assignment_id)),
  });

  const recordDate = formatDate(new Date().toISOString());

  return (
    <ReviewShell userEmail={user.email ?? null}>
      <FormalDocumentLayout
        backLink={{ href: `/programs/${program.id}/record`, label: "Academic record" }}
        documentType="Research and Synthesis Register"
        title={program.title}
        description="Formal register of research formation, synthesis work, and capstone status."
        recordDate={recordDate}
        actions={[
          { href: `/programs/${program.id}/chronology`, label: "Academic chronology" },
        ]}
      >
        <DocumentSection title="Lane Standing">
          {researchBlocks.length ? (
            <div className="space-y-4">
              {researchBlocks.map((summary) => (
                <div
                  key={summary.block.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Requirement Block
                  </p>
                  <p className="text-lg font-semibold text-[var(--text)]">
                    {summary.block.title}
                  </p>
                  <p>{summary.block.description ?? "No description recorded."}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Status {summary.status} · Satisfied {summary.satisfied ? "Yes" : "No"}
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    Completed courses {summary.completedCourseIds.length} · Required{" "}
                    {summary.block.minimum_courses_required ?? "--"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No Research and Synthesis requirement block is recorded for this program.
            </div>
          )}
        </DocumentSection>

      <DocumentSection title="Research Courses">
        {researchCourses.length ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3 text-sm text-[var(--muted)]">
            {researchCourses.map((course) => (
              <div key={course.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {course.code ? `${course.code} - ` : ""}
                    {course.title}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {getStandingLabel(course.status)}
                  </span>
                </div>
              ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No research-course mapping recorded yet.
          </div>
        )}
      </DocumentSection>

      <DocumentSection title="Thesis Project">
        {rsynCourse ? (
          thesisSummary && thesisSummary.hasProject ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-3">
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
              <Link
                href={`/programs/${program.id}/thesis`}
                className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
              >
                View thesis dossier
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)] space-y-2">
              <p>No thesis project has been recorded for RSYN 720 yet.</p>
              <Link
                href={`/programs/${program.id}/thesis`}
                className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
              >
                View thesis dossier
              </Link>
            </div>
          )
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            RSYN 720 is not recorded for this program.
          </div>
        )}
      </DocumentSection>

      <DocumentSection title="Current Research Work">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          {currentResearchWork.currentModule ? (
              <>
                <p className="text-sm font-semibold text-[var(--text)]">
                  {currentResearchWork.currentModule.title ?? "Current module"}
                </p>
                {currentResearchWork.nextAction ? (
                  <>
                    <p>{currentResearchWork.nextAction.title}</p>
                    <p>{currentResearchWork.nextAction.reason}</p>
                  </>
                ) : (
                  <p>All required work in the current research module is complete.</p>
                )}
              </>
            ) : (
              <p>No active research work is recorded.</p>
            )}
          </div>
        </DocumentSection>

        <DocumentSection title="Final Research Submissions">
          {researchFinals.length ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-3">
              {researchFinals.map((submission) => {
                const assignment = researchAssignments?.find(
                  (item) => item.id === submission.assignment_id
                );
                return (
                  <div
                    key={submission.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>{assignment?.title ?? "Assignment"}</span>
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Final recorded {formatDate(submission.created_at)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No final research submissions are recorded yet.
            </div>
          )}
        </DocumentSection>
      </FormalDocumentLayout>
    </ReviewShell>
  );
}
