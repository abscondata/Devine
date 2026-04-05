import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signIn } from "@/lib/actions";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { error, message } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12 bg-[var(--bg)]">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl tracking-tight">Devine College</h1>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            Private Catholic college for theology, philosophy, Scripture, and Church history
          </p>
        </div>

        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-8 space-y-6">
          {error && (
            <div className="rounded-md border border-[var(--danger)]/30 bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--danger)]">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--muted)]">
              {message}
            </div>
          )}

          <form action={signIn} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="email"
                className="block text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-soft)]"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="password"
                className="block text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent-soft)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-soft)]"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-soft)]"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
