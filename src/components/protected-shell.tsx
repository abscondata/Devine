import Link from "next/link";
import { signOut } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

async function resolveEnrollment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<{ programId: string } | null> {
  const { data: owned } = await supabase
    .from("programs")
    .select("id")
    .eq("owner_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (owned?.length) return { programId: owned[0].id };

  const { data: memberships } = await supabase
    .from("program_members")
    .select("program_id")
    .eq("user_id", userId)
    .limit(1);
  if (memberships?.length) return { programId: memberships[0].program_id };

  return null;
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
  const auditHref = programId ? `/programs/${programId}/audit` : "/programs";

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
          <nav className="mt-3 flex flex-wrap items-center gap-5 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <Link href="/dashboard" className="hover:text-[var(--text)]">My Term</Link>
            <Link href="/courses" className="hover:text-[var(--text)]">Courses</Link>
            <Link href={recordHref} className="hover:text-[var(--text)]">Record</Link>
            <Link href={auditHref} className="hover:text-[var(--text)]">Curriculum</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
