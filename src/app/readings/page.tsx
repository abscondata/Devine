import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

export default async function ReadingsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: readings } = await supabase
    .from("readings")
    .select("id, module_id, title, status, position")
    .order("position", { ascending: true });

  const moduleIds = Array.from(
    new Set((readings ?? []).map((reading) => reading.module_id))
  );

  const { data: modules } = moduleIds.length
    ? await supabase
        .from("modules")
        .select("id, title, position, course_id")
        .in("id", moduleIds)
    : { data: [] };

  const courseIds = Array.from(
    new Set((modules ?? []).map((module) => module.course_id))
  );

  const { data: courses } = courseIds.length
    ? await supabase
        .from("courses")
        .select("id, title, code, sequence_position")
        .in("id", courseIds)
    : { data: [] };

  const modulesById = new Map(
    (modules ?? []).map((module) => [module.id, module])
  );
  const coursesById = new Map(
    (courses ?? []).map((course) => [course.id, course])
  );

  const sortedReadings = (readings ?? []).slice().sort((a, b) => {
    const moduleA = modulesById.get(a.module_id);
    const moduleB = modulesById.get(b.module_id);
    const courseA = moduleA ? coursesById.get(moduleA.course_id) : null;
    const courseB = moduleB ? coursesById.get(moduleB.course_id) : null;
    const courseOrderA = courseA?.sequence_position ?? 9999;
    const courseOrderB = courseB?.sequence_position ?? 9999;
    if (courseOrderA !== courseOrderB) return courseOrderA - courseOrderB;
    const courseTitleA = courseA?.title ?? "";
    const courseTitleB = courseB?.title ?? "";
    if (courseTitleA !== courseTitleB) {
      return courseTitleA.localeCompare(courseTitleB);
    }
    const moduleOrderA = moduleA?.position ?? 9999;
    const moduleOrderB = moduleB?.position ?? 9999;
    if (moduleOrderA !== moduleOrderB) return moduleOrderA - moduleOrderB;
    return (a.position ?? 0) - (b.position ?? 0);
  });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Reading Ledger
          </p>
          <h1 className="text-3xl font-semibold">Readings</h1>
          <p className="text-sm text-[var(--muted)]">
            Canonical reading list and completion status.
          </p>
        </header>

        <section className="space-y-4">
          {sortedReadings.length ? (
            <div className="space-y-3">
              {sortedReadings.map((reading) => {
                const module = modulesById.get(reading.module_id);
                const course = module ? coursesById.get(module.course_id) : null;

                return (
                  <div
                    key={reading.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {course?.code ? `${course.code} — ` : ""}
                      {course?.title ?? "Course"}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{reading.title}</h2>
                        <p className="text-sm text-[var(--muted)]">
                          {module?.title ?? "Module"} · Reading {reading.position + 1}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Status {reading.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    {module?.id ? (
                      <Link
                        href={`/modules/${module.id}`}
                        className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                      >
                        View module
                      </Link>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No readings found.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
