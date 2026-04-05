import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateAssignment } from "@/lib/actions";
import { ASSIGNMENT_TYPE_ALLOWED } from "@/lib/assignment-structure";
import { ProtectedShell } from "@/components/protected-shell";

const assignmentTypes = ASSIGNMENT_TYPE_ALLOWED;

export default async function EditAssignmentPage({
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

  const { data: assignment } = await supabase
    .from("assignments")
    .select(
      "id, title, instructions, assignment_type, due_at, module:modules(id, title, course:courses(title))"
    )
    .eq("id", id)
    .single();

  if (!assignment) {
    notFound();
  }

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Assignment Settings
          </p>
          <h1 className="text-3xl font-semibold">Edit Assignment</h1>
          <p className="text-sm text-[var(--muted)]">
            Assignments remain attached to their module. Update metadata and
            instructions.
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={updateAssignment} className="space-y-6">
          <input type="hidden" name="assignmentId" value={assignment.id} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Course
              </label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {assignment.module?.course?.title ?? "Course"}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Module
              </label>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--muted)]">
                {assignment.module?.title ?? "Module"}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Title
            </label>
            <input
              name="title"
              required
              defaultValue={assignment.title}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Assignment Type
            </label>
            <select
              name="assignmentType"
              defaultValue={assignment.assignment_type}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              {assignmentTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Instructions
            </label>
            <textarea
              name="instructions"
              rows={6}
              required
              defaultValue={assignment.instructions}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Due Date
            </label>
            <input
              type="datetime-local"
              name="dueAt"
              defaultValue={assignment.due_at ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save Changes
            </button>
            <Link
              href={`/assignments/${assignment.id}`}
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
