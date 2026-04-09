import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getStandingStatus,
  getStandingLabel,
  summarizeRequirementBlocks,
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

export default async function ResearchReadinessPage({
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
    .select("id, title")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  // All courses in program
  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight, sequence_position, level")
    .eq("program_id", id)
    .order("sequence_position", { ascending: true });

  // Requirement blocks and mappings
  const { data: requirementBlocks } = await supabase
    .from("requirement_blocks")
    .select("id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position")
    .eq("program_id", id)
    .order("position", { ascending: true });

  const blockIds = requirementBlocks?.map((b) => b.id) ?? [];
  const { data: mappings } = blockIds.length
    ? await supabase.from("course_requirement_blocks").select("requirement_block_id, course_id").in("requirement_block_id", blockIds)
    : { data: [] };

  // Prerequisites for all courses
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: prereqRows } = courseIds.length
    ? await supabase.from("course_prerequisites").select("course_id, prerequisite:prerequisite_course_id(id, title, code)").in("course_id", courseIds)
    : { data: [] };

  // Completion data
  const { data: modules } = courseIds.length
    ? await supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds)
    : { data: [] };

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: readings } = moduleIds.length
    ? await supabase.from("readings").select("id, module_id, title, status").in("module_id", moduleIds)
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase.from("assignments").select("id, module_id, title").in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length
    ? await supabase.from("submissions").select("id, assignment_id, is_final, created_at").eq("user_id", user.id).in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubs = (submissions ?? []).filter((s) => s.is_final);
  const finalSubIds = finalSubs.map((s) => s.id);
  const { data: critiques } = finalSubIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubIds)
    : { data: [] };

  // Thesis data
  const { data: thesisProjects } = await supabase
    .from("thesis_projects")
    .select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at")
    .eq("program_id", id);

  const tpIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = tpIds.length
    ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", tpIds)
    : { data: [] };

  // Build maps
  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubIds),
  });

  type RR = NonNullable<typeof readings>[number];
  type AR = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, RR[]>();
  (readings ?? []).forEach((r) => {
    const list = readingsByModule.get(r.module_id) ?? [];
    list.push(r);
    readingsByModule.set(r.module_id, list);
  });

  const assignmentsByModule = new Map<string, AR[]>();
  (assignments ?? []).forEach((a) => {
    const list = assignmentsByModule.get(a.module_id) ?? [];
    list.push(a);
    assignmentsByModule.set(a.module_id, list);
  });

  const modulesByCourse = new Map<string, { id: string }[]>();
  (modules ?? []).forEach((m) => {
    const list = modulesByCourse.get(m.course_id) ?? [];
    list.push({ id: m.id });
    modulesByCourse.set(m.course_id, list);
  });

  // Course completion
  const courseCompletion = new Map<string, boolean>();
  const courseStandingMap = new Map<string, ReturnType<typeof getStandingStatus>>();
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
    courseCompletion.set(course.id, status === "completed");
    courseStandingMap.set(course.id, status);
  });

  const completedCourseIds = new Set<string>();
  const inProgressCourseIds = new Set<string>();
  courseCompletion.forEach((isComplete, courseId) => {
    if (isComplete) completedCourseIds.add(courseId);
  });
  courseStandingMap.forEach((status, courseId) => {
    if (status === "in_progress") inProgressCourseIds.add(courseId);
  });

  // Identify research courses
  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));
  const blockMappings = (mappings ?? []).map((m) => ({
    requirement_block_id: m.requirement_block_id,
    course_id: m.course_id,
  }));

  const blockSummaries = summarizeRequirementBlocks({
    blocks: requirementBlocks ?? [],
    mappings: blockMappings,
    coursesById,
    completedCourseIds,
    inProgressCourseIds,
  });

  const researchBlocks = blockSummaries.filter((s) => s.block.category === "Research");
  const researchBlockIds = new Set(researchBlocks.map((s) => s.block.id));
  const researchCourseIds = new Set(
    blockMappings
      .filter((m) => researchBlockIds.has(m.requirement_block_id))
      .map((m) => m.course_id)
  );

  const researchCourses = (courses ?? [])
    .filter((c) => researchCourseIds.has(c.id))
    .sort((a, b) => (a.sequence_position ?? 0) - (b.sequence_position ?? 0));

  // Prerequisites per research course
  type PrereqInfo = { id: string; title: string; code: string | null };
  const prereqsByCourse = new Map<string, PrereqInfo[]>();
  (prereqRows ?? []).forEach((row) => {
    const prereq = row.prerequisite as PrereqInfo | null;
    if (!prereq) return;
    const list = prereqsByCourse.get(row.course_id) ?? [];
    list.push(prereq);
    prereqsByCourse.set(row.course_id, list);
  });

  // Readiness determination per research course
  const courseReadiness = researchCourses.map((course) => {
    const isComplete = courseCompletion.get(course.id) ?? false;
    const status = courseStandingMap.get(course.id) ?? "not_started";
    const prereqs = prereqsByCourse.get(course.id) ?? [];
    const unmetPrereqs = prereqs.filter((p) => !(courseCompletion.get(p.id) ?? false));
    const allPrereqsMet = unmetPrereqs.length === 0;

    let eligibility: "complete" | "eligible" | "nearing" | "not yet eligible";
    if (isComplete) {
      eligibility = "complete";
    } else if (prereqs.length === 0 || allPrereqsMet) {
      eligibility = "eligible";
    } else if (unmetPrereqs.length <= 1) {
      eligibility = "nearing";
    } else {
      eligibility = "not yet eligible";
    }

    return {
      ...course,
      status,
      isComplete,
      prereqs,
      unmetPrereqs,
      allPrereqsMet,
      eligibility,
    };
  });

  // Overall readiness
  const rsyn710 = courseReadiness.find((c) => c.code === "RSYN 710");
  const rsyn720 = courseReadiness.find((c) => c.code === "RSYN 720");

  let overallReadiness: string;
  if (rsyn720?.isComplete) {
    overallReadiness = "Research sequence complete";
  } else if (rsyn720?.eligibility === "eligible") {
    overallReadiness = "Eligible for terminal synthesis";
  } else if (rsyn710?.isComplete && rsyn720) {
    overallReadiness = "Method course complete — nearing thesis eligibility";
  } else if (rsyn710 && rsyn710.status === "in_progress") {
    overallReadiness = "Method course in progress";
  } else if (rsyn710?.eligibility === "eligible") {
    overallReadiness = "Eligible for method course";
  } else {
    overallReadiness = "Prerequisites incomplete";
  }

  const now = formatDate(new Date().toISOString());

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10 max-w-4xl print:max-w-none">

        {/* ─── Document header ─── */}
        <header className="space-y-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
            <Link href={`/programs/${program.id}/research`}>Research register</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {program.title} · Research Readiness Packet
          </p>
          <h1 className="text-3xl">Research Readiness</h1>
          <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{researchCourses.length} research courses</span>
            <span>{overallReadiness}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Generated {now}</p>
        </header>

        {/* ─── Research course sequence ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Research Course Sequence</h2>
          {courseReadiness.length ? (
            <div className="space-y-4">
              {courseReadiness.map((course) => (
                <div
                  key={course.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="font-semibold text-[var(--text)]">
                        {course.code ? `${course.code} — ` : ""}{course.title}
                      </p>
                      {course.level || course.credits_or_weight ? (
                        <p className="text-xs text-[var(--muted)]">
                          {[course.level, course.credits_or_weight ? `${course.credits_or_weight} credits` : null].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {getStandingLabel(course.status)}
                    </p>
                  </div>

                  {/* Prerequisites */}
                  {course.prereqs.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Prerequisites</p>
                      <div className="space-y-1">
                        {course.prereqs.map((prereq) => {
                          const met = courseCompletion.get(prereq.id) ?? false;
                          return (
                            <div
                              key={prereq.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span className={met ? "text-[var(--muted)]" : ""}>
                                {prereq.code ? `${prereq.code} — ` : ""}{prereq.title}
                              </span>
                              <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                {met ? "Complete" : "Incomplete"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--muted)]">No prerequisites.</p>
                  )}

                  {/* Eligibility */}
                  <div className="border-t border-[var(--border)] pt-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Eligibility: {
                        course.eligibility === "complete" ? "Course complete" :
                        course.eligibility === "eligible" ? "Eligible — prerequisites satisfied" :
                        course.eligibility === "nearing" ? `Nearing eligibility — ${course.unmetPrereqs.length} prerequisite remaining` :
                        `Not yet eligible — ${course.unmetPrereqs.length} prerequisites incomplete`
                      }
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No research courses are mapped to this program.
            </p>
          )}
        </section>

        {/* ─── Readiness determination ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Readiness Determination</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <p className="font-semibold text-[var(--text)]">{overallReadiness}</p>

            {rsyn710 ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  RSYN 710 — Method and Thesis Architecture
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {rsyn710.isComplete
                    ? "Complete. Methodological formation in theological research is satisfied."
                    : rsyn710.status === "in_progress"
                    ? "In progress. The student is currently engaged in methodological formation."
                    : rsyn710.eligibility === "eligible"
                    ? "Not yet started. Prerequisites are satisfied; the student may begin."
                    : `Not yet eligible. ${rsyn710.unmetPrereqs.length} prerequisite${rsyn710.unmetPrereqs.length === 1 ? " remains" : "s remain"} incomplete.`}
                </p>
              </div>
            ) : null}

            {rsyn720 ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  RSYN 720 — Senior Thesis / Integrated Synthesis
                </p>
                <p className="text-sm text-[var(--muted)]">
                  {rsyn720.isComplete
                    ? "Complete. The terminal synthesis project is finished."
                    : rsyn720.status === "in_progress"
                    ? "In progress. The terminal synthesis project is underway."
                    : rsyn720.eligibility === "eligible"
                    ? "Not yet started. Prerequisites are satisfied; the student may begin the thesis."
                    : rsyn720.eligibility === "nearing"
                    ? `Nearing eligibility. ${rsyn720.unmetPrereqs.map((p) => p.code ?? p.title).join(", ")} must be completed first.`
                    : `Not yet eligible. ${rsyn720.unmetPrereqs.map((p) => p.code ?? p.title).join(", ")} must be completed first.`}
                </p>
              </div>
            ) : null}

            {!rsyn710 && !rsyn720 ? (
              <p className="text-sm text-[var(--muted)]">
                No research synthesis courses (RSYN 710, RSYN 720) are recorded for this program.
              </p>
            ) : null}
          </div>
        </section>

        {/* ─── Document footer ─── */}
        <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <p>
            {program.title} · Research readiness packet · {overallReadiness} · Generated {now}
          </p>
        </footer>
      </div>
    </ProtectedShell>
  );
}
