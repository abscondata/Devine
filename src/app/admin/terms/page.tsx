import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin-gate";
import {
  buildAssignmentStatusMap,
  buildReadinessByCourse,
  getCourseStanding,
  getStandingStatus,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import {
  createTerm,
  setCurrentTerm,
  addTermCourse,
  removeTermCourse,
  materializeSchedule,
} from "@/lib/actions";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  await requireAdminAccess(supabase, user.id);

  const { data: programs } = await supabase.from("programs").select("id, title").eq("owner_id", user.id).limit(1);
  const program = programs?.[0];
  if (!program) return <div className="p-10 text-sm text-[var(--muted)]">No program found.</div>;

  // All program courses
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight, sequence_position")
    .eq("program_id", program.id)
    .eq("is_active", true)
    .order("sequence_position", { ascending: true });
  const courseIds = (allCourses ?? []).map((c) => c.id);
  const coursesById = new Map((allCourses ?? []).map((c) => [c.id, c]));

  // Standing data for all courses
  const { data: allModules } = courseIds.length
    ? await supabase.from("modules").select("id, course_id").in("course_id", courseIds)
    : { data: [] };
  const moduleIds = (allModules ?? []).map((m) => m.id);

  const { data: allReadings } = moduleIds.length
    ? await supabase.from("readings").select("id, module_id, status").in("module_id", moduleIds)
    : { data: [] };
  const { data: allAssignments } = moduleIds.length
    ? await supabase.from("assignments").select("id, module_id").in("module_id", moduleIds)
    : { data: [] };

  const assignmentIds = (allAssignments ?? []).map((a) => a.id);
  const { data: allSubmissions } = assignmentIds.length
    ? await supabase.from("submissions").select("id, assignment_id, is_final").eq("user_id", user.id).in("assignment_id", assignmentIds)
    : { data: [] };
  const finalSubIds = (allSubmissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: allCritiques } = finalSubIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase.from("thesis_projects")
    .select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at")
    .eq("program_id", program.id);
  const tpIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = tpIds.length
    ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", tpIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(allSubmissions ?? [], allCritiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({
    projects: thesisProjects ?? [],
    milestones: thesisMilestones ?? [],
    finalSubmissionIds: new Set(finalSubIds),
  });

  type ReadingRow = NonNullable<typeof allReadings>[number];
  type AssignmentRow = NonNullable<typeof allAssignments>[number];
  const readingsByModule = new Map<string, ReadingRow[]>();
  (allReadings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AssignmentRow[]>();
  (allAssignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  // Per-course standing
  const courseStandings = new Map<string, { status: string; isComplete: boolean; blockers: string[] }>();
  (allCourses ?? []).forEach((course) => {
    const mods = (allModules ?? []).filter((m) => m.course_id === course.id);
    const thesisSummary = course.code === "RSYN 720" ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary() : null;
    const standing = getCourseStanding({ modules: mods, readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary });
    const status = getStandingStatus(standing.completion);
    const blockers: string[] = [];
    if (standing.completion.unreadReadings > 0) blockers.push(`${standing.completion.unreadReadings} unread readings`);
    if (standing.completion.missingFinals > 0) blockers.push(`${standing.completion.missingFinals} missing finals`);
    if (standing.completion.thesisIncomplete) blockers.push("Thesis incomplete");
    courseStandings.set(course.id, { status, isComplete: status === "completed", blockers });
  });

  // Prerequisite readiness
  const { data: prereqMappings } = courseIds.length
    ? await supabase.from("course_prerequisites").select("course_id, prerequisite:prerequisite_course_id(id, title, code)").in("course_id", courseIds)
    : { data: [] };
  const prereqsByCourse = new Map<string, { id: string; title: string; code: string | null }[]>();
  (prereqMappings ?? []).forEach((m) => {
    if (!m.prerequisite) return;
    const l = prereqsByCourse.get(m.course_id) ?? [];
    l.push(m.prerequisite);
    prereqsByCourse.set(m.course_id, l);
  });
  const completionByCourse = new Map<string, boolean>();
  courseStandings.forEach((s, id) => completionByCourse.set(id, s.isComplete));
  const readinessByCourse = buildReadinessByCourse({ courseIds, prereqsByCourse, completionByCourse });

  // Terms
  const { data: terms } = await supabase.from("academic_terms").select("id, title, starts_at, ends_at, is_current, created_at").eq("program_id", program.id).order("created_at", { ascending: false });
  const termIds = (terms ?? []).map((t) => t.id);
  const { data: allTermCourses } = termIds.length
    ? await supabase.from("term_courses").select("term_id, course_id").in("term_id", termIds)
    : { data: [] };

  const { data: scheduleCountRows } = termIds.length
    ? await supabase.from("term_assignment_schedule").select("term_id").in("term_id", termIds)
    : { data: [] };
  const scheduleCountByTerm = new Map<string, number>();
  (scheduleCountRows ?? []).forEach((r) => scheduleCountByTerm.set(r.term_id, (scheduleCountByTerm.get(r.term_id) ?? 0) + 1));

  const { data: revisedRows } = termIds.length
    ? await supabase.from("term_assignment_schedule").select("term_id, revised_at").in("term_id", termIds).not("revised_at", "is", null)
    : { data: [] };
  const revisedCountByTerm = new Map<string, number>();
  (revisedRows ?? []).forEach((r) => revisedCountByTerm.set(r.term_id, (revisedCountByTerm.get(r.term_id) ?? 0) + 1));

  // Courses already assigned to any term
  const assignedCourseIds = new Set((allTermCourses ?? []).map((tc) => tc.course_id));

  // Next-course recommendations: prerequisite-valid, not complete, not assigned
  const nextCourses = (allCourses ?? []).filter((c) => {
    if (courseStandings.get(c.id)?.isComplete) return false;
    if (assignedCourseIds.has(c.id)) return false;
    const r = readinessByCourse.get(c.id);
    return r?.status === "ready";
  });

  // Thesis eligibility check
  const rsyn710 = (allCourses ?? []).find((c) => c.code === "RSYN 710");
  const rsyn720 = (allCourses ?? []).find((c) => c.code === "RSYN 720");
  const rsyn710Ready = rsyn710 ? readinessByCourse.get(rsyn710.id)?.status === "ready" || courseStandings.get(rsyn710.id)?.isComplete : false;
  const rsyn710Complete = rsyn710 ? courseStandings.get(rsyn710.id)?.isComplete : false;
  const rsyn720Ready = rsyn720 ? readinessByCourse.get(rsyn720.id)?.status === "ready" || courseStandings.get(rsyn720.id)?.isComplete : false;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{program.title}</p>
        <h1 className="text-3xl">Term Governance</h1>
      </header>

      {error ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>
      ) : null}

      {/* ─── Create term ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Create Term</h2>
        <form action={createTerm} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <input type="hidden" name="programId" value={program.id} />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Title</label>
              <input name="title" required className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Start</label>
              <input name="startsAt" type="date" className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">End</label>
              <input name="endsAt" type="date" className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <input type="checkbox" name="makeCurrent" className="h-4 w-4 rounded border border-[var(--border)]" />
            Set as current term
          </label>
          <button type="submit" className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white">Create term</button>
        </form>
      </section>

      {/* ─── Terms ─── */}
      {(terms ?? []).map((term) => {
        const termCourses = (allTermCourses ?? []).filter((tc) => tc.term_id === term.id);
        const termAssignedIds = new Set(termCourses.map((tc) => tc.course_id));
        const available = (allCourses ?? []).filter((c) => !termAssignedIds.has(c.id));
        const schedCount = scheduleCountByTerm.get(term.id) ?? 0;
        const revisedCount = revisedCountByTerm.get(term.id) ?? 0;

        const termCourseDetails = termCourses.map((tc) => {
          const course = coursesById.get(tc.course_id);
          const standing = courseStandings.get(tc.course_id);
          return { courseId: tc.course_id, course, standing };
        });
        const allTermCoursesComplete = termCourseDetails.every((d) => d.standing?.isComplete);
        const incompleteCount = termCourseDetails.filter((d) => !d.standing?.isComplete).length;

        return (
          <section key={term.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-lg">{term.title}</h2>
                <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{formatDate(term.starts_at)} – {formatDate(term.ends_at)}</span>
                  <span>{term.is_current ? "Current" : "Inactive"}</span>
                  <span>{termCourses.length} courses</span>
                  {schedCount > 0 ? <span>{schedCount} deadlines</span> : null}
                  {revisedCount > 0 ? <span>{revisedCount} revised</span> : null}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {!term.is_current ? (
                  <form action={setCurrentTerm}>
                    <input type="hidden" name="termId" value={term.id} />
                    <input type="hidden" name="programId" value={program.id} />
                    <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">Set current</button>
                  </form>
                ) : null}
                <form action={materializeSchedule}>
                  <input type="hidden" name="termId" value={term.id} />
                  <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                    {schedCount > 0 ? "Refresh schedule" : "Materialize"}
                  </button>
                </form>
              </div>
            </div>

            {/* Course load with standing */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {termCourseDetails.map(({ courseId, course, standing }) => (
                <div key={courseId} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold">{course?.code ? `${course.code} — ` : ""}{course?.title ?? courseId}</p>
                    {standing && !standing.isComplete && standing.blockers.length > 0 ? (
                      <p className="text-xs text-[var(--muted)]">{standing.blockers.join(" · ")}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {standing?.isComplete ? "Complete" : standing?.status === "in_progress" ? "In progress" : "Not started"}
                    </p>
                    <form action={removeTermCourse}>
                      <input type="hidden" name="termId" value={term.id} />
                      <input type="hidden" name="courseId" value={courseId} />
                      <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">Remove</button>
                    </form>
                  </div>
                </div>
              ))}
              {!termCourses.length ? <div className="px-5 py-3 text-sm text-[var(--muted)]">No courses assigned.</div> : null}
            </div>

            {/* Closeout status */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Term closeout</p>
              {termCourses.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">No courses assigned.</p>
              ) : allTermCoursesComplete ? (
                <p className="text-sm font-semibold text-[var(--text)]">All term courses complete. Ready to close.</p>
              ) : (
                <p className="text-sm text-[var(--muted)]">{incompleteCount} course{incompleteCount === 1 ? "" : "s"} incomplete.</p>
              )}
            </div>

            {/* Add course */}
            {available.length > 0 ? (
              <form action={addTermCourse} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="termId" value={term.id} />
                <select name="courseId" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                  {available.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.title}</option>
                  ))}
                </select>
                <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">Add course</button>
              </form>
            ) : null}
          </section>
        );
      })}

      {/* ─── Next-course recommendations ─── */}
      {nextCourses.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg">Recommended Next Courses</h2>
          <p className="text-xs text-[var(--muted)]">Prerequisites satisfied, not yet assigned to any term.</p>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
            {nextCourses.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="text-sm">{c.code ? `${c.code} — ` : ""}{c.title}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{c.credits_or_weight} credits</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* ─── Research / thesis eligibility ─── */}
      {rsyn710 || rsyn720 ? (
        <section className="space-y-3">
          <h2 className="text-lg">Research &amp; Thesis Eligibility</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]">
            {rsyn710 ? (
              <p>
                <span className="font-semibold text-[var(--text)]">RSYN 710</span> (Research Method):
                {" "}{courseStandings.get(rsyn710.id)?.isComplete ? "Complete" : rsyn710Ready ? "Prerequisites satisfied — eligible" : "Prerequisites pending"}
              </p>
            ) : null}
            {rsyn720 ? (
              <p>
                <span className="font-semibold text-[var(--text)]">RSYN 720</span> (Senior Thesis):
                {" "}{courseStandings.get(rsyn720.id)?.isComplete ? "Complete" : rsyn720Ready && rsyn710Complete ? "Prerequisites satisfied — eligible" : rsyn710Complete ? "RSYN 710 complete, awaiting other prerequisites" : "Not yet eligible"}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
