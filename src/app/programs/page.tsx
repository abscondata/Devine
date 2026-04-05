import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: programs } = await supabase
    .from("programs")
    .select("id, title, description, is_active")
    .order("created_at", { ascending: true });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Academic Programs
          </p>
          <h1 className="text-3xl font-semibold">Programs</h1>
          <p className="text-sm text-[var(--muted)]">
            Manage program structures and audit requirements.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Programs</h2>
            <Link
              href="/programs/new"
              className="text-sm text-[var(--muted)]"
            >
              New program
            </Link>
          </div>

          {programs?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {programs.map((program) => (
                <div
                  key={program.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {program.is_active ? "Active" : "Inactive"}
                    </p>
                    <h3 className="text-lg font-semibold">{program.title}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {program.description ?? "No description provided."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <Link href={`/programs/${program.id}/audit`}>
                      Audit requirements
                    </Link>
                    <Link href={`/programs/${program.id}/record`}>
                      Academic record
                    </Link>
                    <Link href={`/programs/${program.id}/requirements/new`}>
                      Add requirement block
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No programs yet. Create a program to begin structuring requirements.
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Administration</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            <p>
              Institutional governance tools for thesis administration and review
              access.
            </p>
            <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <Link href="/admin/thesis">Thesis governance</Link>
              <Link href="/admin/review-links">Review access</Link>
            </div>
          </div>
        </section>
      </div>
    </ProtectedShell>
  );
}
