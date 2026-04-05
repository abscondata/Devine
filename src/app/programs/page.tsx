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
            Program standing, constitutional requirements, and formal records.
          </p>
        </header>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">All Programs</h2>
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
                      Program standing
                    </Link>
                    <Link href={`/programs/${program.id}/record`}>
                      Academic record
                    </Link>
                    <Link href={`/programs/${program.id}/charter`}>
                      Program charter
                    </Link>
                    <Link href={`/programs/${program.id}/work`}>
                      Work record
                    </Link>
                    <Link href={`/programs/${program.id}/research`}>
                      Research register
                    </Link>
                    <Link href={`/programs/${program.id}/chronology`}>
                      Chronology
                    </Link>
                    <Link href={`/programs/${program.id}/review`}>
                      Review packet
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

      </div>
    </ProtectedShell>
  );
}
