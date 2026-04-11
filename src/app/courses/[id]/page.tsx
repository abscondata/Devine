import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getModuleStanding,
  getReadinessState,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { ProtectedShell } from "@/components/protected-shell";
import {
  computeTermSchedule,
  formatScheduleDate,
} from "@/lib/term-schedule";

export default async function CoursePage({
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
      "id, title, description, code, department_or_domain, credits_or_weight, level, learning_outcomes, syllabus, status, program:programs(id, title), domain:domains(id, title, code)"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: prerequisites } = await supabase
    .from("course_prerequisites")
    .select("prerequisite:prerequisite_course_id(id, title, code)")
    .eq("course_id", id);

  const prerequisiteCourses = (prerequisites ?? [])
    .map((item) => item.prerequisite)
    .filter(Boolean);

  const { data: requirementMappings } = await supabase
    .from("course_requirement_blocks")
    .select("requirement_block:requirement_block_id(id, title, category)")
    .eq("course_id", id);

  const requirementBlocks = (requirementMappings ?? [])
    .map((item) => item.requirement_block)
    .filter(Boolean);

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, overview, position, course_id")
    .eq("course_id", id)
    .order("position", { ascending: true });

  const moduleIds = modules?.map((module) => module.id) ?? [];

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, status, position")
        .in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id, title, assignment_type, due_at")
        .in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];
  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final")
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

  const moduleToCourse = new Map<string, string>();
  modules?.forEach((module) => {
    moduleToCourse.set(module.id, module.course_id);
  });

  const moduleSummaries = (modules ?? []).map((module, index) => {
    const moduleReadings = readingsByModule.get(module.id) ?? [];
    const moduleAssignments = assignmentsByModule.get(module.id) ?? [];
    const moduleStanding = getModuleStanding({
      readings: moduleReadings,
      assignments: moduleAssignments,
      assignmentStatus,
    });
    const estimatedHours = moduleReadings.reduce(
      (sum, reading) => sum + (reading.estimated_hours ?? 0),
      0
    );

    return {
      ...module,
      totalTasks: moduleStanding.completion.totalTasks,
      completedTasks: moduleStanding.completion.completedTasks,
      estimatedHours,
    };
  });

  const nextModule = moduleSummaries.find(
    (module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks
  );

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
  const totalHours = moduleSummaries.reduce(
    (sum, module) => sum + module.estimatedHours,
    0
  );
  const { unreadReadings, skippedReadings, missingFinals } =
    courseStanding.completion;
  const { totalAssignments, finalAssignments, draftAssignments, critiquedFinals } =
    courseStanding.assignmentSummary;

  const { data: prereqModules } = prerequisiteCourses.length
    ? await supabase
        .from("modules")
        .select("id, course_id")
        .in(
          "course_id",
          prerequisiteCourses.map((course) => course.id)
        )
    : { data: [] };

  const prereqModuleIds = prereqModules?.map((module) => module.id) ?? [];
  const { data: prereqReadings } = prereqModuleIds.length
    ? await supabase
        .from("readings")
        .select("id, module_id, status")
        .in("module_id", prereqModuleIds)
    : { data: [] };
  const { data: prereqAssignments } = prereqModuleIds.length
    ? await supabase
        .from("assignments")
        .select("id, module_id")
        .in("module_id", prereqModuleIds)
    : { data: [] };
  const prereqAssignmentIds = prereqAssignments?.map((assignment) => assignment.id) ?? [];
  const { data: prereqFinals } = prereqAssignmentIds.length
    ? await supabase
        .from("submissions")
        .select("assignment_id")
        .eq("user_id", user.id)
        .eq("is_final", true)
        .in("assignment_id", prereqAssignmentIds)
    : { data: [] };

  const prereqFinalSet = new Set(prereqFinals?.map((item) => item.assignment_id));
  const prereqModulesByCourse = new Map<string, { id: string }[]>();
  prereqModules?.forEach((module) => {
    const list = prereqModulesByCourse.get(module.course_id) ?? [];
    list.push(module);
    prereqModulesByCourse.set(module.course_id, list);
  });
  const prereqReadingsByModule = new Map<string, typeof prereqReadings>();
  prereqReadings?.forEach((reading) => {
    const list = prereqReadingsByModule.get(reading.module_id) ?? [];
    list.push(reading);
    prereqReadingsByModule.set(reading.module_id, list);
  });
  const prereqAssignmentsByModule = new Map<string, typeof prereqAssignments>();
  prereqAssignments?.forEach((assignment) => {
    const list = prereqAssignmentsByModule.get(assignment.module_id) ?? [];
    list.push(assignment);
    prereqAssignmentsByModule.set(assignment.module_id, list);
  });

  const prereqCompletion = new Map<string, boolean>();
  prerequisiteCourses.forEach((course) => {
    const courseModules = prereqModulesByCourse.get(course.id) ?? [];
    let totalTasks = 0;
    let completedTasks = 0;
    courseModules.forEach((module) => {
      const moduleReadings = prereqReadingsByModule.get(module.id) ?? [];
      const moduleAssignments = prereqAssignmentsByModule.get(module.id) ?? [];
      const moduleStanding = getModuleStanding({
        readings: moduleReadings,
        assignments: moduleAssignments,
        assignmentStatus: new Map(
          moduleAssignments
            .filter((assignment) => prereqFinalSet.has(assignment.id))
            .map((assignment) => [
              assignment.id,
              { hasFinal: true, hasDraft: false, hasCritique: false },
            ])
        ),
      });
      totalTasks += moduleStanding.completion.totalTasks;
      completedTasks += moduleStanding.completion.completedTasks;
    });
    prereqCompletion.set(
      course.id,
      totalTasks > 0 && completedTasks >= totalTasks
    );
  });

  const unmetPrereqs = prerequisiteCourses.filter(
    (course) => !(prereqCompletion.get(course.id) ?? false)
  );
  const isCourseComplete = courseStanding.completion.isComplete;
  const readinessState = getReadinessState({
    isComplete: isCourseComplete,
    unmetPrereqs,
    hasPrereqs: prerequisiteCourses.length > 0,
  });
  const readinessStatus =
    readinessState.status === "completed"
      ? "Complete"
      : readinessState.status === "ready"
      ? "Prerequisites satisfied"
      : "Prerequisites pending";

  const foundationOrder = ["PHIL 501", "THEO 510", "HIST 520", "SCRP 530"];
  const isFoundationCourse = foundationOrder.includes(course.code ?? "");
  const foundationLabel = course.code
    ? foundationOrder
        .map((code, index) => ({ code, index: index + 1 }))
        .find((item) => item.code === course.code)?.index
    : null;

  // ─── TERM SCHEDULE (if this course is in the current term) ───
  const { data: currentTerm } = course.program?.id
    ? await supabase
        .from("academic_terms")
        .select("id, title, starts_at, ends_at")
        .eq("program_id", course.program.id)
        .eq("is_current", true)
        .maybeSingle()
    : { data: null };

  const schedule = currentTerm?.starts_at && currentTerm?.ends_at
    ? computeTermSchedule({
        termStartsAt: currentTerm.starts_at,
        termEndsAt: currentTerm.ends_at,
        courses: [{
          id: course.id,
          modules: (modules ?? []).map((m) => ({ id: m.id, position: m.position })),
        }],
      })
    : null;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8">
        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard">My Term</Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{course.code}</span>
            {course.level ? <span>{course.level}</span> : null}
            {course.credits_or_weight ? <span>{course.credits_or_weight} credits</span> : null}
            <span>{moduleSummaries.length} units</span>
            <span>{(readings ?? []).length} readings</span>
            <span>{(assignments ?? []).length} written assignments</span>
          </div>
          <h1 className="text-3xl">{course.title}</h1>
          {course.description ? <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{course.description}</p> : null}
        </header>

        {/* ─── Current course work ─── */}
        {nextModule ? (
          <section className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Current course work</p>
            <Link href={`/modules/${nextModule.id}`} className="block group">
              <p className="text-sm font-semibold group-hover:text-[var(--accent-soft)]">
                Unit {nextModule.position + 1}: {nextModule.title}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 text-xs text-[var(--muted)]">
                {(() => {
                  const unitSched = schedule?.unitSchedules.get(nextModule.id);
                  return unitSched ? <span>Due {formatScheduleDate(unitSched.endsAt)}</span> : null;
                })()}
                <span>{completedTasks} of {totalTasks} requirements fulfilled</span>
                <span>{finalAssignments} of {totalAssignments} final submissions</span>
              </div>
            </Link>
          </section>
        ) : isCourseComplete ? (
          <section className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Standing</p>
            <p className="text-sm font-semibold">All requirements fulfilled. This course is officially complete.</p>
          </section>
        ) : null}

        {/* ─── Course requirements ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Course Requirements</h2>
          <div className="text-sm text-[var(--muted)] space-y-2">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>{(readings ?? []).length} readings{totalHours ? ` · ${totalHours.toFixed(1)}h` : ""}</span>
              <span>{(assignments ?? []).length} written assignments</span>
              <span>{completedTasks}/{totalTasks} fulfilled</span>
            </div>
            <p>
              Completion requires all assigned readings marked complete and a final submission for each written assignment. Critique is recommended but not required for standing.
            </p>
          </div>
        </section>

        {/* ─── Required materials ─── */}
        {(() => {
          const allReadings = (readings ?? []) as { id: string; title: string | null; author: string | null; source_type: string | null; primary_or_secondary: string | null; tradition_or_era: string | null; pages_or_length: string | null }[];
          // Group by source_type
          const bySource = new Map<string, typeof allReadings>();
          allReadings.forEach((r) => {
            const key = r.source_type ?? "Other";
            const list = bySource.get(key) ?? [];
            list.push(r);
            bySource.set(key, list);
          });
          // Deduplicate by author+title (same text assigned in multiple units)
          const seen = new Set<string>();
          const unique = allReadings.filter((r) => {
            const key = `${r.author}|${r.title}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          const sourceOrder = ["Primary text", "Magisterial text", "Scripture", "Patristic text", "Conciliar text", "Historical text", "Imperial text", "Secondary text"];
          const orderedSources = [
            ...sourceOrder.filter((s) => bySource.has(s)),
            ...Array.from(bySource.keys()).filter((s) => !sourceOrder.includes(s)),
          ];

          return unique.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-lg">Required Materials</h2>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {orderedSources.map((sourceType) => {
                  const items = (bySource.get(sourceType) ?? []).filter((r) => {
                    const key = `${r.author}|${r.title}`;
                    return seen.has(key); // all pass since we built seen from allReadings
                  });
                  // Deduplicate within source type
                  const seenInGroup = new Set<string>();
                  const uniqueItems = items.filter((r) => {
                    const key = `${r.author}|${r.title}`;
                    if (seenInGroup.has(key)) return false;
                    seenInGroup.add(key);
                    return true;
                  });
                  if (!uniqueItems.length) return null;
                  return (
                    <div key={sourceType} className="p-5 space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{sourceType}</p>
                      <ul className="space-y-1 text-sm text-[var(--muted)]">
                        {uniqueItems.map((r, i) => (
                          <li key={r.id ?? i}>
                            {r.author ? <span className="font-semibold">{r.author}</span> : null}
                            {r.author && r.title ? ", " : null}
                            {r.title ? <span className="font-serif italic">{r.title}</span> : null}
                            {r.pages_or_length ? <span> ({r.pages_or_length})</span> : null}
                            {r.tradition_or_era ? <span className="text-xs"> · {r.tradition_or_era}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null;
        })()}

        <section className="space-y-4">
          <h2 className="text-lg">Unit Sequence</h2>

          {moduleSummaries.length ? (
            <div className="space-y-6">
              {moduleSummaries.map((module) => {
                const unitReadings = readingsByModule.get(module.id) ?? [];
                const unitAssignments = assignmentsByModule.get(module.id) ?? [];
                const isComplete = module.completedTasks === module.totalTasks && module.totalTasks > 0;
                const unitSched = schedule?.unitSchedules.get(module.id);

                return (
                  <div key={module.id} className="space-y-2">
                    <Link href={`/modules/${module.id}`} className="block group">
                      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-x-3 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            <span>Unit {module.position + 1}</span>
                            {unitSched ? <span>{formatScheduleDate(unitSched.startsAt)} – {formatScheduleDate(unitSched.endsAt)}</span> : null}
                            <span>{isComplete ? "Complete" : `${module.completedTasks}/${module.totalTasks}`}</span>
                          </div>
                          <h3 className="text-base font-semibold group-hover:text-[var(--accent-soft)]">{module.title}</h3>
                        </div>
                      </div>
                      {module.overview ? (
                        <p className="mt-1 font-serif text-sm leading-relaxed text-[var(--muted)]">{module.overview}</p>
                      ) : null}
                    </Link>

                    {(unitReadings.length > 0 || unitAssignments.length > 0) ? (
                      <div className="grid gap-x-8 gap-y-2 md:grid-cols-2 pl-4 border-l-2 border-[var(--border)]">
                        {unitReadings.length > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                            <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                              {(unitReadings as { id?: string; title?: string | null; author?: string | null; position?: number }[])
                                .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
                                .map((r, i) => (
                                  <li key={r.id ?? i}>
                                    {r.author ? `${r.author}, ` : ""}{r.title}
                                  </li>
                                ))}
                            </ul>
                          </div>
                        ) : null}
                        {unitAssignments.length > 0 ? (
                          <div className="space-y-0.5">
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                            <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                              {(unitAssignments as { id?: string; title?: string | null; assignment_type?: string }[]).map((a, i) => (
                                <li key={a.id ?? i}>
                                  {a.title}{a.assignment_type ? ` (${a.assignment_type.replace(/_/g, " ")})` : ""}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No units of study have been established for this course.
            </p>
          )}
        </section>

        {(course.syllabus || course.learning_outcomes) ? (
          <section className="space-y-3">
            <h2 className="text-lg">Course Description</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              {course.syllabus ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Syllabus overview</p>
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

        {!isCourseComplete ? (
          <section className="space-y-3">
            <h2 className="text-lg">Standing</h2>
            <div className="text-sm text-[var(--muted)] space-y-2">
              <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>{completedTasks} of {totalTasks || 0} requirements fulfilled</span>
                <span>{finalAssignments} of {totalAssignments} final submissions</span>
              </div>
              <ul className="list-disc pl-5 text-[var(--muted)]">
                {unreadReadings > 0 ? (
                  <li>{unreadReadings} reading{unreadReadings === 1 ? "" : "s"} not complete</li>
                ) : null}
                {skippedReadings > 0 ? (
                  <li>{skippedReadings} reading{skippedReadings === 1 ? "" : "s"} skipped (do not count)</li>
                ) : null}
                {missingFinals > 0 ? (
                  <li>{missingFinals} assignment{missingFinals === 1 ? "" : "s"} missing final submission</li>
                ) : null}
                {draftAssignments > 0 ? (
                  <li>{draftAssignments} assignment{draftAssignments === 1 ? "" : "s"} with draft only</li>
                ) : null}
                {courseStanding.completion.thesisIncomplete ? (
                  <li>
                    {courseStanding.thesis?.hasProject
                      ? "Thesis milestones remain incomplete."
                      : "No thesis project recorded for RSYN 720."}
                  </li>
                ) : null}
              </ul>
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <h2 className="text-lg">Course Details</h2>
          <div className="divide-y divide-[var(--border)] text-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-32 shrink-0">Catalog</p>
              <p className="text-[var(--muted)] flex-1">
                {[course.code, course.level, course.credits_or_weight ? `${course.credits_or_weight} credits` : null, course.domain?.title ?? course.department_or_domain].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-32 shrink-0">Prerequisites</p>
              <div className="text-[var(--muted)] flex-1">
                {prerequisiteCourses.length ? (
                  <>
                    <p>{prerequisiteCourses.map((p) => p.code ? `${p.code} — ${p.title}` : p.title).join("; ")}</p>
                    {unmetPrereqs.length ? (
                      <p className="text-xs text-[var(--muted)] mt-1">Pending: {unmetPrereqs.map((c) => c.code ?? c.title).join(", ")}</p>
                    ) : null}
                  </>
                ) : (
                  <p>None. This course may be taken first.</p>
                )}
              </div>
            </div>
            {requirementBlocks.length ? (
              <div className="flex flex-wrap items-start justify-between gap-4 py-3">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-32 shrink-0">Satisfies</p>
                <p className="text-[var(--muted)] flex-1">
                  {requirementBlocks.map((b) => `${b.title}${b.category ? ` (${b.category})` : ""}`).join("; ")}
                </p>
              </div>
            ) : null}
            <div className="flex flex-wrap items-start justify-between gap-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-32 shrink-0">Readiness</p>
              <p className="text-[var(--muted)] flex-1">{readinessStatus}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href={`/courses/${course.id}/readings`} className="hover:text-[var(--text)]">Reading list</Link>
            <Link href={`/courses/${course.id}/dossier`} className="hover:text-[var(--text)]">Course dossier</Link>
            {course.program?.id ? (
              <Link href={`/programs/${course.program.id}/audit`} className="hover:text-[var(--text)]">Program audit</Link>
            ) : null}
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
