import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

function formatRule(block: {
  minimum_courses_required: number | null;
  minimum_credits_required: number | null;
}) {
  const parts: string[] = [];
  if (block.minimum_courses_required !== null) {
    parts.push(
      `Minimum ${block.minimum_courses_required} course${block.minimum_courses_required === 1 ? "" : "s"}`
    );
  }
  if (block.minimum_credits_required !== null) {
    parts.push(`Minimum ${block.minimum_credits_required} credits`);
  }
  return parts.length ? parts.join(" · ") : "No requirement set";
}

export default async function ProgramCharterPage({
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

  const { data: requirementBlocks } = await supabase
    .from("requirement_blocks")
    .select(
      "id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position"
    )
    .eq("program_id", id)
    .order("position", { ascending: true });

  const categoryOrder = ["Foundations", "Core", "Advanced", "Capstone", "Research"];
  type BlockRow = NonNullable<typeof requirementBlocks>[number];
  const blocksByCategory = new Map<string, BlockRow[]>();
  requirementBlocks?.forEach((block) => {
    const category = block.category ?? "Uncategorized";
    const list = blocksByCategory.get(category) ?? [];
    list.push(block);
    blocksByCategory.set(category, list);
  });
  const orderedCategories = [
    ...categoryOrder.filter((category) => blocksByCategory.has(category)),
    ...Array.from(blocksByCategory.keys()).filter(
      (category) => !categoryOrder.includes(category)
    ),
  ];

  const totalBlocks = requirementBlocks?.length ?? 0;
  const totalRequiredCourses = (requirementBlocks ?? []).reduce(
    (sum, b) => sum + (b.minimum_courses_required ?? 0),
    0
  );
  const totalRequiredCredits = (requirementBlocks ?? []).reduce(
    (sum, b) => sum + (b.minimum_credits_required ?? 0),
    0
  );

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ─── Header ─── */}
        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title}
          </p>
          <h1 className="text-3xl">Program Charter</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>
              {totalBlocks} requirement block{totalBlocks === 1 ? "" : "s"}
            </span>
            {totalRequiredCourses ? (
              <span>{totalRequiredCourses} courses required</span>
            ) : null}
            {totalRequiredCredits ? (
              <span>{totalRequiredCredits} credits required</span>
            ) : null}
          </div>
          {program.description ? (
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">
              {program.description}
            </p>
          ) : null}
        </header>

        {/* ─── Preamble ─── */}
        <section className="max-w-2xl space-y-3">
          <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
            Preamble
          </p>
          <p className="font-serif text-base leading-relaxed">
            The following articles establish the academic constitution of{" "}
            {program.title}. They define the program&rsquo;s purpose, the standards
            by which its courses and requirements are satisfied, and the terms
            under which a student may be said to have completed the program.
          </p>
        </section>

        {/* ─── Article I — Purpose ─── */}
        <section className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Article I
            </p>
            <h2 className="text-xl">Purpose</h2>
          </div>
          <p className="font-serif text-base leading-relaxed">
            Devine College Core is a private, single-student academic program in
            Catholic theology, philosophy, Scripture, and Church history. It
            emphasizes structured study, primary texts, disciplined writing, and
            audited completion.
          </p>
        </section>

        {/* ─── Article II — Completion Standards ─── */}
        <section className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Article II
            </p>
            <h2 className="text-xl">Completion Standards</h2>
          </div>
          <p className="font-serif text-base leading-relaxed">
            Official completion for a course requires all assigned readings
            marked complete &mdash; skipped readings do not count &mdash; and
            final submissions for every assignment. Critiques are recommended
            for rigor but do not determine completion.
          </p>
          <p className="font-serif text-base leading-relaxed">
            Program completion is constitutional: every requirement block must be
            satisfied by officially completed courses and any stated minimum
            credit thresholds.
          </p>
        </section>

        {/* ─── Article III — Standing Definitions ─── */}
        <section className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Article III
            </p>
            <h2 className="text-xl">Standing Definitions</h2>
          </div>
          <dl className="font-serif text-base leading-relaxed divide-y divide-[var(--border)]">
            <div className="py-3">
              <dt className="font-semibold">Officially Complete</dt>
              <dd className="text-[var(--muted)]">
                All readings complete and all assignments finalized.
              </dd>
            </div>
            <div className="py-3">
              <dt className="font-semibold">In Progress</dt>
              <dd className="text-[var(--muted)]">
                Some work completed, but official completion not yet met.
              </dd>
            </div>
            <div className="py-3">
              <dt className="font-semibold">Not Yet Started</dt>
              <dd className="text-[var(--muted)]">
                No recorded work in the course.
              </dd>
            </div>
          </dl>
        </section>

        {/* ─── Article IV — Requirement Blocks ─── */}
        <section className="space-y-6">
          <div className="max-w-2xl space-y-3">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
                Article IV
              </p>
              <h2 className="text-xl">Requirement Blocks</h2>
            </div>
            <p className="font-serif text-base leading-relaxed">
              The program is organized into requirement blocks. Each block
              establishes a minimum course and/or credit threshold that must be
              satisfied by officially completed courses for the block to be met.
              The following blocks are the binding requirements of the program.
            </p>
          </div>

          {requirementBlocks?.length ? (
            <div className="space-y-8">
              {orderedCategories.map((category) => {
                const blocks = blocksByCategory.get(category) ?? [];
                return (
                  <div key={category} className="space-y-3">
                    <div className="border-b border-[var(--border)] pb-2">
                      <h3 className="text-base">{category}</h3>
                    </div>
                    <div className="divide-y divide-[var(--border)]">
                      {blocks.map((block) => (
                        <div
                          key={block.id}
                          className="py-4 space-y-1"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <p className="text-sm font-semibold">
                              {block.title}
                            </p>
                            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] shrink-0">
                              {formatRule(block)}
                            </p>
                          </div>
                          {block.description ? (
                            <p className="font-serif text-sm leading-relaxed text-[var(--muted)] max-w-2xl">
                              {block.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              No requirement blocks recorded.
            </p>
          )}
        </section>

        {/* ─── Article V — Sequence and Readiness ─── */}
        <section className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Article V
            </p>
            <h2 className="text-xl">Sequence and Readiness</h2>
          </div>
          <p className="font-serif text-base leading-relaxed">
            Course sequencing is explicit through institutional order and
            prerequisite readiness. The program records recommended progression
            while preserving truthful prerequisite blocking where required.
          </p>
        </section>

        {/* ─── Article VI — Record Access ─── */}
        <section className="max-w-2xl space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[var(--muted)]">
              Article VI
            </p>
            <h2 className="text-xl">Record Access</h2>
          </div>
          <p className="font-serif text-base leading-relaxed">
            The official academic record and course dossiers provide the formal
            view of progress and curriculum substance. The degree audit provides
            the binding determination of whether the requirement blocks of this
            charter have been satisfied.
          </p>
        </section>

        {/* ─── Institutional documents ─── */}
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)] border-t border-[var(--border)] pt-6">
          <Link href={`/programs/${program.id}/record`} className="hover:text-[var(--text)]">Academic record</Link>
          <Link href={`/programs/${program.id}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
          <Link href={`/programs/${program.id}/work`} className="hover:text-[var(--text)]">Writing dossier</Link>
          <Link href={`/programs/${program.id}/chronology`} className="hover:text-[var(--text)]">Chronology</Link>
          <Link href={`/programs/${program.id}/research`} className="hover:text-[var(--text)]">Research register</Link>
        </nav>
      </div>
    </ProtectedShell>
  );
}
