export const THESIS_STATUS_ALLOWED = [
  "not_started",
  "question_defined",
  "scope_defined",
  "bibliography_in_progress",
  "candidacy_established",
  "prospectus_complete",
  "draft_submitted",
  "final_submitted",
  "complete",
] as const;

export const THESIS_STATUS_LABELS: Record<(typeof THESIS_STATUS_ALLOWED)[number], string> = {
  not_started: "Not Started",
  question_defined: "Question Defined",
  scope_defined: "Scope Defined",
  bibliography_in_progress: "Bibliography In Progress",
  candidacy_established: "Candidacy Established",
  prospectus_complete: "Prospectus Complete",
  draft_submitted: "Draft Submitted",
  final_submitted: "Final Submitted",
  complete: "Complete",
};

export const THESIS_MILESTONE_DEFINITIONS = [
  { key: "question_problem", title: "Question and Problem Statement", required: true },
  { key: "scope_boundaries", title: "Scope and Boundaries", required: true },
  { key: "preliminary_bibliography", title: "Preliminary Bibliography", required: true },
  { key: "method_architecture_memo", title: "Method / Architecture Memo", required: true },
  { key: "prospectus", title: "Prospectus", required: true },
  { key: "draft_thesis", title: "Draft Thesis", required: true },
  { key: "final_thesis", title: "Final Thesis", required: true },
  { key: "final_synthesis_reflection", title: "Final Synthesis Reflection", required: true },
] as const;

export const THESIS_CANDIDACY_KEYS = [
  "question_problem",
  "scope_boundaries",
  "preliminary_bibliography",
  "method_architecture_memo",
] as const;

export type ThesisProjectLike = {
  id: string;
  program_id: string;
  course_id: string;
  title: string;
  research_question: string;
  governing_problem: string;
  thesis_claim: string | null;
  scope_statement: string;
  status: (typeof THESIS_STATUS_ALLOWED)[number] | string;
  opened_at: string | null;
  candidacy_established_at: string | null;
  prospectus_locked_at: string | null;
  final_submitted_at: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ThesisMilestoneLike = {
  id: string;
  thesis_project_id: string;
  milestone_key: string;
  title: string;
  position: number;
  required: boolean;
  completed_at: string | null;
  submission_id: string | null;
};

export type ThesisMilestoneSummary = {
  key: string;
  title: string;
  required: boolean;
  completed: boolean;
  completed_at: string | null;
  submission_id: string | null;
  hasFinalSubmission: boolean;
};

export type ThesisProjectSummary = {
  hasProject: boolean;
  status: string;
  statusLabel: string;
  milestones: ThesisMilestoneSummary[];
  requiredTotal: number;
  requiredCompleted: number;
  missingRequired: number;
  candidacyReady: boolean;
  finalThesisReady: boolean;
  finalSynthesisReady: boolean;
  isComplete: boolean;
};

const milestoneDefinitionByKey: Map<
  string,
  (typeof THESIS_MILESTONE_DEFINITIONS)[number] & { position: number }
> = new Map(
  THESIS_MILESTONE_DEFINITIONS.map((definition, index) => [
    definition.key,
    { ...definition, position: index },
  ])
);

export const getThesisStatusLabel = (status?: string | null) => {
  if (!status) return "Not Started";
  return THESIS_STATUS_LABELS[status as (typeof THESIS_STATUS_ALLOWED)[number]] ?? status;
};

const isMilestoneComplete = (
  key: string,
  milestone: ThesisMilestoneLike | undefined,
  finalSubmissionIds: Set<string>
) => {
  if (!milestone?.completed_at) return false;
  const requiresFinalSubmission =
    key === "final_thesis" || key === "final_synthesis_reflection";
  if (milestone.submission_id) {
    return finalSubmissionIds.has(milestone.submission_id);
  }
  if (requiresFinalSubmission) {
    return false;
  }
  return true;
};

export const summarizeThesisProject = (params: {
  project: ThesisProjectLike;
  milestones?: ThesisMilestoneLike[] | null;
  finalSubmissionIds?: Set<string>;
}): ThesisProjectSummary => {
  const finalSubmissionIds = params.finalSubmissionIds ?? new Set<string>();
  const milestoneByKey = new Map(
    (params.milestones ?? []).map((milestone) => [milestone.milestone_key, milestone])
  );

  const milestones: ThesisMilestoneSummary[] = THESIS_MILESTONE_DEFINITIONS.map(
    (definition) => {
      const milestone = milestoneByKey.get(definition.key);
      const completed = isMilestoneComplete(
        definition.key,
        milestone,
        finalSubmissionIds
      );
      return {
        key: definition.key,
        title: milestone?.title ?? definition.title,
        required: milestone?.required ?? definition.required,
        completed,
        completed_at: milestone?.completed_at ?? null,
        submission_id: milestone?.submission_id ?? null,
        hasFinalSubmission: milestone?.submission_id
          ? finalSubmissionIds.has(milestone.submission_id)
          : false,
      };
    }
  );

  const requiredMilestones = milestones.filter((milestone) => milestone.required);
  const requiredCompleted = requiredMilestones.filter((milestone) => milestone.completed)
    .length;
  const requiredTotal = requiredMilestones.length;
  const missingRequired = Math.max(0, requiredTotal - requiredCompleted);

  const candidacyReady = THESIS_CANDIDACY_KEYS.every((key) => {
    const milestone = milestones.find((entry) => entry.key === key);
    return milestone?.completed;
  });

  const finalThesisReady =
    milestones.find((entry) => entry.key === "final_thesis")?.completed ?? false;
  const finalSynthesisReady =
    milestones.find((entry) => entry.key === "final_synthesis_reflection")?.completed ??
    false;

  return {
    hasProject: true,
    status: params.project.status ?? "not_started",
    statusLabel: getThesisStatusLabel(params.project.status),
    milestones,
    requiredTotal,
    requiredCompleted,
    missingRequired,
    candidacyReady,
    finalThesisReady,
    finalSynthesisReady,
    isComplete: requiredTotal > 0 && missingRequired === 0,
  };
};

export const deriveThesisStatus = (
  summary: ThesisProjectSummary
): (typeof THESIS_STATUS_ALLOWED)[number] => {
  if (!summary.hasProject) return "not_started";
  const milestoneCompleted = (key: string) =>
    summary.milestones.find((entry) => entry.key === key)?.completed ?? false;

  if (summary.finalSynthesisReady) return "complete";
  if (summary.finalThesisReady) return "final_submitted";
  if (milestoneCompleted("draft_thesis")) return "draft_submitted";
  if (milestoneCompleted("prospectus")) return "prospectus_complete";
  if (summary.candidacyReady) return "candidacy_established";
  if (milestoneCompleted("preliminary_bibliography")) return "bibliography_in_progress";
  if (milestoneCompleted("scope_boundaries")) return "scope_defined";
  if (milestoneCompleted("question_problem")) return "question_defined";
  return "not_started";
};

export const buildMissingThesisSummary = (): ThesisProjectSummary => ({
  hasProject: false,
  status: "not_started",
  statusLabel: getThesisStatusLabel("not_started"),
  milestones: THESIS_MILESTONE_DEFINITIONS.map((definition) => ({
    key: definition.key,
    title: definition.title,
    required: definition.required,
    completed: false,
    completed_at: null,
    submission_id: null,
    hasFinalSubmission: false,
  })),
  requiredTotal: THESIS_MILESTONE_DEFINITIONS.length,
  requiredCompleted: 0,
  missingRequired: THESIS_MILESTONE_DEFINITIONS.length,
  candidacyReady: false,
  finalThesisReady: false,
  finalSynthesisReady: false,
  isComplete: false,
});

export const buildThesisSummaryByCourseId = (params: {
  projects?: ThesisProjectLike[] | null;
  milestones?: ThesisMilestoneLike[] | null;
  finalSubmissionIds?: Set<string>;
}) => {
  const map = new Map<string, ThesisProjectSummary>();
  const milestonesByProject = new Map<string, ThesisMilestoneLike[]>();
  (params.milestones ?? []).forEach((milestone) => {
    const list = milestonesByProject.get(milestone.thesis_project_id) ?? [];
    list.push(milestone);
    milestonesByProject.set(milestone.thesis_project_id, list);
  });
  (params.projects ?? []).forEach((project) => {
    map.set(
      project.course_id,
      summarizeThesisProject({
        project,
        milestones: milestonesByProject.get(project.id) ?? [],
        finalSubmissionIds: params.finalSubmissionIds,
      })
    );
  });
  return map;
};

export const getMilestoneDefinition = (key: string) =>
  milestoneDefinitionByKey.get(key) ?? null;
