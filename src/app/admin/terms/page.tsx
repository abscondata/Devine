import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdminAccess } from "@/lib/admin-gate";
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

  // Program
  const { data: programs } = await supabase.from("programs").select("id, title").eq("owner_id", user.id).limit(1);
  const program = programs?.[0];
  if (!program) {
    return <div className="p-10 text-sm text-[var(--muted)]">No program found.</div>;
  }

  // All terms
  const { data: terms } = await supabase
    .from("academic_terms")
    .select("id, title, starts_at, ends_at, is_current, created_at")
    .eq("program_id", program.id)
    .order("created_at", { ascending: false });

  // Term courses for each term
  const termIds = (terms ?? []).map((t) => t.id);
  const { data: allTermCourses } = termIds.length
    ? await supabase.from("term_courses").select("term_id, course_id").in("term_id", termIds)
    : { data: [] };

  // All program courses for the add-course form
  const { data: allCourses } = await supabase
    .from("courses")
    .select("id, title, code")
    .eq("program_id", program.id)
    .eq("is_active", true)
    .order("sequence_position", { ascending: true });

  const coursesById = new Map((allCourses ?? []).map((c) => [c.id, c]));

  // Schedule row counts per term
  const { data: scheduleCountRows } = termIds.length
    ? await supabase.from("term_assignment_schedule").select("term_id").in("term_id", termIds)
    : { data: [] };
  const scheduleCountByTerm = new Map<string, number>();
  (scheduleCountRows ?? []).forEach((r) => scheduleCountByTerm.set(r.term_id, (scheduleCountByTerm.get(r.term_id) ?? 0) + 1));

  // Revised count per term
  const { data: revisedRows } = termIds.length
    ? await supabase.from("term_assignment_schedule").select("term_id, revised_at").in("term_id", termIds).not("revised_at", "is", null)
    : { data: [] };
  const revisedCountByTerm = new Map<string, number>();
  (revisedRows ?? []).forEach((r) => revisedCountByTerm.set(r.term_id, (revisedCountByTerm.get(r.term_id) ?? 0) + 1));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{program.title}</p>
        <h1 className="text-3xl">Term Governance</h1>
      </header>

      {error ? (
        <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* ─── Create term ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Create Term</h2>
        <form action={createTerm} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <input type="hidden" name="programId" value={program.id} />
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Title</label>
              <input name="title" required className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" placeholder="Term 2" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Start date</label>
              <input name="startsAt" type="date" className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">End date</label>
              <input name="endsAt" type="date" className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <input type="checkbox" name="makeCurrent" className="h-4 w-4 rounded border border-[var(--border)]" />
            Set as current term
          </label>
          <button type="submit" className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white">
            Create term
          </button>
        </form>
      </section>

      {/* ─── Existing terms ─── */}
      {(terms ?? []).map((term) => {
        const termCourses = (allTermCourses ?? []).filter((tc) => tc.term_id === term.id);
        const assignedCourseIds = new Set(termCourses.map((tc) => tc.course_id));
        const availableCourses = (allCourses ?? []).filter((c) => !assignedCourseIds.has(c.id));
        const schedCount = scheduleCountByTerm.get(term.id) ?? 0;
        const revisedCount = revisedCountByTerm.get(term.id) ?? 0;

        return (
          <section key={term.id} className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-0.5">
                <h2 className="text-lg">{term.title}</h2>
                <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  <span>{formatDate(term.starts_at)} – {formatDate(term.ends_at)}</span>
                  <span>{term.is_current ? "Current" : "Inactive"}</span>
                  <span>{termCourses.length} courses</span>
                  <span>{schedCount} schedule rows</span>
                  {revisedCount > 0 ? <span>{revisedCount} revised</span> : null}
                </div>
              </div>
              {!term.is_current ? (
                <form action={setCurrentTerm}>
                  <input type="hidden" name="termId" value={term.id} />
                  <input type="hidden" name="programId" value={program.id} />
                  <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                    Set current
                  </button>
                </form>
              ) : null}
            </div>

            {/* Course load */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {termCourses.map((tc) => {
                const course = coursesById.get(tc.course_id);
                return (
                  <div key={tc.course_id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <p className="text-sm">{course?.code ? `${course.code} — ` : ""}{course?.title ?? tc.course_id}</p>
                    <form action={removeTermCourse}>
                      <input type="hidden" name="termId" value={term.id} />
                      <input type="hidden" name="courseId" value={tc.course_id} />
                      <button type="submit" className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)]">
                        Remove
                      </button>
                    </form>
                  </div>
                );
              })}
              {!termCourses.length ? (
                <div className="px-5 py-3 text-sm text-[var(--muted)]">No courses assigned.</div>
              ) : null}
            </div>

            {/* Add course */}
            {availableCourses.length > 0 ? (
              <form action={addTermCourse} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="termId" value={term.id} />
                <select name="courseId" className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
                  {availableCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.code ? `${c.code} — ` : ""}{c.title}</option>
                  ))}
                </select>
                <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                  Add course
                </button>
              </form>
            ) : null}

            {/* Materialize schedule */}
            <div className="flex flex-wrap items-center gap-3">
              <form action={materializeSchedule}>
                <input type="hidden" name="termId" value={term.id} />
                <button type="submit" className="rounded border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
                  {schedCount > 0 ? "Refresh schedule (new assignments only)" : "Materialize schedule"}
                </button>
              </form>
              {schedCount > 0 ? (
                <p className="text-xs text-[var(--muted)]">
                  {schedCount} deadlines materialized{revisedCount > 0 ? `, ${revisedCount} revised` : ""}
                </p>
              ) : null}
            </div>
          </section>
        );
      })}
    </div>
  );
}
