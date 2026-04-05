import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateModule } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

export default async function EditModulePage({
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

  const { data: moduleRecord } = await supabase
    .from("modules")
    .select("id, title, overview, position, course:courses(id, title)")
    .eq("id", id)
    .single();

  if (!moduleRecord) {
    notFound();
  }

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Module Settings
          </p>
          <h1 className="text-3xl font-semibold">Edit Module</h1>
          <p className="text-sm text-[var(--muted)]">
            Modules remain attached to their course. Update title, overview, and
            position within the sequence.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={updateModule} className="space-y-6">
          <input type="hidden" name="moduleId" value={moduleRecord.id} />

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Course
            </label>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
              {moduleRecord.course?.title ?? "Course"}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Module Title
            </label>
            <input
              name="title"
              required
              defaultValue={moduleRecord.title}
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
              defaultValue={moduleRecord.overview ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Module Position
            </label>
            <input
              name="position"
              type="number"
              min={0}
              required
              defaultValue={moduleRecord.position}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <p className="text-xs text-[var(--muted)]">
              Positions must remain unique inside this course.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save Changes
            </button>
            <Link href={`/modules/${moduleRecord.id}`} className="text-sm text-[var(--muted)]">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </ProtectedShell>
  );
}
