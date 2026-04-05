import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getProgramRequirementSummary,
  getStandingStatus,
  getTranscriptLiteSummary,
  buildReadinessByCourse,
  summarizeRequirementBlocks,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { checkAdminAccess } from "@/lib/admin-gate";
import { ProtectedShell } from "@/components/protected-shell";

type CourseStatus = "completed" | "in_progress" | "not_started";

function formatRule(block: {
  minimum_courses_required: number | null;
  minimum_credits_required: number | null;
}) {
  const parts: string[] = [];
  if (block.minimum_courses_required !== null) {
    parts.push(
      `Minimum ${block.minimum_courses_required} course${block.minimum_courses_required === 1 ? "" : "s"}`
    );
  }
  if (block.minimum_credits_required !== null) {
    parts.push(`Minimum ${block.minimum_credits_required} credits`);
  }
  return parts.length ? parts.join(" and ") : "No requirement set";
}

function formatStatus(status: CourseStatus) {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  return "Not started";
}

export default async function ProgramAuditPage({
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

  const isAdmin = await checkAdminAccess(supabase, user.id);

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
    .select("id, title, code, credits_or_weight")
    .eq("program_id", id)
    .order("title");

  const recommendedSequenceCodes = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const recommendedSequence = recommendedSequenceCodes.map((code) => ({
    code,
    course: (courses ?? []).find((course) => course.code === code) ?? null,
  }));
  const hasRecommendedSequence = recommendedSequence.some((item) => item.course);

  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await supabase
        .from("course_requirement_blocks")
        .select("requirement_block_id, course:course_id(id, title, code, credits_or_weight)")
        .in("requirement_block_id", blockIds)
    : { data: [] };

  const courseIds = courses?.map((course) => course.id) ?? [];
  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id")
        .in("course_id", courseIds)
    : { data: [] };

  const { data: prerequisiteMappings } = courseIds.length
    ? await supabase
        .from("course_prerequisites")
        .select("course_id, prerequisite:prerequisite_course_id(id, title, code)")
        .in("course_id", courseIds)
    : { data: [] };

  const prereqsByCourse = new Map<
    string,
    { id: string; title: string; code: string | null }[]
  >();
  prerequisiteMappings?.forEach((mapping) => {
    if (!mapping.prerequisite) return;
    const list = prereqsByCourse.get(mapping.course_id) ?? [];
    list.push(mapping.prerequisite);
    prereqsByCourse.set(mapping.course_id, list);
  });

  const moduleIds = modules?.map((module) => module.id) ?? [];
  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, status")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id")
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
    list.push(module);
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

  const courseProgress = new Map<
    string,
    {
      status: CourseStatus;
      completedTasks: number;
      totalTasks: number;
      totalAssignments: number;
      finalAssignments: number;
      draftAssignments: number;
      critiquedFinals: number;
      unreadReadings: number;
      skippedReadings: number;
      missingFinals: number;
    }
  >();

  (courses ?? []).forEach((course) => {
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

    courseProgress.set(course.id, {
      status,
      completedTasks: standing.completion.completedTasks,
      totalTasks: standing.completion.totalTasks,
      ...standing.assignmentSummary,
      unreadReadings: standing.readingCounts.incompleteReadings,
      skippedReadings: standing.readingCounts.skippedReadings,
      missingFinals: standing.completion.missingFinals,
    });
  });

  const completionByCourse = new Map<string, boolean>();
  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseProgress.forEach((progress, courseId) => {
    const isComplete = progress.status === "completed";
    completionByCourse.set(courseId, isComplete);
    if (isComplete) {
      completedCourseIds.add(courseId);
    } else if (progress.status === "in_progress") {
      inProgressCourseIds.add(courseId);
    }
  });
  const readinessByCourse = buildReadinessByCourse({
    courseIds,
    prereqsByCourse,
    completionByCourse,
  });

  const courseStatusList = (courses ?? []).map((course) => ({
    ...course,
    status: courseProgress.get(course.id)?.status ?? "not_started",
    finalDate: courseFinalDates.get(course.id) ?? null,
  }));

  const transcriptLite = getTranscriptLiteSummary(
    courseStatusList.map((course) => {
      const progress = courseProgress.get(course.id) ?? {
        completedTasks: 0,
        totalTasks: 0,
      };
      return {
        id: course.id,
        title: course.title,
        code: course.code,
        completedTasks: progress.completedTasks,
        totalTasks: progress.totalTasks,
        isComplete: course.status === "completed",
      };
    })
  );
  const completedCourses = courseStatusList.filter((course) =>
    transcriptLite.completedCourseIds.has(course.id)
  );
  const inProgressCourses = courseStatusList.filter((course) =>
    transcriptLite.inProgressCourseIds.has(course.id)
  );
  const notStartedCourses = courseStatusList.filter(
    (course) =>
      !transcriptLite.completedCourseIds.has(course.id) &&
      !transcriptLite.inProgressCourseIds.has(course.id)
  );

  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );
  const blockMappings: { requirement_block_id: string; course_id: string }[] = [];
  const coursesByBlock = new Map<
    string,
    { id: string; title: string; code: string | null; credits_or_weight: number | null }[]
  >();
  mappings?.forEach((mapping) => {
    if (!mapping.course || !("title" in mapping.course)) return;
    const list = coursesByBlock.get(mapping.requirement_block_id) ?? [];
    const course = mapping.course as unknown as {
      id: string;
      title: string;
      code: string | null;
      credits_or_weight: number | null;
    };
    list.push(course);
    coursesByBlock.set(mapping.requirement_block_id, list);
    blockMappings.push({
      requirement_block_id: mapping.requirement_block_id,
      course_id: course.id,
    });
  });

  const blockProgress = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings,
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });
  const blockProgressById = new Map(
    blockProgress.map((summary) => [summary.block.id, summary])
  );

  const blockSummaries = (requirementBlocks ?? []).map((block) => {
    const progress = blockProgressById.get(block.id);
    const assignedCourses = coursesByBlock.get(block.id) ?? [];
    const courseDetails = assignedCourses.map((course) => {
      const progress = courseProgress.get(course.id) ?? {
        status: "not_started" as CourseStatus,
        completedTasks: 0,
        totalTasks: 0,
        totalAssignments: 0,
        finalAssignments: 0,
        draftAssignments: 0,
        critiquedFinals: 0,
        unreadReadings: 0,
        skippedReadings: 0,
        missingFinals: 0,
      };
      const prereqs = prereqsByCourse.get(course.id) ?? [];
      const unmet = prereqs.filter(
        (prereq) => !(completionByCourse.get(prereq.id) ?? false)
      );
      const readinessState = readinessByCourse.get(course.id) ?? {
        status: "blocked",
        reason: "Prerequisites required.",
      };
      const readiness =
        readinessState.status === "completed"
          ? "Complete"
          : readinessState.status === "ready"
          ? "Prerequisites satisfied"
          : "Prerequisites pending";
      return {
        ...course,
        ...progress,
        readiness,
        unmetPrereqs: unmet,
      };
    });

    const inProgressCourses = courseDetails.filter(
      (course) => course.status === "in_progress"
    );

    const missingCourses = progress?.missingCourses ?? null;
    const missingCredits = progress?.missingCredits ?? null;
    const status = progress?.status ?? (inProgressCourses.length ? "in progress" : "incomplete");

    const missingParts: string[] = [];
    if (missingCourses !== null && missingCourses > 0) {
      missingParts.push(
        `Missing ${missingCourses} course${missingCourses === 1 ? "" : "s"}`
      );
    }
    if (missingCredits !== null && missingCredits > 0) {
      missingParts.push(`Missing ${missingCredits} credits`);
    }

    return {
      block,
      assignedCourses: courseDetails,
      status,
      missingText: missingParts.length ? missingParts.join(" · ") : null,
    };
  });

  const programRequirementSummary = getProgramRequirementSummary(blockProgress);
  const completedBlocks = programRequirementSummary.satisfiedBlocks;
  const remainingBlocks = programRequirementSummary.remainingBlocks;

  const categoryOrder = ["Foundations", "Core", "Advanced", "Capstone"];
  const blocksByCategory = new Map<
    string,
    typeof blockSummaries
  >();
  blockSummaries.forEach((summary) => {
    const category = summary.block.category ?? "Uncategorized";
    const list = blocksByCategory.get(category) ?? [];
    list.push(summary);
    blocksByCategory.set(category, list);
  });
  const orderedCategories = [
    ...categoryOrder.filter((category) => blocksByCategory.has(category)),
    ...Array.from(blocksByCategory.keys()).filter(
      (category) => !categoryOrder.includes(category)
    ),
  ];

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title}
          </p>
          <h1 className="text-3xl">Degree Audit</h1>
          {program.description ? <p className="text-sm text-[var(--muted)]">{program.description}</p> : null}
        </header>

        <section className="space-y-4">
          {hasRecommendedSequence ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Foundations Sequence
                </p>
                <h2 className="text-lg">Recommended Order</h2>
                <p className="text-sm text-[var(--muted)]">
                  A guided progression for foundational formation. This sequence is
                  recommended, not enforced as a hard prerequisite chain.
                </p>
              </div>
              <ol className="space-y-2 text-sm text-[var(--muted)]">
                {recommendedSequence.map((item, index) => (
                  <li
                    key={item.code}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {index + 1}
                    </span>
                    <span>
                      {item.course
                        ? `${item.code} — ${item.course.title}`
                        : `${item.code} — Not yet established`}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4 text-sm text-[var(--muted)]">
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Completed {completedCourses.length}</span>
              <span>In progress {inProgressCourses.length}</span>
              <span>Not started {notStartedCourses.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Officially Complete
                </p>
                {completedCourses.length ? (
                  <ul className="space-y-2">
                    {completedCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                        {course.finalDate ? (
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            {" "}
                            · Final{" "}
                            {new Date(course.finalDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No completed courses yet.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  In Progress
                </p>
                {inProgressCourses.length ? (
                  <ul className="space-y-2">
                    {inProgressCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No courses currently in progress.</p>
                )}
              </div>
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Not Yet Started
                </p>
                {notStartedCourses.length ? (
                  <ul className="space-y-2">
                    {notStartedCourses.map((course) => (
                      <li key={course.id}>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>All courses have activity.</p>
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            Program audit completion uses official course completion: all readings
            marked complete (skipped readings do not count) and final submissions
            for every assignment. Critiques are recommended but do not determine
            completion.
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Requirement Blocks</h2>
            {isAdmin ? (
              <Link
                href={`/programs/${program.id}/requirements/new`}
                className="text-sm text-[var(--muted)]"
              >
                Add requirement block
              </Link>
            ) : null}
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            <p>
              Devine College Core is defined by requirement blocks. A block is
              satisfied only when its minimum courses and credits are complete.
            </p>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Blocks satisfied {completedBlocks}/{blockSummaries.length} ·
              Remaining {remainingBlocks}
            </p>
          </div>

          {blockSummaries.length ? (
            <div className="space-y-8">
              {orderedCategories.map((category) => {
                const summaries = blocksByCategory.get(category) ?? [];
                return (
                  <div key={category} className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg">{category}</h3>
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {summaries.length} block{summaries.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <div className="space-y-6">
                      {summaries.map(({ block, assignedCourses, status, missingText }) => (
                        <div
                          key={block.id}
                          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                {block.category ?? "Requirement"}
                              </p>
                              <h4 className="text-lg">{block.title}</h4>
                              <p className="text-sm text-[var(--muted)]">
                                {block.description ?? ""}
                              </p>
                            </div>
                            <div className="text-right space-y-1">
                              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                Status
                              </p>
                              <p className="text-sm font-semibold capitalize">{status}</p>
                              {isAdmin ? (
                                <Link
                                  href={`/programs/${program.id}/requirements/${block.id}/edit`}
                                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                                >
                                  Edit block
                                </Link>
                              ) : null}
                            </div>
                          </div>

                          <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            Requirement: {formatRule(block)}
                          </div>
                          <div className="text-sm text-[var(--muted)]">
                            {status === "complete"
                              ? "Satisfied."
                              : missingText
                              ? `Remaining: ${missingText}.`
                              : "Incomplete."}
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                              Assigned Courses
                            </p>
                            {assignedCourses.length ? (
                              <ul className="space-y-2 text-sm text-[var(--muted)]">
                                {assignedCourses.map((course) => (
                                  <li
                                    key={course.id}
                                    className="flex flex-wrap items-center justify-between gap-3"
                                  >
                                    <span>
                                      {course.code ? `${course.code} — ` : ""}
                                      {course.title}
                                    </span>
                                    <span className="text-xs uppercase tracking-[0.2em]">
                                      {formatStatus(course.status)}
                                    </span>
                                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                      {course.readiness}
                                      {course.readiness === "Prerequisites pending" &&
                                      course.unmetPrereqs?.length ? (
                                        <>
                                          {" "}
                                          · Prereqs{" "}
                                          {course.unmetPrereqs
                                            .map((prereq) =>
                                              prereq.code
                                                ? `${prereq.code}`
                                                : prereq.title
                                            )
                                            .join(", ")}
                                        </>
                                      ) : null}
                                    </span>
                                    <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                      {course.finalAssignments} of {course.totalAssignments} final submissions
                                    </span>
                                    {course.status !== "completed" && course.unreadReadings > 0 ? (
                                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                        {course.unreadReadings} reading{course.unreadReadings === 1 ? "" : "s"} remaining
                                      </span>
                                    ) : null}
                                    {course.status !== "completed" && course.missingFinals > 0 ? (
                                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                        {course.missingFinals} final{course.missingFinals === 1 ? "" : "s"} outstanding
                                      </span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-[var(--muted)]">
                                No courses assigned to this block.
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No requirement blocks have been established for this program.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
