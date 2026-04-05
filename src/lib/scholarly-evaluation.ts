export type FinalSubmissionSummary = {
  label: string;
  detail: string;
};

export type CritiqueSummary = {
  label: string;
  detail: string;
};

export const getFinalSubmissionSummary = (version: number): FinalSubmissionSummary => ({
  label: `Final submission recorded (v${version})`,
  detail: `Final version ${version} is the official record.`,
});

export const getCritiqueSummary = (params: {
  hasCritique: boolean;
  submissionVersion: number;
  critiqueVersion?: number | null;
}): CritiqueSummary => {
  const { hasCritique, submissionVersion, critiqueVersion } = params;
  if (hasCritique) {
    const boundVersion = critiqueVersion ?? submissionVersion;
    return {
      label: "Critique recorded",
      detail: `Critique recorded for final version ${boundVersion}.`,
    };
  }
  return {
    label: "Critique not yet recorded",
    detail: `No critique recorded for final version ${submissionVersion}.`,
  };
};
