import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

function extractUrls(text: string | null): string[] {
  if (!text) return [];
  const matches = text.match(/https?:\/\/[^\s)]+/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function renderCitationWithLinks(citation: string | null) {
  if (!citation) return null;
  const urls = extractUrls(citation);
  if (urls.length === 0) {
    return <span>{citation}</span>;
  }
  const parts: (string | { url: string })[] = [];
  let remaining = citation;
  urls.forEach((url) => {
    const idx = remaining.indexOf(url);
    if (idx > 0) parts.push(remaining.slice(0, idx));
    parts.push({ url });
    remaining = remaining.slice(idx + url.length);
  });
  if (remaining.length > 0) parts.push(remaining);
  return (
    <>
      {parts.map((part, i) =>
        typeof part === "string" ? (
          <span key={i}>{part}</span>
        ) : (
          <a
            key={i}
            href={part.url}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-[var(--border)] underline-offset-2 hover:decoration-[var(--text)] break-all"
          >
            {part.url}
          </a>
        )
      )}
    </>
  );
}

export default async function CourseReadingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select(
      "id, title, code, credits_or_weight, level, program:programs(id, title)"
    )
    .eq("id", id)
    .single();
  if (!course) notFound();

  const { data: modules } = await supabase
    .from("modules")
    .select("id, title, position")
    .eq("course_id", id)
    .order("position", { ascending: true });

  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: readings } = moduleIds.length
    ? await supabase
        .from("readings")
        .select(
          "id, module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, reference_url_or_citation, position"
        )
        .in("module_id", moduleIds)
        .order("position", { ascending: true })
    : { data: [] };

  type ReadingRow = NonNullable<typeof readings>[number];
  const readingsByModule = new Map<string, ReadingRow[]>();
  (readings ?? []).forEach((r) => {
    const list = readingsByModule.get(r.module_id) ?? [];
    list.push(r);
    readingsByModule.set(r.module_id, list);
  });

  const totalReadings = (readings ?? []).length;
  const totalHours = (readings ?? []).reduce(
    (sum, r) => sum + (r.estimated_hours ?? 0),
    0
  );
  const primaryCount = (readings ?? []).filter(
    (r) => r.primary_or_secondary === "Primary"
  ).length;

  const programLabel = Array.isArray(course.program)
    ? course.program[0]?.title
    : course.program?.title;
  const programId = Array.isArray(course.program)
    ? course.program[0]?.id
    : course.program?.id;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        {/* ─── Header ─── */}
        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {course.code ? `${course.code} · ` : ""}
            {course.title}
          </p>
          <h1 className="text-3xl">Reading List</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{totalReadings} readings</span>
            {totalHours > 0 ? <span>{totalHours.toFixed(1)} estimated hours</span> : null}
            {primaryCount > 0 ? <span>{primaryCount} primary sources</span> : null}
            {course.credits_or_weight ? <span>{course.credits_or_weight} credits</span> : null}
            {course.level ? <span>{course.level}</span> : null}
          </div>
          <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">
            The complete bibliography for this course, ordered by unit. Each entry
            names the recommended scholarly edition and, where available, a
            verified free source.
          </p>
        </header>

        {/* ─── Units ─── */}
        {(modules ?? []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No units of study have been established for this course.
          </p>
        ) : (
          (modules ?? []).map((module) => {
            const unitReadings = readingsByModule.get(module.id) ?? [];
            const unitHours = unitReadings.reduce(
              (sum, r) => sum + (r.estimated_hours ?? 0),
              0
            );
            return (
              <section key={module.id} className="space-y-4">
                <div className="border-b border-[var(--border)] pb-2 flex flex-wrap items-baseline justify-between gap-4">
                  <h2 className="text-lg">
                    Unit {module.position + 1}: {module.title}
                  </h2>
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {unitReadings.length} reading{unitReadings.length === 1 ? "" : "s"}
                    {unitHours > 0 ? ` · ${unitHours.toFixed(1)}h` : ""}
                  </p>
                </div>

                {unitReadings.length === 0 ? (
                  <p className="text-sm text-[var(--muted)] pl-4">
                    No readings recorded for this unit.
                  </p>
                ) : (
                  <ol className="divide-y divide-[var(--border)]">
                    {unitReadings.map((r, idx) => (
                      <li key={r.id} className="py-5 space-y-2">
                        <div className="flex items-baseline gap-3">
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)] w-6 shrink-0">
                            {idx + 1}.
                          </span>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm">
                              {r.author ? (
                                <span className="font-semibold">{r.author}</span>
                              ) : null}
                              {r.author && r.title ? ", " : null}
                              {r.title ? (
                                <span className="font-serif italic">{r.title}</span>
                              ) : null}
                            </p>
                            <div className="flex flex-wrap gap-x-4 text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">
                              {r.source_type ? <span>{r.source_type}</span> : null}
                              {r.primary_or_secondary ? <span>{r.primary_or_secondary}</span> : null}
                              {r.tradition_or_era ? <span>{r.tradition_or_era}</span> : null}
                              {r.pages_or_length ? <span>{r.pages_or_length}</span> : null}
                              {r.estimated_hours ? <span>{r.estimated_hours}h</span> : null}
                            </div>
                            {r.reference_url_or_citation ? (
                              <p className="font-serif text-sm leading-relaxed text-[var(--muted)] pt-1">
                                {renderCitationWithLinks(r.reference_url_or_citation)}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            );
          })
        )}

        {/* ─── Cross-navigation ─── */}
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)] border-t border-[var(--border)] pt-6">
          <Link href={`/courses/${course.id}`} className="hover:text-[var(--text)]">Course page</Link>
          <Link href={`/courses/${course.id}/dossier`} className="hover:text-[var(--text)]">Course dossier</Link>
          {programId ? (
            <Link href={`/programs/${programId}/audit`} className="hover:text-[var(--text)]">Degree audit</Link>
          ) : null}
          {programLabel ? (
            <span className="text-[var(--muted)]">{programLabel}</span>
          ) : null}
        </nav>
      </div>
    </ProtectedShell>
  );
}
