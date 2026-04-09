import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewProgram } from "@/lib/review-access";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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
  return parts.length ? parts.join(" and ") : "No requirement set";
}

export default async function ReviewCharterPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const review = await getReviewProgram(token);
  if (!review) {
    notFound();
  }
  const { program } = review;
  const admin = createAdminClient();

  const { data: requirementBlocks } = await admin
    .from("requirement_blocks")
    .select(
      "id, program_id, title, description, category, minimum_courses_required, minimum_credits_required, position"
    )
    .eq("program_id", program.id)
    .order("position", { ascending: true });

  const categoryOrder = ["Foundations", "Core", "Advanced", "Capstone", "Research"];
  const blocksByCategory = new Map<string, typeof requirementBlocks>();
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
  const now = formatDate(new Date().toISOString());

  return (
    <div className="space-y-10 max-w-4xl print:max-w-none">

      {/* ─── Document header ─── */}
      <header className="space-y-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <Link href={`/review/${token}`}>Program review packet</Link>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
          <span className="text-[var(--text)]">Charter</span>
          <Link href={`/review/${token}/record`}>Record</Link>
          <Link href={`/review/${token}/chronology`}>Chronology</Link>
          <Link href={`/review/${token}/work`}>Work</Link>
          <Link href={`/review/${token}/research`}>Research</Link>
          <Link href={`/review/${token}/thesis`}>Thesis</Link>
          <Link href={`/review/${token}/readiness`}>Readiness</Link>
        </div>
        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
          {program.title} · Program Charter
        </p>
        <h1 className="text-3xl">Program Charter</h1>
        <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
          <span>{totalBlocks} requirement blocks</span>
          <span>{orderedCategories.length} categories</span>
        </div>
        <p className="text-xs text-[var(--muted)]">Generated {now}</p>
      </header>

      {/* ─── Purpose ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Purpose</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">
            Devine College Core is a private, single-student academic program in
            Catholic theology, philosophy, Scripture, and Church history. It
            emphasizes structured study, primary texts, disciplined writing, and
            audited completion.
          </p>
          {program.description ? (
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{program.description}</p>
          ) : null}
        </div>
      </section>

      {/* ─── Completion standards ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Completion Standards</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <p className="text-sm text-[var(--muted)]">
            Official completion for a course requires all assigned readings marked
            complete (skipped readings do not count) and final submissions for every
            assignment. Critiques are recommended for rigor but do not determine
            completion.
          </p>
          <p className="text-sm text-[var(--muted)]">
            Program completion is constitutional: every requirement block must be
            satisfied by officially completed courses and any stated minimum credit
            thresholds.
          </p>
        </div>
      </section>

      {/* ─── Standing definitions ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Standing Definitions</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2">
          <p className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">Officially Complete:</span>{" "}
            All readings complete and all assignments finalized.
          </p>
          <p className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">In Progress:</span>{" "}
            Some work completed, but official completion not yet met.
          </p>
          <p className="text-sm text-[var(--muted)]">
            <span className="font-semibold text-[var(--text)]">Not Yet Started:</span>{" "}
            No recorded work in the course.
          </p>
        </div>
      </section>

      {/* ─── Requirement blocks ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Requirement Blocks</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            The program is organized into requirement blocks. Each block has a
            minimum course and/or credit threshold that must be completed for the
            block to be satisfied.
          </p>
        </div>
        {(requirementBlocks ?? []).length > 0 ? (
          <div className="space-y-6">
            {orderedCategories.map((category) => {
              const blocks = blocksByCategory.get(category) ?? [];
              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-base font-semibold">{category}</h3>
                  <div className="space-y-3">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-[var(--text)]">{block.title}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            {formatRule(block)}
                          </p>
                        </div>
                        {block.description ? (
                          <p className="text-sm text-[var(--muted)]">{block.description}</p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No requirement blocks recorded.</p>
        )}
      </section>

      {/* ─── Sequence & readiness ─── */}
      <section className="space-y-3">
        <h2 className="text-lg">Sequence and Readiness</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            Course sequencing is explicit through institutional order and prerequisite
            readiness. The program records recommended progression while preserving
            truthful prerequisite blocking where required.
          </p>
        </div>
      </section>

      {/* ─── Document footer ─── */}
      <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
        <p>
          {program.title} · Program charter · {totalBlocks} requirement blocks · {orderedCategories.length} categories · Generated {now}
        </p>
      </footer>
    </div>
  );
}
