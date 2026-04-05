import Link from "next/link";
import { signOut } from "@/lib/actions";

export function ReviewShell({
  userEmail,
  children,
}: {
  userEmail: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="space-y-1">
            <Link href="/programs" className="text-sm font-semibold">
              Devine College Core
            </Link>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              Review Mode
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-[var(--muted)]">
            <span>{userEmail}</span>
            <form action={signOut} className="no-print">
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
