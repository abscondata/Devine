import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getReviewProgram } from "@/lib/review-access";
import { DocumentSection, FormalDocumentLayout } from "@/components/formal-document";

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

  const recordDate = new Date().toISOString();

  return (
    <FormalDocumentLayout
      backLink={{ href: `/review/${token}`, label: "Program review packet" }}
      documentType="Program Charter"
      title={program.title}
      description={
        program.description ??
        "A formal statement of the program's academic constitution and completion standards."
      }
      recordDate={new Date(recordDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}
      actions={[
        { href: `/review/${token}/record`, label: "Academic record" },
        { href: `/review/${token}/work`, label: "Academic work record" },
        { href: `/review/${token}/research`, label: "Research register" },
        { href: `/review/${token}/chronology`, label: "Academic chronology" },
      ]}
    >
      <DocumentSection title="Purpose">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            Devine College Core is a private, single-student academic program in
            Catholic theology, philosophy, Scripture, and Church history. It
            emphasizes structured study, primary texts, disciplined writing, and
            audited completion.
          </p>
        </div>
      </DocumentSection>

      <DocumentSection title="Completion Standards">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-3">
          <p>
            Official completion for a course requires all assigned readings marked
            complete (skipped readings do not count) and final submissions for every
            assignment. Critiques are recommended for rigor but do not determine
            completion.
          </p>
          <p>
            Program completion is constitutional: every requirement block must be
            satisfied by officially completed courses and any stated minimum credit
            thresholds.
          </p>
        </div>
      </DocumentSection>

      <DocumentSection title="Standing Definitions">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            <span className="font-semibold text-[var(--text)]">Officially Complete:</span>{" "}
            All readings complete and all assignments finalized.
          </p>
          <p>
            <span className="font-semibold text-[var(--text)]">In Progress:</span>{" "}
            Some work completed, but official completion not yet met.
          </p>
          <p>
            <span className="font-semibold text-[var(--text)]">Not Yet Started:</span>{" "}
            No recorded work in the course.
          </p>
        </div>
      </DocumentSection>

      <DocumentSection title="Requirement Blocks">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            The program is organized into requirement blocks. Each block has a
            minimum course and/or credit threshold that must be completed for the
            block to be satisfied.
          </p>
        </div>
        {requirementBlocks?.length ? (
          <div className="space-y-6">
            {orderedCategories.map((category) => {
              const blocks = blocksByCategory.get(category) ?? [];
              return (
                <div key={category} className="space-y-3">
                  <h3 className="text-lg font-semibold">{category}</h3>
                  <div className="space-y-4">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-2 text-sm text-[var(--muted)]"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Requirement Block
                        </p>
                        <p className="text-lg font-semibold text-[var(--text)]">
                          {block.title}
                        </p>
                        <p>{block.description ?? "No description recorded."}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          {formatRule(block)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No requirement blocks recorded.
          </div>
        )}
      </DocumentSection>

      <DocumentSection title="Sequence & Readiness">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)] space-y-2">
          <p>
            Course sequencing is explicit through institutional order and prerequisite
            readiness. The program records recommended progression while preserving
            truthful prerequisite blocking where required.
          </p>
        </div>
      </DocumentSection>
    </FormalDocumentLayout>
  );
}
