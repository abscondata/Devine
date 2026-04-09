import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildMissingThesisSummary,
  summarizeThesisProject,
} from "@/lib/thesis-governance";
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ThesisDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, title, description")
    .eq("id", id)
    .single();

  if (!program) {
    notFound();
  }

  const { data: rsynCourse } = await supabase
    .from("courses")
    .select("id, title, code, description, credits_or_weight, level")
    .eq("program_id", program.id)
    .eq("code", "RSYN 720")
    .maybeSingle();

  const { data: thesisProject } = rsynCourse
    ? await supabase
        .from("thesis_projects")
        .select(
          "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
        )
        .eq("program_id", program.id)
        .eq("course_id", rsynCourse.id)
        .maybeSingle()
    : { data: null };

  const { data: thesisMilestones } = thesisProject
    ? await supabase
        .from("thesis_milestones")
        .select(
          "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
        )
        .eq("thesis_project_id", thesisProject.id)
        .order("position", { ascending: true })
    : { data: [] };

  const { data: finalSubmissions } = await supabase
    .from("submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_final", true);

  const { data: courseModules } = rsynCourse
    ? await supabase
        .from("modules")
        .select("id, title, position")
        .eq("course_id", rsynCourse.id)
        .order("position", { ascending: true })
    : { data: [] };

  const thesisSummary = thesisProject
    ? summarizeThesisProject({
        project: thesisProject,
        milestones: thesisMilestones ?? [],
        finalSubmissionIds: new Set((finalSubmissions ?? []).map((row) => row.id)),
      })
    : buildMissingThesisSummary();

  const now = formatDate(new Date().toISOString());
  const candidacyMilestones = thesisSummary.milestones.filter((m) =>
    ["question_problem", "scope_boundaries", "preliminary_bibliography", "method_architecture_memo"].includes(m.key)
  );
  const postCandidacyMilestones = thesisSummary.milestones.filter((m) =>
    ["prospectus", "draft_thesis", "final_thesis", "final_synthesis_reflection"].includes(m.key)
  );

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10 max-w-4xl print:max-w-none">

        {/* ─── Document header ─── */}
        <header className="space-y-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
            <Link href={`/programs/${program.id}/research`}>Research register</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {program.title} · Thesis Dossier
          </p>
          <h1 className="text-3xl">{thesisProject?.title ?? "Thesis Project"}</h1>
          <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {rsynCourse ? <span>{rsynCourse.code}</span> : null}
            {rsynCourse?.credits_or_weight ? <span>{rsynCourse.credits_or_weight} credits</span> : null}
            {rsynCourse?.level ? <span>{rsynCourse.level}</span> : null}
            <span>{thesisSummary.requiredCompleted}/{thesisSummary.requiredTotal} milestones</span>
            <span>Candidacy: {thesisSummary.candidacyReady ? "Established" : "Not established"}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Generated {now}</p>
        </header>

        {/* ─── Course context ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Course and Program</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap gap-x-6 text-sm">
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Program</p>
                <p>{program.title}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Course</p>
                <p>{rsynCourse ? `${rsynCourse.code} — ${rsynCourse.title}` : "RSYN 720 not recorded"}</p>
              </div>
            </div>
            {rsynCourse?.description ? (
              <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{rsynCourse.description}</p>
            ) : null}
            {(courseModules ?? []).length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Course structure</p>
                <div className="text-sm text-[var(--muted)]">
                  {(courseModules ?? []).map((mod) => (
                    <p key={mod.id}>Unit {mod.position + 1}: {mod.title}</p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* ─── Project status ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Project Status</h2>
          {thesisProject ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-[var(--text)]">
                  {thesisSummary.statusLabel}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {thesisSummary.requiredCompleted}/{thesisSummary.requiredTotal} required milestones
                </p>
              </div>
              <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                <span>Candidacy: {thesisSummary.candidacyReady ? "Established" : "Not established"}</span>
                <span>Final thesis: {thesisSummary.finalThesisReady ? "Recorded" : "Pending"}</span>
                <span>Synthesis reflection: {thesisSummary.finalSynthesisReady ? "Recorded" : "Pending"}</span>
              </div>
              {thesisProject.opened_at ? (
                <p className="text-xs text-[var(--muted)]">Opened {formatDate(thesisProject.opened_at)}</p>
              ) : null}
              {thesisProject.candidacy_established_at ? (
                <p className="text-xs text-[var(--muted)]">Candidacy established {formatDate(thesisProject.candidacy_established_at)}</p>
              ) : null}
              {thesisProject.final_submitted_at ? (
                <p className="text-xs text-[var(--muted)]">Final submitted {formatDate(thesisProject.final_submitted_at)}</p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No thesis project is recorded.
            </div>
          )}
        </section>

        {/* ─── Research question and scope ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Research Question and Scope</h2>
          {thesisProject ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Research question</p>
                <p className="text-sm">{thesisProject.research_question}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Governing problem</p>
                <p className="text-sm">{thesisProject.governing_problem}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Scope statement</p>
                <p className="text-sm">{thesisProject.scope_statement}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Thesis claim</p>
                <p className="text-sm">{thesisProject.thesis_claim ?? "Not yet defined."}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
              No thesis question, scope, or claim is recorded.
            </div>
          )}
        </section>

        {/* ─── Milestone ledger: candidacy ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Candidacy Milestones</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="hidden md:grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[1fr_140px_160px] pb-2 border-b border-[var(--border)]">
              <span>Milestone</span>
              <span>Status</span>
              <span>Artifact</span>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              {candidacyMilestones.map((milestone) => (
                <div
                  key={milestone.key}
                  className="grid gap-2 md:grid-cols-[1fr_140px_160px]"
                >
                  <span>{milestone.title}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {milestone.completed ? `Complete ${formatDate(milestone.completed_at)}` : "Pending"}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {milestone.submission_id ? (
                      <Link href={`/submissions/${milestone.submission_id}/record`}>
                        Final record
                      </Link>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Milestone ledger: post-candidacy ─── */}
        <section className="space-y-3">
          <h2 className="text-lg">Post-Candidacy Milestones</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="hidden md:grid gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] md:grid-cols-[1fr_140px_160px] pb-2 border-b border-[var(--border)]">
              <span>Milestone</span>
              <span>Status</span>
              <span>Artifact</span>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              {postCandidacyMilestones.map((milestone) => (
                <div
                  key={milestone.key}
                  className="grid gap-2 md:grid-cols-[1fr_140px_160px]"
                >
                  <span>{milestone.title}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {milestone.completed ? `Complete ${formatDate(milestone.completed_at)}` : "Pending"}
                  </span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {milestone.submission_id ? (
                      <Link href={`/submissions/${milestone.submission_id}/record`}>
                        Final record
                      </Link>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Document footer ─── */}
        <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <p>
            {program.title} · {rsynCourse?.code ?? "RSYN 720"} · Thesis dossier · {thesisSummary.requiredCompleted}/{thesisSummary.requiredTotal} milestones · Generated {now}
          </p>
        </footer>
      </div>
    </ProtectedShell>
  );
}
