import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAssignment } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

const assignmentTypes = [
  "general",
  "essay",
  "analysis",
  "exegesis",
  "translation",
  "problem_set",
  "presentation",
  "other",
];

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; moduleId?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error, moduleId } = await searchParams;

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, course:courses(title)")
    .order("title");

  const defaultModuleId = moduleId ?? (modules?.length ? modules[0].id : "");

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Create
          </p>
          <h1 className="text-3xl font-semibold">New Assignment</h1>
          <p className="text-sm text-[var(--muted)]">
            Assignments are the core deliverables for each module.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!modules?.length ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No modules exist yet. Create a module before adding assignments.
            <div className="mt-3">
              <Link href="/modules/new" className="text-sm font-semibold">
                Create module
              </Link>
            </div>
          </div>
        ) : (
          <form action={createAssignment} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Module
              </label>
              <select
                name="moduleId"
                defaultValue={defaultModuleId}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.title}
                    {module.course?.title ? ` (${module.course.title})` : ""}
                  </option>
                ))}
              </select>
            </div>

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
                Assignment Type
              </label>
              <select
                name="assignmentType"
                defaultValue="general"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {assignmentTypes.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Instructions
              </label>
              <textarea
                name="instructions"
                rows={6}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Due Date
              </label>
              <input
                type="datetime-local"
                name="dueAt"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                Save Assignment
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
