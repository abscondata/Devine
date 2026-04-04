import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createReading } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

const readingStatuses = [
  "not_started",
  "in_progress",
  "complete",
  "skipped",
];

export default async function NewReadingPage({
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
          <h1 className="text-3xl font-semibold">New Reading</h1>
          <p className="text-sm text-[var(--muted)]">
            Capture the reading list that anchors module study.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        {!modules?.length ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No modules exist yet. Create a module before adding readings.
            <div className="mt-3">
              <Link href="/modules/new" className="text-sm font-semibold">
                Create module
              </Link>
            </div>
          </div>
        ) : (
          <form action={createReading} className="space-y-6">
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
                  Author
                </label>
                <input
                  name="author"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Source Type
                </label>
                <input
                  name="sourceType"
                  placeholder="Book, journal, lecture, archive"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Primary or Secondary
                </label>
                <input
                  name="primaryOrSecondary"
                  placeholder="Primary or secondary"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Tradition or Era
                </label>
                <input
                  name="traditionOrEra"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Pages or Length
                </label>
                <input
                  name="pagesOrLength"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Estimated Hours
                </label>
                <input
                  name="estimatedHours"
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
                  defaultValue="not_started"
                  className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  {readingStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Reference URL or Citation
              </label>
              <input
                name="reference"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Notes
              </label>
              <textarea
                name="notes"
                rows={4}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
              >
                Save Reading
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
