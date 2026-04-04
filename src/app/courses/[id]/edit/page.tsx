import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateCourse } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

const courseStatuses = ["active", "inactive", "draft", "archived"];

export default async function EditCoursePage({
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

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, description, code, department_or_domain, credits_or_weight, level, learning_outcomes, syllabus, status, program:programs(id, title), domain_id"
    )
    .eq("id", id)
    .single();

  if (!course) {
    notFound();
  }

  const { data: domains } = await supabase
    .from("domains")
    .select("id, title, code")
    .order("title");

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code")
    .order("title");

  const { data: prerequisites } = await supabase
    .from("course_prerequisites")
    .select("prerequisite_course_id")
    .eq("course_id", id);

  const selectedPrereqs = new Set(
    (prerequisites ?? []).map((item) => item.prerequisite_course_id)
  );

  const otherCourses = (courses ?? []).filter((item) => item.id !== course.id);

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-4xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Course Settings
          </p>
          <h1 className="text-3xl font-semibold">Edit Course</h1>
          <p className="text-sm text-[var(--muted)]">
            Update the academic profile, prerequisites, and syllabus details.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={updateCourse} className="space-y-8">
          <input type="hidden" name="courseId" value={course.id} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Program
              </label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {course.program?.title ?? "Program"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Domain
              </label>
              <select
                name="domainId"
                defaultValue={course.domain_id ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="">No domain assigned</option>
                {(domains ?? []).map((domain) => (
                  <option key={domain.id} value={domain.id}>
                    {domain.code ? `${domain.code} — ` : ""}{domain.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Course Title
              </label>
              <input
                name="title"
                required
                defaultValue={course.title}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Code
              </label>
              <input
                name="code"
                defaultValue={course.code ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Department or Domain
              </label>
              <input
                name="departmentOrDomain"
                defaultValue={course.department_or_domain ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Level
              </label>
              <input
                name="level"
                defaultValue={course.level ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Credits or Weight
              </label>
              <input
                name="creditsOrWeight"
                type="number"
                step="0.25"
                defaultValue={course.credits_or_weight ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Status
              </label>
              <select
                name="status"
                defaultValue={course.status}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {courseStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              defaultValue={course.description ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Learning Outcomes
            </label>
            <textarea
              name="learningOutcomes"
              rows={4}
              defaultValue={course.learning_outcomes ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Syllabus
            </label>
            <textarea
              name="syllabus"
              rows={6}
              defaultValue={course.syllabus ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Prerequisites
            </p>
            {otherCourses.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {otherCourses.map((courseItem) => (
                  <label
                    key={courseItem.id}
                    className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="prerequisiteIds"
                      value={courseItem.id}
                      defaultChecked={selectedPrereqs.has(courseItem.id)}
                      className="h-4 w-4"
                    />
                    <span>
                      {courseItem.code ? `${courseItem.code} — ` : ""}
                      {courseItem.title}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">No other courses yet.</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save Changes
            </button>
            <Link
              href={`/courses/${course.id}`}
              className="text-sm text-[var(--muted)]"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </ProtectedShell>
  );
}
