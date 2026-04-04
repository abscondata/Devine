import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createModule } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

export default async function NewModulePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; courseId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error, courseId } = await searchParams;

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, program:programs(title)")
    .order("title");

  const defaultCourseId = courseId ?? (courses?.length ? courses[0].id : "");

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Create
          </p>
          <h1 className="text-3xl font-semibold">New Module</h1>
          <p className="text-sm text-[var(--muted)]">
            Modules structure each course into ordered units.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!courses?.length ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No courses exist yet. Create a course before adding modules.
            <div className="mt-3">
              <Link href="/courses/new" className="text-sm font-semibold">
                Create course
              </Link>
            </div>
          </div>
        ) : (
          <form action={createModule} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Course
              </label>
              <select
                name="courseId"
                defaultValue={defaultCourseId}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                    {course.program?.title ? ` (${course.program.title})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Module Title
              </label>
              <input
                name="title"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Overview
              </label>
              <textarea
                name="overview"
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                Save Module
              </button>
              <Link
                href="/dashboard"
                className="text-sm text-[var(--muted)]"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </ProtectedShell>
  );
}
