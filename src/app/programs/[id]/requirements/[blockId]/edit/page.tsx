import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateRequirementBlock } from "@/lib/actions";
import { ProtectedShell } from "@/components/protected-shell";

export default async function EditRequirementBlockPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; blockId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, blockId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, title")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  const { data: block } = await supabase
    .from("requirement_blocks")
    .select(
      "id, title, description, category, minimum_courses_required, minimum_credits_required"
    )
    .eq("id", blockId)
    .eq("program_id", program.id)
    .single();

  if (!block) {
    notFound();
  }

  const { data: courses } = await supabase
    .from("courses")
    .select("id, title, code, credits_or_weight")
    .eq("program_id", program.id)
    .order("title");

  const { data: assignments } = await supabase
    .from("course_requirement_blocks")
    .select("course_id")
    .eq("requirement_block_id", block.id);

  const assignedCourseIds = new Set(
    (assignments ?? []).map((item) => item.course_id)
  );

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="max-w-4xl space-y-8">
        <header className="space-y-2">
          <Link
            href={`/programs/${program.id}/audit`}
            className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
          >
            Program Audit
          </Link>
          <h1 className="text-3xl font-semibold">Edit Requirement Block</h1>
          <p className="text-sm text-[var(--muted)]">
            {program.title} · {block.title}
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}

        <form action={updateRequirementBlock} className="space-y-6">
          <input type="hidden" name="programId" value={program.id} />
          <input type="hidden" name="blockId" value={block.id} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Title
              </label>
              <input
                name="title"
                defaultValue={block.title}
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Category
              </label>
              <input
                name="category"
                defaultValue={block.category ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Description
            </label>
            <textarea
              name="description"
              rows={4}
              defaultValue={block.description ?? ""}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Minimum Courses Required
              </label>
              <input
                name="minimumCoursesRequired"
                type="number"
                min="0"
                defaultValue={block.minimum_courses_required ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Minimum Credits Required
              </label>
              <input
                name="minimumCreditsRequired"
                type="number"
                min="0"
                step="0.5"
                defaultValue={block.minimum_credits_required ?? ""}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Courses that satisfy this requirement
            </p>
            {courses?.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {courses.map((course) => (
                  <label
                    key={course.id}
                    className="flex items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="courseIds"
                      value={course.id}
                      defaultChecked={assignedCourseIds.has(course.id)}
                      className="h-4 w-4"
                    />
                    <span>
                      {course.code ? `${course.code} — ` : ""}
                      {course.title}
                      {course.credits_or_weight !== null
                        ? ` (${course.credits_or_weight} credits)`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                No courses available in this program yet.
              </p>
            )}
          </div>

          <p className="text-xs text-[var(--muted)]">
            Provide at least one minimum: courses or credits.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 py-2 text-sm text-white"
            >
              Save changes
            </button>
            <Link
              href={`/programs/${program.id}/audit`}
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
