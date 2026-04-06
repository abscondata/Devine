import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildAssignmentStatusMap,
  getCourseStanding,
  getStandingStatus,
  getModuleStanding,
} from "@/lib/academic-standing";
import {
  buildMissingThesisSummary,
  buildThesisSummaryByCourseId,
} from "@/lib/thesis-governance";
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default async function CourseDossierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, description, code, credits_or_weight, level, learning_outcomes, syllabus, status, program:programs(id, title), domain:domains(id, title)")
    .eq("id", id)
    .single();
  if (!course) notFound();

  const { data: requirementMappings } = await supabase.from("course_requirement_blocks").select("requirement_block:requirement_block_id(id, title, category)").eq("course_id", id);
  const requirementBlocks = (requirementMappings ?? []).map((item) => item.requirement_block).filter(Boolean);

  const { data: prereqs } = await supabase.from("course_prerequisites").select("prerequisite:prerequisite_course_id(id, title, code)").eq("course_id", id);
  const prerequisiteCourses = (prereqs ?? []).map((p) => p.prerequisite).filter(Boolean);

  const { data: modules } = await supabase.from("modules").select("id, title, overview, position").eq("course_id", id).order("position", { ascending: true });
  const moduleIds = (modules ?? []).map((m) => m.id);

  const { data: readings } = moduleIds.length
    ? await supabase.from("readings").select("id, module_id, title, author, source_type, primary_or_secondary, tradition_or_era, pages_or_length, estimated_hours, status, position").in("module_id", moduleIds).order("position", { ascending: true })
    : { data: [] };

  const { data: assignments } = moduleIds.length
    ? await supabase.from("assignments").select("id, module_id, title, assignment_type").in("module_id", moduleIds)
    : { data: [] };

  const aIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = aIds.length
    ? await supabase.from("submissions").select("id, assignment_id, version, is_final, created_at").eq("user_id", user.id).in("assignment_id", aIds).order("version", { ascending: false })
    : { data: [] };
  const finalSubs = (submissions ?? []).filter((s) => s.is_final);
  const finalSubIds = finalSubs.map((s) => s.id);
  const { data: critiques } = finalSubIds.length
    ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubIds)
    : { data: [] };

  const { data: thesisProjects } = await supabase.from("thesis_projects").select("id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at").eq("course_id", id);
  const tpIds = (thesisProjects ?? []).map((p) => p.id);
  const { data: thesisMilestones } = tpIds.length
    ? await supabase.from("thesis_milestones").select("id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id").in("thesis_project_id", tpIds)
    : { data: [] };

  const assignmentStatus = buildAssignmentStatusMap(submissions ?? [], critiques ?? []);
  const thesisSummaryByCourseId = buildThesisSummaryByCourseId({ projects: thesisProjects ?? [], milestones: thesisMilestones ?? [], finalSubmissionIds: new Set(finalSubIds) });

  type RR = NonNullable<typeof readings>[number];
  type AR = NonNullable<typeof assignments>[number];
  const readingsByModule = new Map<string, RR[]>();
  (readings ?? []).forEach((r) => { const l = readingsByModule.get(r.module_id) ?? []; l.push(r); readingsByModule.set(r.module_id, l); });
  const assignmentsByModule = new Map<string, AR[]>();
  (assignments ?? []).forEach((a) => { const l = assignmentsByModule.get(a.module_id) ?? []; l.push(a); assignmentsByModule.set(a.module_id, l); });

  const critiqueSet = new Set((critiques ?? []).map((c) => c.submission_id));
  type SubRow = NonNullable<typeof submissions>[number];
  const subsByAssignment = new Map<string, SubRow[]>();
  (submissions ?? []).forEach((s) => { const l = subsByAssignment.get(s.assignment_id) ?? []; l.push(s); subsByAssignment.set(s.assignment_id, l); });

  const thesisSummary = course.code === "RSYN 720" ? thesisSummaryByCourseId.get(course.id) ?? buildMissingThesisSummary() : null;
  const standing = getCourseStanding({ modules: modules ?? [], readingsByModule, assignmentsByModule, assignmentStatus, thesisSummary });
  const status = getStandingStatus(standing.completion);
  const isComplete = status === "completed";

  const totalReadings = (readings ?? []).length;
  const completedReadings = (readings ?? []).filter((r) => r.status === "complete").length;
  const totalHours = (readings ?? []).reduce((s, r) => s + (r.estimated_hours ?? 0), 0);
  const totalFinals = finalSubs.length;
  const totalCritiqued = finalSubs.filter((s) => critiqueSet.has(s.id)).length;
  const now = formatDate(new Date().toISOString());

  // Group readings by source type for materials section
  const sourceOrder = ["Primary text", "Magisterial text", "Scripture", "Patristic text", "Conciliar text", "Historical text", "Secondary text"];
  const bySource = new Map<string, RR[]>();
  (readings ?? []).forEach((r) => { const k = r.source_type ?? "Other"; const l = bySource.get(k) ?? []; l.push(r); bySource.set(k, l); });
  const seen = new Set<string>();
  const uniqueReadings = (readings ?? []).filter((r) => { const k = `${r.author}|${r.title}`; if (seen.has(k)) return false; seen.add(k); return true; });
  const orderedSources = [...sourceOrder.filter((s) => bySource.has(s)), ...Array.from(bySource.keys()).filter((s) => !sourceOrder.includes(s))];

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-8 max-w-4xl print:max-w-none">

        <header className="space-y-4 border-b border-[var(--border)] pb-6">
          <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[var(--muted)] print:hidden">
            <Link href={`/courses/${course.id}`}>Course</Link>
          </div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
            {course.program?.title ?? "Program"} · Course Dossier
          </p>
          <h1 className="text-3xl">{course.code ? `${course.code} — ` : ""}{course.title}</h1>
          <div className="flex flex-wrap gap-x-6 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {course.level ? <span>{course.level}</span> : null}
            {course.credits_or_weight ? <span>{course.credits_or_weight} credits</span> : null}
            {course.domain?.title ? <span>{course.domain.title}</span> : null}
            <span>{isComplete ? "Complete" : status === "in_progress" ? "In progress" : "Not started"}</span>
          </div>
          <p className="text-xs text-[var(--muted)]">Generated {now}</p>
        </header>

        {/* Description */}
        {course.description ? (
          <section className="space-y-2">
            <h2 className="text-lg">Course Description</h2>
            <p className="font-serif text-sm leading-relaxed text-[var(--muted)]">{course.description}</p>
          </section>
        ) : null}

        {/* Summary */}
        <section className="space-y-3">
          <h2 className="text-lg">Academic Summary</h2>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              <span>{(modules ?? []).length} units</span>
              <span>Readings: {completedReadings} of {totalReadings} complete</span>
              <span>Estimated: {totalHours.toFixed(1)}h</span>
              <span>Final submissions: {totalFinals} of {(assignments ?? []).length}</span>
              <span>Critiqued: {totalCritiqued}</span>
            </div>
            {prerequisiteCourses.length ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Prerequisites</p>
                <p className="text-sm text-[var(--muted)]">{prerequisiteCourses.map((p) => p.code ? `${p.code} — ${p.title}` : p.title).join("; ")}</p>
              </div>
            ) : null}
            {requirementBlocks.length ? (
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Satisfies</p>
                <p className="text-sm text-[var(--muted)]">{requirementBlocks.map((b) => b.title).join("; ")}</p>
              </div>
            ) : null}
          </div>
        </section>

        {/* Required materials */}
        {uniqueReadings.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg">Required Materials</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] divide-y divide-[var(--border)]">
              {orderedSources.map((sourceType) => {
                const seenInGroup = new Set<string>();
                const items = (bySource.get(sourceType) ?? []).filter((r) => { const k = `${r.author}|${r.title}`; if (seenInGroup.has(k)) return false; seenInGroup.add(k); return true; });
                if (!items.length) return null;
                return (
                  <div key={sourceType} className="p-5 space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">{sourceType}</p>
                    <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                      {items.map((r) => (
                        <li key={r.id}>
                          {r.author ? <span className="font-semibold">{r.author}</span> : null}
                          {r.author && r.title ? ", " : null}
                          {r.title ? <span className="font-serif italic">{r.title}</span> : null}
                          {r.pages_or_length ? ` (${r.pages_or_length})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {/* Unit-by-unit record */}
        {(modules ?? []).map((mod) => {
          const unitReadings = readingsByModule.get(mod.id) ?? [];
          const unitAssignments = assignmentsByModule.get(mod.id) ?? [];
          return (
            <section key={mod.id} className="space-y-3">
              <div className="border-b border-[var(--border)] pb-2">
                <h2 className="text-base font-semibold">Unit {mod.position + 1}: {mod.title}</h2>
              </div>
              {unitReadings.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Readings</p>
                  <ul className="space-y-0.5 text-sm text-[var(--muted)]">
                    {unitReadings.sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((r) => (
                      <li key={r.id} className={r.status === "complete" ? "line-through opacity-50" : ""}>
                        {r.author ? `${r.author}, ` : ""}{r.title}
                        <span className="text-xs uppercase tracking-[0.2em]"> · {r.status === "complete" ? "Complete" : r.status?.replace(/_/g, " ") ?? ""}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {unitAssignments.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Written work</p>
                  <ul className="space-y-1 text-sm">
                    {unitAssignments.map((a) => {
                      const aStatus = assignmentStatus.get(a.id);
                      const subs = subsByAssignment.get(a.id) ?? [];
                      const finalSub = subs.find((s) => s.is_final);
                      const hasCrit = finalSub ? critiqueSet.has(finalSub.id) : false;
                      return (
                        <li key={a.id} className={aStatus?.hasFinal ? "text-[var(--muted)]" : "font-semibold"}>
                          {a.title}
                          <span className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            {" "}· {a.assignment_type.replace(/_/g, " ")}
                            {aStatus?.hasFinal ? ` · Final v${finalSub?.version} · ${formatDate(finalSub?.created_at)}` : aStatus?.hasDraft ? ` · Draft v${subs[0]?.version}` : " · Not submitted"}
                            {hasCrit ? " · Critiqued" : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </section>
          );
        })}

        {/* Syllabus / outcomes */}
        {(course.syllabus || course.learning_outcomes) ? (
          <section className="space-y-3">
            <h2 className="text-lg">Course Information</h2>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
              {course.syllabus ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Syllabus</p>
                  <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.syllabus}</p>
                </div>
              ) : null}
              {course.learning_outcomes ? (
                <div className="space-y-1">
                  <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Learning outcomes</p>
                  <p className="text-sm text-[var(--muted)] whitespace-pre-wrap">{course.learning_outcomes}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        <footer className="border-t border-[var(--border)] pt-4 text-xs text-[var(--muted)]">
          <p>{course.program?.title ?? "Program"} · {course.code} · Course dossier generated {now}</p>
        </footer>
      </div>
    </ProtectedShell>
  );
}
