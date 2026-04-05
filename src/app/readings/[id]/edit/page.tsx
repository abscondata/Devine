import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateReading } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

export default async function EditReadingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: reading } = await supabase
    .from("readings")
    .select(
      "id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, notes, position, module_id"
    )
    .eq("id", id)
    .single();

  if (!reading) {
    notFound();
  }

  const { data: module } = await supabase
    .from("modules")
    .select("id, title, course:courses(id, title)")
    .eq("id", reading.module_id)
    .single();

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Reading Settings
          </p>
          <h1 className="text-3xl font-semibold">Edit Reading</h1>
          <p className="text-sm text-[var(--muted)]">
            Readings remain attached to their module. Update metadata and position
            within the module sequence.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={updateReading} className="space-y-6">
          <input type="hidden" name="readingId" value={reading.id} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Course
              </label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {module?.course?.title ?? "Course"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Module
              </label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {module?.title ?? "Module"}
              </div>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Title
              </label>
              <input
                name="title"
                required
                defaultValue={reading.title}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Author
              </label>
              <input
                name="author"
                defaultValue={reading.author ?? ""}
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
                defaultValue={reading.source_type ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Primary or Secondary
              </label>
              <input
                name="primaryOrSecondary"
                defaultValue={reading.primary_or_secondary ?? ""}
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
                defaultValue={reading.tradition_or_era ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Pages or Length
              </label>
              <input
                name="pagesOrLength"
                defaultValue={reading.pages_or_length ?? ""}
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
                defaultValue={reading.estimated_hours ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Reading Position
              </label>
              <input
                name="position"
                type="number"
                min={0}
                required
                defaultValue={reading.position}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
              <p className="text-xs text-[var(--muted)]">
                Positions must remain unique inside this module.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Reference URL or Citation
            </label>
            <input
              name="reference"
              defaultValue={reading.reference_url_or_citation ?? ""}
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
              defaultValue={reading.notes ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save Changes
            </button>
            <Link
              href={`/modules/${module?.id ?? ""}`}
              className="text-sm text-[var(--muted)]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </ProtectedShell>
  );
}
