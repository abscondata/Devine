import Link from "next/link";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Resolves the authenticated user's program enrollment context.
 * Returns program_id and current_course_id from the membership row.
 * Priority: ownership first, then any membership.
 */
async function resolveEnrollment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ programId: string; currentCourseId: string | null } | null> {
  // Check ownership first (owner is always a member too, but programs.owner_id is canonical)
  const { data: owned } = await supabase
    .from("programs")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);

  const programId = owned?.[0]?.id ?? null;

  if (!programId) {
    // Fall back to membership
    const { data: memberships } = await supabase
      .from("program_members")
      .select("program_id, current_course_id")
      .eq("user_id", userId)
      .limit(1);
    if (memberships?.length) {
      return {
        programId: memberships[0].program_id,
        currentCourseId: memberships[0].current_course_id,
      };
    }
    return null;
  }

  // Read current_course_id from the membership row for this program
  const { data: membership } = await supabase
    .from("program_members")
    .select("current_course_id")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    programId,
    currentCourseId: membership?.current_course_id ?? null,
  };
}

export async function ProtectedShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const enrollment = user ? await resolveEnrollment(supabase, user.id) : null;
  const programId = enrollment?.programId ?? null;
  const recordHref = programId ? `/programs/${programId}/record` : "/programs";
  const workHref = programId ? `/programs/${programId}/work` : "/programs";
  const researchHref = programId
    ? `/programs/${programId}/research`
    : "/programs";
  const reviewHref = programId ? `/programs/${programId}/review` : "/programs";

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link href="/dashboard" className="font-serif text-lg tracking-tight">
              Devine College
            </Link>
            <div className="flex items-center gap-4">
              <span className="text-xs text-[var(--muted)]">{userEmail}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                >
                  Sign Out
                </button>
              </form>
            </div>
          </div>
          <nav className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <Link href="/dashboard" className="hover:text-[var(--text)]">
                College Home
              </Link>
              <Link href="/courses" className="hover:text-[var(--text)]">
                Courses
              </Link>
              <Link href="/readings" className="hover:text-[var(--text)]">
                Readings
              </Link>
              <Link href="/assignments" className="hover:text-[var(--text)]">
                Assignments
              </Link>
            </div>
            <span className="hidden md:inline text-[var(--border)]">|</span>
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)] opacity-70">
              <Link href="/programs" className="hover:text-[var(--text)] hover:opacity-100">
                Program
              </Link>
              <Link href={recordHref} className="hover:text-[var(--text)] hover:opacity-100">
                Record
              </Link>
              <Link href={workHref} className="hover:text-[var(--text)] hover:opacity-100">
                Submissions
              </Link>
              <Link href={researchHref} className="hover:text-[var(--text)] hover:opacity-100">
                Research
              </Link>
              <Link href={reviewHref} className="hover:text-[var(--text)] hover:opacity-100">
                Review
              </Link>
            </div>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
