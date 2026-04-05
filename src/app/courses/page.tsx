import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

export default async function CoursesIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: courses } = await supabase
    .from("courses")
    .select(
      "id, title, code, description, sequence_position, program:programs(id, title)"
    )
    .eq("is_active", true)
    .order("sequence_position", { ascending: true });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Course Catalog
          </p>
          <h1 className="text-3xl font-semibold">Courses</h1>
          <p className="text-sm text-[var(--muted)]">
            Formal course list and dossier access.
          </p>
        </header>

        <section className="space-y-4">
          {courses?.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3"
                >
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {course.program?.title ?? "Program"}
                    </p>
                    <h2 className="text-lg font-semibold">
                      {course.code ? `${course.code} — ` : ""}
                      {course.title}
                    </h2>
                    <p className="text-sm text-[var(--muted)]">
                      {course.description ?? "No description provided."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    <Link href={`/courses/${course.id}`}>Course page</Link>
                    <Link href={`/courses/${course.id}/dossier`}>Course dossier</Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No active courses found.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
