import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "@/components/protected-shell";

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ProgramWorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase.from("programs").select("id, title").eq("id", id).single();
  if (!program) notFound();

  const { data: courses } = await supabase.from("courses").select("id, title, code, sequence_position").eq("program_id", id).eq("is_active", true).order("sequence_position", { ascending: true });
  const courseIds = (courses ?? []).map((c) => c.id);
  const { data: modules } = courseIds.length ? await supabase.from("modules").select("id, course_id, title, position").in("course_id", courseIds).order("position", { ascending: true }) : { data: [] };
  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: assignments } = moduleIds.length ? await supabase.from("assignments").select("id, module_id, title, assignment_type").in("module_id", moduleIds) : { data: [] };
  const assignmentIds = (assignments ?? []).map((a) => a.id);
  const { data: submissions } = assignmentIds.length ? await supabase.from("submissions").select("id, assignment_id, version, is_final, created_at").eq("user_id", user.id).in("assignment_id", assignmentIds).order("version", { ascending: false }) : { data: [] };
  const finalSubmissionIds = (submissions ?? []).filter((s) => s.is_final).map((s) => s.id);
  const { data: critiques } = finalSubmissionIds.length ? await supabase.from("critiques").select("id, submission_id").in("submission_id", finalSubmissionIds) : { data: [] };

  const critiqueSet = new Set((critiques ?? []).map((c) => c.submission_id));
  const moduleToCourse = new Map<string, string>();
  (modules ?? []).forEach((m) => moduleToCourse.set(m.id, m.course_id));
  const coursesById = new Map((courses ?? []).map((c) => [c.id, c]));
  const modulesById = new Map((modules ?? []).map((m) => [m.id, m]));

  type WorkItem = {
    assignmentId: string;
    assignmentTitle: string;
    assignmentType: string;
    courseCode: string | null;
    courseTitle: string;
    courseSequence: number | null;
    moduleTitle: string;
    modulePosition: number;
    latestVersion: number | null;
    isFinal: boolean;
    finalDate: string | null;
    hasCritique: boolean;
    totalVersions: number;
  };

  type SubRow = NonNullable<typeof submissions>[number];
  const submissionsByAssignment = new Map<string, SubRow[]>();
  (submissions ?? []).forEach((s) => { const l = submissionsByAssignment.get(s.assignment_id) ?? []; l.push(s); submissionsByAssignment.set(s.assignment_id, l); });

  const workItems: WorkItem[] = (assignments ?? []).map((a) => {
    const courseId = moduleToCourse.get(a.module_id);
    const course = courseId ? coursesById.get(courseId) : null;
    const mod = modulesById.get(a.module_id);
    const subs = submissionsByAssignment.get(a.id) ?? [];
    const finalSub = subs.find((s) => s.is_final);
    const latest = subs[0];
    return {
      assignmentId: a.id, assignmentTitle: a.title, assignmentType: a.assignment_type,
      courseCode: course?.code ?? null, courseTitle: course?.title ?? "", courseSequence: course?.sequence_position ?? null,
      moduleTitle: mod?.title ?? "", modulePosition: mod?.position ?? 0,
      latestVersion: latest?.version ?? null, isFinal: Boolean(finalSub),
      finalDate: finalSub?.created_at ?? null, hasCritique: finalSub ? critiqueSet.has(finalSub.id) : false,
      totalVersions: subs.length,
    };
  });

  workItems.sort((a, b) => {
    const seqA = a.courseSequence ?? 9999;
    const seqB = b.courseSequence ?? 9999;
    if (seqA !== seqB) return seqA - seqB;
    if (a.modulePosition !== b.modulePosition) return a.modulePosition - b.modulePosition;
    return a.assignmentTitle.localeCompare(b.assignmentTitle);
  });

  const byCourse = new Map<string, WorkItem[]>();
  workItems.forEach((item) => { const key = item.courseCode ?? item.courseTitle; const l = byCourse.get(key) ?? []; l.push(item); byCourse.set(key, l); });

  const finalCount = workItems.filter((w) => w.isFinal).length;
  const draftCount = workItems.filter((w) => !w.isFinal && w.totalVersions > 0).length;
  const critiquedCount = workItems.filter((w) => w.hasCritique).length;
  const unsubmittedCount = workItems.filter((w) => w.totalVersions === 0).length;

  return (
    <ProtectedShell userEmail={user.email ?? null}>
      <div className="space-y-10">

        <header className="space-y-2 border-b border-[var(--border)] pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            {program.title} · Writing Dossier
          </p>
          <h1 className="text-3xl">Academic Writing Record</h1>
          <div className="flex flex-wrap items-center gap-x-4 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            <span>{workItems.length} assignments</span>
            <span>{finalCount} finalized</span>
            <span>{draftCount} in draft</span>
            <span>{unsubmittedCount} not submitted</span>
            <span>{critiquedCount} critiqued</span>
          </div>
        </header>

        {Array.from(byCourse.entries()).map(([courseKey, items]) => (
          <section key={courseKey} className="space-y-3">
            <div className="border-b border-[var(--border)] pb-2">
              <h2 className="text-lg">{items[0].courseCode ? `${items[0].courseCode} — ` : ""}{items[0].courseTitle}</h2>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <Link
                  key={item.assignmentId}
                  href={`/assignments/${item.assignmentId}`}
                  className="flex flex-wrap items-center justify-between gap-4 py-3 group"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold group-hover:text-[var(--accent-soft)]">{item.assignmentTitle}</p>
                    <p className="text-xs text-[var(--muted)]">
                      Unit {item.modulePosition + 1}: {item.moduleTitle} · {item.assignmentType.replace(/_/g, " ")}
                      {item.totalVersions > 0 ? ` · ${item.totalVersions} version${item.totalVersions === 1 ? "" : "s"}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                      {item.isFinal ? "Final" : item.totalVersions > 0 ? "Draft" : "Not submitted"}
                    </p>
                    {item.isFinal ? (
                      <p className="text-xs text-[var(--muted)]">
                        {formatDate(item.finalDate)}{item.hasCritique ? " · Critiqued" : ""}
                      </p>
                    ) : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        {!workItems.length ? (
          <p className="text-sm text-[var(--muted)]">No written work assigned yet.</p>
        ) : null}
      </div>
    </ProtectedShell>
  );
}
