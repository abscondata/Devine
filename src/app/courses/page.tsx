import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

const levelOrder = ["Foundational", "Intermediate", "Advanced"];
const levelDescriptions: Record<string, string> = {
  Foundational:
    "The foundations sequence establishes philosophical method, fundamental theology, early Church history, and Scripture for the entire curriculum.",
  Intermediate:
    "Patristic, conciliar, ecclesial, and sacramental consolidation building on the foundations.",
  Advanced:
    "Specialized study in dogmatic theology, moral theology, spiritual theology, advanced Scripture and history, philosophy, and the research synthesis.",
};

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
      "id, title, code, description, level, department_or_domain, sequence_position, program:programs(id, title)"
    )
    .eq("is_active", true)
    .order("sequence_position", { ascending: true });

  const grouped = new Map<string, typeof courses>();
  (courses ?? []).forEach((course) => {
    const level = course.level ?? "Other";
    const list = grouped.get(level) ?? [];
    list.push(course);
    grouped.set(level, list);
  });

  const orderedLevels = [
    ...levelOrder.filter((level) => grouped.has(level)),
    ...Array.from(grouped.keys()).filter((level) => !levelOrder.includes(level)),
  ];

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Devine College Core
          </p>
          <h1 className="text-3xl">Curriculum</h1>
          <p className="text-sm text-[var(--muted)]">
            {(courses ?? []).length} courses across the full program of study.
          </p>
        </header>

        {orderedLevels.map((level) => {
          const levelCourses = grouped.get(level) ?? [];
          const description = levelDescriptions[level] ?? "";

          return (
            <section key={level} className="space-y-4">
              <div className="space-y-1">
                <h2 className="text-xl">{level}</h2>
                {description ? (
                  <p className="text-sm text-[var(--muted)]">{description}</p>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {levelCourses.map((course) => (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="block p-5 transition hover:bg-[var(--surface-muted)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold">
                          {course.code ? `${course.code} — ` : ""}
                          {course.title}
                        </h3>
                        <p className="text-sm text-[var(--muted)]">
                          {course.description ?? ""}
                        </p>
                      </div>
                      {course.department_or_domain ? (
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                          {course.department_or_domain}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </ProtectedShell>
  );
}
