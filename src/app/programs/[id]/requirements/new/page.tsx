import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createRequirementBlock } from "@/lib/actions";
import { requireAdminAccess } from "@/lib/admin-gate";
import { AdminShell } from "@/components/admin-shell";

export default async function NewRequirementBlockPage({
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

  await requireAdminAccess(supabase, user.id);

  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  return (
    <AdminShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <Link
            href={`/programs/${program.id}/audit`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            Program Audit
          </Link>
          <h1 className="text-3xl font-semibold">New Requirement Block</h1>
          <p className="text-sm text-[var(--muted)]">
            Define a block of requirements for {program.title}.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={createRequirementBlock} className="space-y-6">
          <input type="hidden" name="programId" value={program.id} />

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
              Category
            </label>
            <input
              name="category"
              placeholder="Core, electives, language"
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
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
                Minimum Courses Required
              </label>
              <input
                name="minimumCoursesRequired"
                type="number"
                min="0"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Minimum Credits Required
              </label>
              <input
                name="minimumCreditsRequired"
                type="number"
                min="0"
                step="0.5"
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Provide at least one minimum: courses or credits.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save requirement block
            </button>
            <Link
              href={`/programs/${program.id}/audit`}
              className="text-sm text-[var(--muted)]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </AdminShell>
  );
}
