export const REQUIREMENT_BLOCK_ERROR =
  "Courses must be assigned to at least one requirement block in their program.";

export const validateRequirementBlockSelection = (params: {
  selectedIds: string[];
  allowedIds: Set<string>;
}) => {
  if (!params.selectedIds.length) {
    return { valid: false, error: REQUIREMENT_BLOCK_ERROR };
  }
  const invalid = params.selectedIds.filter((id) => !params.allowedIds.has(id));
  if (invalid.length) {
    return {
      valid: false,
      error:
        "Selected requirement blocks do not match the course program. Please reselect.",
    };
  }
  return { valid: true, error: null };
};
