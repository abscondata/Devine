export const SEQUENCE_POSITION_ERROR =
  "Sequence position is required and must be zero or greater.";

export const parseSequencePosition = (value: FormDataEntryValue | null) => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const validateSequencePosition = (value: FormDataEntryValue | null) => {
  const parsed = parseSequencePosition(value);
  if (parsed === null || parsed < 0) {
    return { value: null, error: SEQUENCE_POSITION_ERROR };
  }
  return { value: parsed, error: null };
};
