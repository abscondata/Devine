import Link from "next/link";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

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

  const { data: programs } = user
    ? await supabase
        .from("programs")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
    : { data: [] as { id: string }[] };

  const programId = programs?.[0]?.id ?? null;
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
            <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
              <span>{userEmail}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="rounded-md border border-[var(--border)] px-3 py-1 text-xs uppercase tracking-[0.2em]"
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
                Work
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
