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
    .select("id, module_id, title, author, status, position")
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

  // Group readings by course
  type ReadingRow = NonNullable<typeof readings>[number];
  type CourseRow = NonNullable<typeof courses>[number];
  const readingsByCourse = new Map<
    string,
    { course: CourseRow; readings: ReadingRow[] }
  >();

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
    if (courseTitleA !== courseTitleB) return courseTitleA.localeCompare(courseTitleB);
    const moduleOrderA = moduleA?.position ?? 9999;
    const moduleOrderB = moduleB?.position ?? 9999;
    if (moduleOrderA !== moduleOrderB) return moduleOrderA - moduleOrderB;
    return (a.position ?? 0) - (b.position ?? 0);
  });

  sortedReadings.forEach((reading) => {
    const module = modulesById.get(reading.module_id);
    const course = module ? coursesById.get(module.course_id) : null;
    if (!course) return;
    const existing = readingsByCourse.get(course.id);
    if (existing) {
      existing.readings.push(reading);
    } else {
      readingsByCourse.set(course.id, { course, readings: [reading] });
    }
  });

  // Order course groups by sequence_position
  const orderedCourseGroups = Array.from(readingsByCourse.values()).sort(
    (a, b) => (a.course.sequence_position ?? 9999) - (b.course.sequence_position ?? 9999)
  );

  const totalReadings = sortedReadings.length;
  const completeReadings = sortedReadings.filter((r) => r.status === "complete").length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Reading Record
          </p>
          <h1 className="text-3xl">Assigned Readings</h1>
          <p className="text-sm text-[var(--muted)]">
            {totalReadings} readings across the curriculum{completeReadings > 0 ? ` · ${completeReadings} complete` : ""}.
          </p>
        </header>

        {orderedCourseGroups.length ? (
          orderedCourseGroups.map(({ course, readings: courseReadings }) => (
            <section key={course.id} className="space-y-3">
              <div className="space-y-1">
                <Link
                  href={`/courses/${course.id}`}
                  className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] hover:text-[var(--text)]"
                >
                  {course.code ?? ""}
                </Link>
                <h2 className="text-lg">{course.title}</h2>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
                {courseReadings.map((reading) => {
                  const module = modulesById.get(reading.module_id);
                  return (
                    <div
                      key={reading.id}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">{reading.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {[reading.author, module?.title].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                        {reading.status === "complete" ? "Complete" : reading.status.replace(/_/g, " ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No readings have been assigned.
          </p>
        )}
      </div>
    </ProtectedShell>
  );
}
