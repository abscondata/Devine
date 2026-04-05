export const ASSIGNMENT_TYPE_ALLOWED = [
  "general",
  "essay",
  "analysis",
  "exegesis",
  "translation",
  "problem_set",
  "presentation",
  "other",
] as const;

export type AssignmentType = (typeof ASSIGNMENT_TYPE_ALLOWED)[number];

export const ASSIGNMENT_TYPE_ERROR =
  "Assignment type is required and must be a supported option.";

export const validateAssignmentType = (value: FormDataEntryValue | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { value: null, error: ASSIGNMENT_TYPE_ERROR };
  }
  if (!ASSIGNMENT_TYPE_ALLOWED.includes(raw as AssignmentType)) {
    return { value: null, error: ASSIGNMENT_TYPE_ERROR };
  }
  return { value: raw as AssignmentType, error: null };
};
