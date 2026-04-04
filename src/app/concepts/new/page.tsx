import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createConcept } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

const conceptTypes = [
  "term",
  "thinker",
  "council",
  "doctrine",
  "debate",
  "distinction",
  "other",
];

const conceptStatuses = ["active", "draft", "archived"];

export default async function NewConceptPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await searchParams;

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code")
    .order("title");

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, course:courses(title)")
    .order("title");

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-4xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Concept Mastery
          </p>
          <h1 className="text-3xl font-semibold">New Concept</h1>
          <p className="text-sm text-[var(--muted)]">
            Track doctrinal and historical concepts alongside coursework.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={createConcept} className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Title
              </label>
              <input
                name="title"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Type
              </label>
              <select
                name="type"
                defaultValue="term"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {conceptTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
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

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Related Course
              </label>
              <select
                name="relatedCourseId"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">No course</option>
                {(courses ?? []).map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.code ? `${course.code} — ` : ""}{course.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Related Module
              </label>
              <select
                name="relatedModuleId"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">No module</option>
                {(modules ?? []).map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                    {module.course?.title ? ` (${module.course.title})` : ""}
                  </option>
                ))}
              </select>
            </div>
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
              {conceptStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save Concept
            </button>
            <Link href="/dashboard" className="text-sm text-[var(--muted)]">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </ProtectedShell>
  );
}
