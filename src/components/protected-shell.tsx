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

function NavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block px-4 py-2 text-sm transition-colors rounded-md ${
        active
          ? "bg-[var(--surface)] text-[var(--text)] font-medium"
          : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface)]"
      }`}
    >
      {label}
    </Link>
  );
}

function NavSection({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      {label ? (
        <p className="px-4 pt-4 pb-1 text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] select-none">
          {label}
        </p>
      ) : null}
      {children}
    </div>
  );
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
  const researchHref = programId
    ? `/programs/${programId}/research`
    : "/programs";
  const workHref = programId ? `/programs/${programId}/work` : "/programs";
  const reviewHref = programId
    ? `/programs/${programId}/review`
    : "/programs";

  return (
    <div className="min-h-screen flex">
      {/* ─── Sidebar ─── */}
      <aside className="hidden md:flex md:w-56 lg:w-60 flex-col border-r border-[var(--border)] bg-[var(--surface)] print:hidden shrink-0">
        <div className="px-5 pt-6 pb-4">
          <Link
            href="/dashboard"
            className="font-serif text-lg tracking-tight leading-tight block"
          >
            Devine College
          </Link>
          <p className="text-[10px] uppercase tracking-[0.25em] text-[var(--muted)] mt-1">
            Catholic Formation
          </p>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
          <NavSection>
            <NavLink href="/dashboard" label="College Home" />
            <NavLink href="/term" label="My Term" />
          </NavSection>

          <NavSection label="Study">
            <NavLink href="/courses" label="Courses" />
            <NavLink href={workHref} label="Written Work" />
          </NavSection>

          <NavSection label="Records">
            <NavLink href={recordHref} label="Academic Record" />
            <NavLink href={auditHref} label="Curriculum" />
          </NavSection>

          <NavSection label="Research">
            <NavLink href={researchHref} label="Research Register" />
          </NavSection>

          <NavSection label="Review">
            <NavLink href={reviewHref} label="Review Packets" />
          </NavSection>
        </nav>

        <div className="border-t border-[var(--border)] px-4 py-4 space-y-2">
          {userEmail ? (
            <p className="text-xs text-[var(--muted)] truncate">{userEmail}</p>
          ) : null}
          <form action={signOut}>
            <button
              type="submit"
              className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ─── Mobile header ─── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden border-b border-[var(--border)] bg-[var(--surface)] print:hidden">
          <div className="px-4 py-3 flex items-center justify-between">
            <Link
              href="/dashboard"
              className="font-serif text-base tracking-tight"
            >
              Devine College
            </Link>
            <nav className="flex items-center gap-3 text-xs text-[var(--muted)]">
              <Link href="/dashboard" className="hover:text-[var(--text)]">Home</Link>
              <Link href="/term" className="hover:text-[var(--text)]">Term</Link>
              <Link href="/courses" className="hover:text-[var(--text)]">Courses</Link>
              <Link href={recordHref} className="hover:text-[var(--text)]">Record</Link>
            </nav>
          </div>
        </header>

        {/* ─── Main content ─── */}
        <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">
          <div className="max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
