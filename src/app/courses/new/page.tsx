import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCourse } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

const courseStatuses = ["active", "inactive", "draft", "archived"];

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; programId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error, programId } = await searchParams;

  const { data: programs } = await supabase
    .from("programs")
    .select("id, title")
    .order("title");

  const { data: domains } = await supabase
    .from("domains")
    .select("id, title, code")
    .order("title");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code")
    .order("title");

  const defaultProgramId =
    programId ?? (programs?.length ? programs[0].id : "");

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-4xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Create
          </p>
          <h1 className="text-3xl font-semibold">New Course</h1>
          <p className="text-sm text-[var(--muted)]">
            Define the academic profile and placement of a course.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!programs?.length ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No programs exist yet. Create a program before adding courses.
            <div className="mt-3">
              <Link href="/programs/new" className="text-sm font-semibold">
                Create program
              </Link>
            </div>
          </div>
        ) : (
          <form action={createCourse} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Program
                </label>
                <select
                  name="programId"
                  defaultValue={defaultProgramId}
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Domain
                </label>
                <select
                  name="domainId"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  <option value="">No domain assigned</option>
                  {(domains ?? []).map((domain) => (
                    <option key={domain.id} value={domain.id}>
                      {domain.code ? `${domain.code} — ` : ""}{domain.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--muted)]">
                  Domains can be created in Academic Domains.
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Course Title
                </label>
                <input
                  name="title"
                  required
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Code
                </label>
                <input
                  name="code"
                  placeholder="THEO 601"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Department or Domain
                </label>
                <input
                  name="departmentOrDomain"
                  placeholder="Systematic Theology"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Level
                </label>
                <input
                  name="level"
                  placeholder="Graduate"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Credits or Weight
                </label>
                <input
                  name="creditsOrWeight"
                  type="number"
                  step="0.25"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Status
                </label>
                <select
                  name="status"
                  defaultValue="active"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  {courseStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Description
              </label>
              <textarea
                name="description"
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Learning Outcomes
              </label>
              <textarea
                name="learningOutcomes"
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Syllabus
              </label>
              <textarea
                name="syllabus"
                rows={6}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Prerequisites
              </p>
              {courses?.length ? (
                <div className="grid gap-2 md:grid-cols-2">
                  {courses.map((course) => (
                    <label
                      key={course.id}
                      className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        name="prerequisiteIds"
                        value={course.id}
                        className="h-4 w-4"
                      />
                      <span>
                        {course.code ? `${course.code} — ` : ""}
                        {course.title}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No other courses yet.</p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                Save Course
              </button>
              <Link href="/dashboard" className="text-sm text-[var(--muted)]">
                Cancel
              </Link>
              <Link href="/domains/new" className="text-sm text-[var(--muted)]">
                Create domain
              </Link>
            </div>
          </form>
        )}
      </div>
    </ProtectedShell>
  );
}
