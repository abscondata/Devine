import Link from "next/link";

export function ReviewAccessShell({
  children,
  homeHref,
}: {
  children: React.ReactNode;
  homeHref?: string;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="space-y-1">
            {homeHref ? (
              <Link href={homeHref} className="text-sm font-semibold">
                Devine College Core
              </Link>
            ) : (
              <span className="text-sm font-semibold">Devine College Core</span>
            )}
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              External Review Access
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
