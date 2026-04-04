import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

const COMPLETED_READING_STATUSES = new Set(["complete"]);

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, description, credits_or_weight, program:programs(id, title)")
    .eq("is_active", true)
    .order("title");

  const courseIds = courses?.map((course) => course.id) ?? [];

  const { data: modules } = courseIds.length
    ? await supabase
        .from("modules")
        .select("id, course_id, title, position")
        .in("course_id", courseIds)
        .order("position", { ascending: true })
    : { data: [] };

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, status, estimated_hours, position")
        .in("module_id", moduleIds)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title, due_at")
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

  const finalSet = new Set(finalSubmissions.map((item) => item.assignment_id));
  const critiquesBySubmission = new Map<string, number>();
  critiques?.forEach((critique) => {
    critiquesBySubmission.set(
      critique.submission_id,
      (critiquesBySubmission.get(critique.submission_id) ?? 0) + 1
    );
  });

  const assignmentStatus = new Map<
    string,
    { hasFinal: boolean; hasDraft: boolean; hasCritique: boolean }
  >();
  submissions?.forEach((submission) => {
    const current = assignmentStatus.get(submission.assignment_id) ?? {
      hasFinal: false,
      hasDraft: false,
      hasCritique: false,
    };
    if (submission.is_final) {
      current.hasFinal = true;
      if ((critiquesBySubmission.get(submission.id) ?? 0) > 0) {
        current.hasCritique = true;
      }
    } else {
      current.hasDraft = true;
    }
    assignmentStatus.set(submission.assignment_id, current);
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

  const courseReadingStats = new Map<
    string,
    { totalReadings: number; completedReadings: number; skippedReadings: number }
  >();
  readings?.forEach((reading) => {
    const courseId = moduleToCourse.get(reading.module_id);
    if (!courseId) return;
    const stats = courseReadingStats.get(courseId) ?? {
      totalReadings: 0,
      completedReadings: 0,
      skippedReadings: 0,
    };
    stats.totalReadings += 1;
    if (COMPLETED_READING_STATUSES.has(reading.status)) {
      stats.completedReadings += 1;
    }
    if (reading.status === "skipped") {
      stats.skippedReadings += 1;
    }
    courseReadingStats.set(courseId, stats);
  });

  const courseAssignmentStats = new Map<
    string,
    {
      totalAssignments: number;
      finalAssignments: number;
      draftAssignments: number;
      critiquedFinals: number;
    }
  >();
  assignments?.forEach((assignment) => {
    const courseId = moduleToCourse.get(assignment.module_id);
    if (!courseId) return;
    const stats = courseAssignmentStats.get(courseId) ?? {
      totalAssignments: 0,
      finalAssignments: 0,
      draftAssignments: 0,
      critiquedFinals: 0,
    };
    stats.totalAssignments += 1;
    const status = assignmentStatus.get(assignment.id);
    if (status?.hasFinal) {
      stats.finalAssignments += 1;
      if (status.hasCritique) {
        stats.critiquedFinals += 1;
      }
    } else if (status?.hasDraft) {
      stats.draftAssignments += 1;
    }
    courseAssignmentStats.set(courseId, stats);
  });

  const moduleProgress = (modules ?? []).map((module) => {
    const moduleReadings = readingsByModule.get(module.id) ?? [];
    const moduleAssignments = assignmentsByModule.get(module.id) ?? [];
    const completedReadings = moduleReadings.filter((reading) =>
      COMPLETED_READING_STATUSES.has(reading.status)
    ).length;
    const completedAssignments = moduleAssignments.filter((assignment) =>
      finalSet.has(assignment.id)
    ).length;
    const totalTasks = moduleReadings.length + moduleAssignments.length;
    const completedTasks = completedReadings + completedAssignments;

    return {
      ...module,
      totalTasks,
      completedTasks,
      progress: totalTasks ? completedTasks / totalTasks : 0,
    };
  });

  const courseSummaries = (courses ?? []).map((course) => {
    const modulesForCourse = moduleProgress.filter(
      (module) => module.course_id === course.id
    );
    const totalTasks = modulesForCourse.reduce(
      (sum, module) => sum + module.totalTasks,
      0
    );
    const completedTasks = modulesForCourse.reduce(
      (sum, module) => sum + module.completedTasks,
      0
    );
    const progress = totalTasks ? completedTasks / totalTasks : 0;
    const currentModule = modulesForCourse.find(
      (module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks
    );
    const assignmentStats = courseAssignmentStats.get(course.id) ?? {
      totalAssignments: 0,
      finalAssignments: 0,
      draftAssignments: 0,
      critiquedFinals: 0,
    };
    const readingStats = courseReadingStats.get(course.id) ?? {
      totalReadings: 0,
      completedReadings: 0,
      skippedReadings: 0,
    };

    return {
      ...course,
      totalTasks,
      completedTasks,
      progress,
      currentModule,
      ...assignmentStats,
      unreadReadings: readingStats.totalReadings - readingStats.completedReadings,
      skippedReadings: readingStats.skippedReadings,
      missingFinals: assignmentStats.totalAssignments - assignmentStats.finalAssignments,
      status:
        totalTasks > 0 && completedTasks >= totalTasks
          ? "Officially Complete"
          : completedTasks > 0
          ? "In Progress"
          : "Not Yet Started",
      finalDate: courseFinalDates.get(course.id) ?? null,
    };
  });

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

  const completionByCourse = new Map<string, boolean>();
  courseSummaries.forEach((course) => {
    completionByCourse.set(
      course.id,
      course.totalTasks > 0 && course.completedTasks >= course.totalTasks
    );
  });

  const readinessByCourse = new Map<
    string,
    { status: "ready" | "blocked" | "completed"; reason: string }
  >();
  courseSummaries.forEach((course) => {
    const isComplete = completionByCourse.get(course.id) ?? false;
    if (isComplete) {
      readinessByCourse.set(course.id, {
        status: "completed",
        reason: "Course completed.",
      });
      return;
    }
    const prereqs = prereqsByCourse.get(course.id) ?? [];
    if (!prereqs.length) {
      readinessByCourse.set(course.id, {
        status: "ready",
        reason: "No prerequisites.",
      });
      return;
    }
    const unmet = prereqs.filter(
      (prereq) => !(completionByCourse.get(prereq.id) ?? false)
    );
    if (unmet.length) {
      readinessByCourse.set(course.id, {
        status: "blocked",
        reason: `Prerequisites incomplete: ${unmet
          .map((prereq) => (prereq.code ? `${prereq.code} — ` : "") + prereq.title)
          .join(", ")}`,
      });
      return;
    }
    readinessByCourse.set(course.id, {
      status: "ready",
      reason: "Prerequisites satisfied.",
    });
  });

  const foundationOrder = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const foundationCourses = foundationOrder
    .map((code) => courseSummaries.find((course) => course.code === code))
    .filter((course): course is (typeof courseSummaries)[number] => Boolean(course));

  const recommendedNext =
    foundationCourses.find(
      (course) =>
        course &&
        (readinessByCourse.get(course.id)?.status ?? "blocked") === "ready"
    ) ??
    courseSummaries.find(
      (course) =>
        (readinessByCourse.get(course.id)?.status ?? "blocked") === "ready"
    );

  const completedCourses = courseSummaries.filter(
    (course) => course.status === "Officially Complete"
  );
  const inProgressCourses = courseSummaries.filter(
    (course) => course.status === "In Progress"
  );
  const notStartedCourses = courseSummaries.filter(
    (course) => course.status === "Not Yet Started"
  );
  const completedCourseIds = new Set(completedCourses.map((course) => course.id));

  const programIds = Array.from(
    new Set(
      (courses ?? [])
        .map((course) => course.program?.id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const { data: requirementBlocks } = programIds.length
    ? await supabase
        .from("requirement_blocks")
        .select("id, program_id, title, minimum_courses_required, minimum_credits_required, position")
        .in("program_id", programIds)
        .order("position", { ascending: true })
    : { data: [] };
  const blockIds = requirementBlocks?.map((block) => block.id) ?? [];
  const { data: blockMappings } = blockIds.length
    ? await supabase
        .from("course_requirement_blocks")
        .select("requirement_block_id, course_id")
        .in("requirement_block_id", blockIds)
    : { data: [] };

  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );
  const blockProgress = (requirementBlocks ?? []).map((block) => {
    const assignedCourseIds = (blockMappings ?? [])
      .filter((mapping) => mapping.requirement_block_id === block.id)
      .map((mapping) => mapping.course_id);
    const completedInBlock = assignedCourseIds.filter((courseId) =>
      completedCourseIds.has(courseId)
    );
    const completedCredits = completedInBlock.reduce((sum, courseId) => {
      const course = coursesById.get(courseId);
      return sum + (course?.credits_or_weight ?? 0);
    }, 0);
    const missingCourses =
      block.minimum_courses_required !== null
        ? Math.max(0, block.minimum_courses_required - completedInBlock.length)
        : null;
    const missingCredits =
      block.minimum_credits_required !== null
        ? Math.max(0, block.minimum_credits_required - completedCredits)
        : null;
    const satisfied =
      (missingCourses === null || missingCourses === 0) &&
      (missingCredits === null || missingCredits === 0);
    return {
      ...block,
      satisfied,
    };
  });

  const programSummaries = programIds.map((programId) => {
    const program = (courses ?? []).find((course) => course.program?.id === programId)?.program;
    const programBlocks = blockProgress.filter(
      (block) => block.program_id === programId
    );
    const satisfiedBlocks = programBlocks.filter((block) => block.satisfied).length;
    return {
      id: programId,
      title: program?.title ?? "Program",
      totalBlocks: programBlocks.length,
      satisfiedBlocks,
      remainingBlocks: Math.max(0, programBlocks.length - satisfiedBlocks),
    };
  });

  const openAssignments = (assignments ?? []).filter(
    (assignment) => !finalSet.has(assignment.id)
  );

  const currentModule = moduleProgress
    .filter((module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks)
    .sort((a, b) => {
      const courseA = courseSummaries.find((course) => course.id === a.course_id);
      const courseB = courseSummaries.find((course) => course.id === b.course_id);
      const titleCompare = (courseA?.title ?? "").localeCompare(courseB?.title ?? "");
      if (titleCompare !== 0) return titleCompare;
      return a.position - b.position;
    })[0];

  const currentReadings = currentModule
    ? (readingsByModule.get(currentModule.id) ?? []).filter(
        (reading) => !COMPLETED_READING_STATUSES.has(reading.status)
      )
    : [];

  const currentAssignments = currentModule
    ? (assignmentsByModule.get(currentModule.id) ?? []).filter(
        (assignment) => !finalSet.has(assignment.id)
      )
    : [];

  const currentUnreadReading = currentModule
    ? (readingsByModule.get(currentModule.id) ?? []).find(
        (reading) => !COMPLETED_READING_STATUSES.has(reading.status)
      )
    : null;
  const currentDraftOnlyAssignment = currentModule
    ? (assignmentsByModule.get(currentModule.id) ?? []).find((assignment) => {
        const status = assignmentStatus.get(assignment.id);
        return status?.hasDraft && !status?.hasFinal;
      })
    : null;
  const currentMissingAssignment = currentModule
    ? (assignmentsByModule.get(currentModule.id) ?? []).find((assignment) => {
        const status = assignmentStatus.get(assignment.id);
        return !status?.hasDraft && !status?.hasFinal;
      })
    : null;
  const nextAction = currentUnreadReading
    ? {
        title: `Complete reading: ${currentUnreadReading.title}`,
        reason: "Unread readings block module completion.",
      }
    : currentDraftOnlyAssignment
    ? {
        title: `Finalize assignment: ${currentDraftOnlyAssignment.title}`,
        reason: "Drafts do not count toward official completion.",
      }
    : currentMissingAssignment
    ? {
        title: `Draft assignment: ${currentMissingAssignment.title}`,
        reason: "Assignments require a final submission to complete the module.",
      }
    : null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Overview
          </p>
          <h1 className="text-3xl font-semibold">Dashboard</h1>
          <p className="text-sm text-[var(--muted)]">
            Active coursework, current module, and open work.
          </p>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Quick Create</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {[
              { href: "/programs/new", label: "Program" },
              { href: "/domains/new", label: "Domain" },
              { href: "/courses/new", label: "Course" },
              { href: "/modules/new", label: "Module" },
              { href: "/assignments/new", label: "Assignment" },
              { href: "/readings/new", label: "Reading" },
              { href: "/concepts/new", label: "Concept" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--muted)] hover:border-[var(--accent-soft)]"
              >
                Create {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Foundations Phase</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Opening sequence
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <p className="text-sm text-[var(--muted)]">
              The foundations sequence establishes method and content for the
              entire curriculum. PHIL 501 undergirds THEO 510; HIST 520 and
              SCRP 530 complete the early ecclesial and scriptural arc.
            </p>
            {foundationCourses.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {foundationCourses.map((course, index) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)] hover:border-[var(--accent-soft)]"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Step {index + 1}
                    </p>
                    <h3 className="mt-2 text-base font-semibold text-[var(--text)]">
                      {course.code ? `${course.code} — ` : ""}
                      {course.title}
                    </h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {course.description ?? "No description provided."}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Foundations courses are not yet seeded.
              </p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Academic Record</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Standing
            </span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
            <div className="flex flex-wrap gap-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>Completed {completedCourses.length}</span>
              <span>In progress {inProgressCourses.length}</span>
              <span>Not started {notStartedCourses.length}</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3 text-sm text-[var(--muted)]">
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
                            · Final {formatDate(course.finalDate)}
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
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Program Standing</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Constitutional progress
            </span>
          </div>
          {programSummaries.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {programSummaries.map((program) => (
                <Link
                  key={program.id}
                  href={`/programs/${program.id}/audit`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] hover:border-[var(--accent-soft)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {program.title}
                  </p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Requirement blocks satisfied {program.satisfiedBlocks}/{program.totalBlocks}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Remaining {program.remainingBlocks}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No programs found for constitutional audit.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Recommended Next</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Readiness
            </span>
          </div>
          {recommendedNext ? (
            <Link
              href={`/courses/${recommendedNext.id}`}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                {(recommendedNext.code ? `${recommendedNext.code} — ` : "") +
                  recommendedNext.title}
              </p>
              <p className="mt-2 text-sm text-[var(--muted)]">
                {recommendedNext.description ?? "No description provided."}
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Ready now · {readinessByCourse.get(recommendedNext.id)?.reason ?? ""}
              </p>
            </Link>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No courses are ready yet. Complete prerequisites to unlock the next step.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Active Courses</h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {courseSummaries.length} total
            </span>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Official completion requires all readings marked complete (skipped
            readings do not count) and final submissions for every assignment.
            Critiques are recommended but do not determine completion.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {courseSummaries.length ? (
              courseSummaries.map((course) => (
                <Link
                  key={course.id}
                  href={`/courses/${course.id}`}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent-soft)]"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {course.program?.title ?? "Program"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{course.title}</h3>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    {course.description ?? "No description provided."}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {readinessByCourse.get(course.id)?.status === "completed"
                      ? "Completed"
                      : readinessByCourse.get(course.id)?.status === "ready"
                      ? "Ready now"
                      : "Not yet"}
                    {readinessByCourse.get(course.id)?.status === "blocked"
                      ? ` · ${readinessByCourse.get(course.id)?.reason}`
                      : ""}
                  </p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Progress {course.completedTasks}/{course.totalTasks}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <span>
                      Final {course.finalAssignments}/{course.totalAssignments}
                    </span>
                    {course.draftAssignments ? (
                      <span>Drafts {course.draftAssignments}</span>
                    ) : null}
                    {course.finalAssignments ? (
                      <span>
                        Critiqued {course.critiquedFinals}/{course.finalAssignments}
                      </span>
                    ) : null}
                    {course.completedTasks < course.totalTasks ? (
                      <span>
                        Blockers
                        {course.unreadReadings > 0
                          ? ` ${course.unreadReadings} reading${course.unreadReadings === 1 ? "" : "s"}`
                          : ""}
                        {course.missingFinals > 0
                          ? ` ${course.missingFinals} final${course.missingFinals === 1 ? "" : "s"}`
                          : ""}
                        {course.skippedReadings > 0
                          ? ` ${course.skippedReadings} skipped`
                          : ""}
                      </span>
                    ) : null}
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                No active courses found. Add courses to populate this view.
              </div>
            )}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Current Module</h2>
            {currentModule ? (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Module {currentModule.position + 1}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold">{currentModule.title}</h3>
                </div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Progress {currentModule.completedTasks}/{currentModule.totalTasks}
                </p>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Open Readings
                    </p>
                    {currentReadings.length ? (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                        {currentReadings.map((reading) => (
                          <li
                            key={reading.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span>{reading.title}</span>
                            {reading.status === "skipped" ? (
                              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                Skipped
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No open readings.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Open Assignments
                    </p>
                    {currentAssignments.length ? (
                      <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
                        {currentAssignments.map((assignment) => (
                          <li key={assignment.id}>{assignment.title}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        No open assignments.
                      </p>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)] space-y-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    Next Required Action
                  </p>
                  {nextAction ? (
                    <>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {nextAction.title}
                      </p>
                      <p>{nextAction.reason}</p>
                    </>
                  ) : (
                    <p>All required work in this module is complete.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                All modules are complete or no module work exists yet.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Open Assignments</h2>
            <div className="space-y-3">
              {openAssignments.length ? (
                openAssignments.slice(0, 6).map((assignment) => (
                  <Link
                    key={assignment.id}
                    href={`/assignments/${assignment.id}`}
                    className="flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent-soft)]"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold">{assignment.title}</h3>
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {assignment.due_at
                          ? new Date(assignment.due_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "No deadline"}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
                  No open assignments right now.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
