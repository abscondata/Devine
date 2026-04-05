import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAssignmentStatusMap } from "@/lib/academic-standing";
import { ProtectedShell } from "@/components/protected-shell";

export default async function AssignmentsIndexPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: assignments } = await supabase
    .from("assignments")
    .select("id, title, assignment_type, due_at, module_id")
    .order("due_at", { ascending: true });

  const assignmentIds = assignments?.map((assignment) => assignment.id) ?? [];

  const { data: submissions } = assignmentIds.length
    ? await supabase
        .from("submissions")
        .select("id, assignment_id, is_final")
        .eq("user_id", user.id)
        .in("assignment_id", assignmentIds)
    : { data: [] };

  const finalSubmissions = (submissions ?? []).filter((submission) => submission.is_final);
  const finalSubmissionIds = finalSubmissions.map((submission) => submission.id);

  const { data: critiques } = finalSubmissionIds.length
    ? await supabase
        .from("critiques")
        .select("id, submission_id")
        .in("submission_id", finalSubmissionIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);

  const moduleIds = Array.from(
    new Set((assignments ?? []).map((assignment) => assignment.module_id))
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

  // Sort by course sequence, then module position, then due date
  const sortedAssignments = (assignments ?? []).slice().sort((a, b) => {
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
    return (a.due_at ?? "").localeCompare(b.due_at ?? "");
  });

  // Group by course
  const assignmentsByCourse = new Map<
    string,
    { course: NonNullable<typeof courses>[number]; assignments: typeof sortedAssignments }
  >();

  sortedAssignments.forEach((assignment) => {
    const module = modulesById.get(assignment.module_id);
    const course = module ? coursesById.get(module.course_id) : null;
    if (!course) return;
    const existing = assignmentsByCourse.get(course.id);
    if (existing) {
      existing.assignments.push(assignment);
    } else {
      assignmentsByCourse.set(course.id, { course, assignments: [assignment] });
    }
  });

  const orderedCourseGroups = Array.from(assignmentsByCourse.values()).sort(
    (a, b) => (a.course.sequence_position ?? 9999) - (b.course.sequence_position ?? 9999)
  );

  const totalAssignments = sortedAssignments.length;
  const finalCount = sortedAssignments.filter((a) => assignmentStatus.get(a.id)?.hasFinal).length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Work Record
          </p>
          <h1 className="text-3xl">Written Work</h1>
          <p className="text-sm text-[var(--muted)]">
            {totalAssignments} assignments across the curriculum{finalCount > 0 ? ` · ${finalCount} finalized` : ""}.
          </p>
        </header>

        {orderedCourseGroups.length ? (
          orderedCourseGroups.map(({ course, assignments: courseAssignments }) => (
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
                {courseAssignments.map((assignment) => {
                  const module = modulesById.get(assignment.module_id);
                  const status = assignmentStatus.get(assignment.id);
                  const statusLabel = status?.hasFinal
                    ? status.hasCritique
                      ? "Final · Critiqued"
                      : "Final"
                    : status?.hasDraft
                    ? "Draft"
                    : "Not submitted";

                  return (
                    <Link
                      key={assignment.id}
                      href={`/assignments/${assignment.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 transition hover:bg-[var(--surface-muted)]"
                    >
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold">{assignment.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {[
                            module?.title,
                            assignment.assignment_type.replace(/_/g, " "),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                        {statusLabel}
                      </p>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">
            No assignments have been assigned.
          </p>
        )}
      </div>
    </ProtectedShell>
  );
}
