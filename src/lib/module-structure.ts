export const STRUCTURE_POSITION_ERROR =
  "Position is required and must be zero or greater.";
export const MODULE_POSITION_CONFLICT_ERROR =
  "Module position is already used in this course.";
export const READING_POSITION_CONFLICT_ERROR =
  "Reading position is already used in this module.";

export const parseStructurePosition = (value: FormDataEntryValue | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const validateStructurePosition = (value: FormDataEntryValue | null) => {
  const parsed = parseStructurePosition(value);
  if (parsed === null || parsed < 0) {
    return { value: null, error: STRUCTURE_POSITION_ERROR };
  }
  return { value: parsed, error: null };
};
