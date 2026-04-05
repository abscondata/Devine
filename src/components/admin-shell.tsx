import Link from "next/link";
import { signOut } from "@/lib/actions";

export function AdminShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="space-y-1">
            <Link href="/dashboard" className="text-sm font-semibold">
              Devine Academic Administration
            </Link>
            <nav className="flex items-center gap-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <Link href="/admin/thesis" className="hover:text-[var(--text)]">
                Thesis governance
              </Link>
              <Link
                href="/admin/review-links"
                className="hover:text-[var(--text)]"
              >
                Review access
              </Link>
            </nav>
          </div>
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
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
