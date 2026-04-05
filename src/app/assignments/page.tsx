import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildAssignmentStatusMap } from "@/lib/academic-standing";
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
    if (courseTitleA !== courseTitleB) {
      return courseTitleA.localeCompare(courseTitleB);
    }
    const moduleOrderA = moduleA?.position ?? 9999;
    const moduleOrderB = moduleB?.position ?? 9999;
    if (moduleOrderA !== moduleOrderB) return moduleOrderA - moduleOrderB;
    return (a.due_at ?? "").localeCompare(b.due_at ?? "");
  });

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Assignment Ledger
          </p>
          <h1 className="text-3xl font-semibold">Assignments</h1>
          <p className="text-sm text-[var(--muted)]">
            Submission status and official final-work tracking.
          </p>
        </header>

        <section className="space-y-4">
          {sortedAssignments.length ? (
            <div className="space-y-3">
              {sortedAssignments.map((assignment) => {
                const module = modulesById.get(assignment.module_id);
                const course = module ? coursesById.get(module.course_id) : null;
                const status = assignmentStatus.get(assignment.id);
                const statusLabel = status?.hasFinal
                  ? status.hasCritique
                    ? "Final · Critiqued"
                    : "Final · Critique pending (completion unaffected)"
                  : status?.hasDraft
                  ? "Draft · Not final"
                  : "No submission";

                return (
                  <div
                    key={assignment.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2"
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {course?.code ? `${course.code} — ` : ""}
                      {course?.title ?? "Course"}
                    </p>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">{assignment.title}</h2>
                        <p className="text-sm text-[var(--muted)]">
                          {module?.title ?? "Module"}
                        </p>
                      </div>
                      <div className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        {assignment.due_at ? formatDate(assignment.due_at) : "No deadline"}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      <span>{assignment.assignment_type.replace(/_/g, " ")}</span>
                      <span>{statusLabel}</span>
                      <Link href={`/assignments/${assignment.id}`}>View assignment</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No assignments found.
            </div>
          )}
        </section>
      </div>
    </ProtectedShell>
  );
}
