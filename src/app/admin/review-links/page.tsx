import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import { createReviewLink, revokeReviewLink } from "@/lib/actions";
import { FormalDocumentLayout, DocumentSection } from "@/components/formal-document";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimestamp(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function ReviewLinksAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  type ProgramSummary = {
    id: string;
    title: string;
    description: string | null;
    owner_id: string;
  };

  const { data: memberships } = await supabase
    .from("program_members")
    .select("program_id, role")
    .eq("user_id", user.id)
    .in("role", ["owner", "admin", "staff"]);

  const memberProgramIds = Array.from(
    new Set((memberships ?? []).map((membership) => membership.program_id))
  );

  const { data: ownedProgramsRaw } = await supabase
    .from("programs")
    .select("id, title, description, owner_id")
    .eq("owner_id", user.id);
  const ownedPrograms: ProgramSummary[] = ownedProgramsRaw ?? [];

  const { data: memberProgramsRaw } = memberProgramIds.length
    ? await supabase
        .from("programs")
        .select("id, title, description, owner_id")
        .in("id", memberProgramIds)
    : { data: [] as ProgramSummary[] };
  const memberPrograms: ProgramSummary[] = memberProgramsRaw ?? [];

  const programMap = new Map<string, ProgramSummary>();
  (ownedPrograms ?? []).forEach((program) => programMap.set(program.id, program));
  (memberPrograms ?? []).forEach((program) => programMap.set(program.id, program));
  const programs = Array.from(programMap.values());

  const programIds = programs.map((program) => program.id);

  if (!programs.length) {
    redirect("/dashboard?error=Access denied.");
  }

  if (!isAdminClientAvailable()) {
    return (
      <FormalDocumentLayout
        documentType="Review Access Administration"
        title="External Review Links"
        description="Issue and revoke formal review-only access for institutional packet pages."
      >
        <DocumentSection title="Configuration Required">
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)] space-y-2">
            <p>
              The external review system requires a Supabase service role key.
            </p>
            <p>
              Set <code className="font-mono text-[var(--text)]">SUPABASE_SERVICE_ROLE_KEY</code> in
              the environment configuration and restart the application.
            </p>
          </div>
        </DocumentSection>
      </FormalDocumentLayout>
    );
  }

  const admin = createAdminClient();
  const { data: reviewLinks } = programIds.length
    ? await admin
        .from("review_links")
        .select(
          "id, program_id, created_at, expires_at, revoked_at, last_accessed_at, note"
        )
        .in("program_id", programIds)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; program_id: string; created_at: string; expires_at: string | null; revoked_at: string | null; last_accessed_at: string | null; note: string | null }[] };

  const linksByProgram = new Map<string, typeof reviewLinks>();
  (reviewLinks ?? []).forEach((link) => {
    const list = linksByProgram.get(link.program_id) ?? [];
    list.push(link);
    linksByProgram.set(link.program_id, list);
  });

  const tokenCookie = (await cookies()).get("review_link_token")?.value ?? null;
  const recordDate = formatDate(new Date().toISOString());

  return (
    <FormalDocumentLayout
      documentType="Review Access Administration"
      title="External Review Links"
      description="Issue and revoke formal review-only access for institutional packet pages."
      recordDate={recordDate}
    >
      {tokenCookie ? (
        <DocumentSection title="New Review Token">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
            <p className="text-[var(--text)]">
              Copy this token now. It is shown only once.
            </p>
            <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-sm text-[var(--text)]">
              {tokenCookie}
            </div>
          </div>
        </DocumentSection>
      ) : null}

      <DocumentSection title="Program Review Access">
        {programs.length ? (
          <div className="space-y-6">
            {programs.map((program) => {
              const links = linksByProgram.get(program.id) ?? [];
              return (
                <div
                  key={program.id}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4"
                >
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      Program
                    </p>
                    <h3 className="text-lg font-semibold">{program.title}</h3>
                    <p className="text-sm text-[var(--muted)]">
                      {program.description ?? "No description recorded."}
                    </p>
                  </div>

                  <form action={createReviewLink} className="grid gap-3 md:grid-cols-3">
                    <input type="hidden" name="programId" value={program.id} />
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Expiration (Optional)
                      </label>
                      <input
                        type="datetime-local"
                        name="expiresAt"
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Note (Optional)
                      </label>
                      <input
                        name="note"
                        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
                      >
                        Issue review link
                      </button>
                    </div>
                  </form>

                  {links.length ? (
                    <div className="space-y-3 text-sm text-[var(--muted)]">
                      {links.map((link) => {
                        const isExpired =
                          link.expires_at &&
                          new Date(link.expires_at) <= new Date();
                        const status = link.revoked_at
                          ? "Revoked"
                          : isExpired
                          ? "Expired"
                          : "Active";
                        return (
                          <div
                            key={link.id}
                            className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-4 space-y-2"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  Status
                                </p>
                                <p className="text-[var(--text)]">{status}</p>
                              </div>
                              <form action={revokeReviewLink}>
                                <input type="hidden" name="linkId" value={link.id} />
                                <button
                                  type="submit"
                                  className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
                                  disabled={Boolean(link.revoked_at)}
                                >
                                  Revoke
                                </button>
                              </form>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  Created
                                </p>
                                <p>{formatTimestamp(link.created_at)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  Expires
                                </p>
                                <p>{formatTimestamp(link.expires_at)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  Last accessed
                                </p>
                                <p>{formatTimestamp(link.last_accessed_at)}</p>
                              </div>
                              <div>
                                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                                  Note
                                </p>
                                <p>{link.note ?? "--"}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)]">
                      No review links issued yet.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No programs available for review access.
          </div>
        )}
      </DocumentSection>
    </FormalDocumentLayout>
  );
}
