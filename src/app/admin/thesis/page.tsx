import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createThesisProject } from "@/lib/actions";
import { FormalDocumentLayout, DocumentSection } from "@/components/formal-document";
import { getThesisStatusLabel } from "@/lib/thesis-governance";

function formatDate(value?: string | null) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function ThesisAdminIndexPage() {
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

  type RsynCourse = {
    id: string;
    program_id: string;
    code: string | null;
    title: string;
  };

  type ThesisProjectSummary = {
    id: string;
    program_id: string;
    course_id: string;
    title: string;
    status: string;
    opened_at: string | null;
  };

  const { data: rsynCoursesRaw } = programIds.length
    ? await supabase
        .from("courses")
        .select("id, program_id, code, title")
        .in("program_id", programIds)
        .eq("code", "RSYN 720")
    : { data: [] as RsynCourse[] };
  const rsynCourses: RsynCourse[] = rsynCoursesRaw ?? [];

  const { data: thesisProjectsRaw } = programIds.length
    ? await supabase
        .from("thesis_projects")
        .select("id, program_id, course_id, title, status, opened_at")
        .in("program_id", programIds)
    : { data: [] as ThesisProjectSummary[] };
  const thesisProjects: ThesisProjectSummary[] = thesisProjectsRaw ?? [];

  const rsynByProgram = new Map<string, RsynCourse>();
  (rsynCourses ?? []).forEach((course) => rsynByProgram.set(course.program_id, course));

  const thesisByProgram = new Map<string, ThesisProjectSummary>();
  (thesisProjects ?? []).forEach((project) => thesisByProgram.set(project.program_id, project));

  const recordDate = formatDate(new Date().toISOString());

  return (
    <FormalDocumentLayout
      documentType="Thesis Administration"
      title="RSYN 720 Governance"
      description="Create and steward thesis projects for the Research and Synthesis capstone."
      recordDate={recordDate}
    >
      <DocumentSection title="Eligible Programs">
        {programs.length ? (
          <div className="space-y-6">
            {programs.map((program) => {
              const rsynCourse = rsynByProgram.get(program.id);
              const thesisProject = thesisByProgram.get(program.id);
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

                  {rsynCourse ? (
                    <div className="text-sm text-[var(--muted)]">
                      RSYN 720 course: {rsynCourse.title}
                    </div>
                  ) : (
                    <div className="text-sm text-[var(--muted)]">
                      RSYN 720 is not yet seeded for this program.
                    </div>
                  )}

                  {thesisProject ? (
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--muted)] space-y-2">
                      <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                        Active Thesis Project
                      </p>
                      <p className="text-[var(--text)]">{thesisProject.title}</p>
                      <p>Status: {getThesisStatusLabel(thesisProject.status)}</p>
                      <p>Opened: {formatDate(thesisProject.opened_at)}</p>
                      <a
                        href={`/admin/thesis/${thesisProject.id}`}
                        className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]"
                      >
                        Open thesis dossier
                      </a>
                    </div>
                  ) : rsynCourse ? (
                    <form action={createThesisProject} className="space-y-3">
                      <input type="hidden" name="programId" value={program.id} />
                      <input type="hidden" name="courseId" value={rsynCourse.id} />
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="space-y-1">
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            Thesis Title
                          </label>
                          <input
                            name="title"
                            required
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                            Research Question
                          </label>
                          <input
                            name="researchQuestion"
                            required
                            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Governing Problem
                        </label>
                        <textarea
                          name="governingProblem"
                          required
                          rows={3}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Thesis Claim (Optional)
                        </label>
                        <textarea
                          name="thesisClaim"
                          rows={2}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                          Scope Statement
                        </label>
                        <textarea
                          name="scopeStatement"
                          required
                          rows={3}
                          className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        className="rounded-md border border-[var(--border)] px-4 py-2 text-xs uppercase tracking-[0.2em]"
                      >
                        Create thesis project
                      </button>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-sm text-[var(--muted)]">
            No programs available for thesis administration.
          </div>
        )}
      </DocumentSection>
    </FormalDocumentLayout>
  );
}
