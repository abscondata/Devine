import test from "node:test";
import assert from "node:assert/strict";
import {
  REQUIREMENT_BLOCK_ERROR,
  validateRequirementBlockSelection,
} from "../src/lib/course-requirements";

test("requirement block selection requires at least one block", () => {
  const result = validateRequirementBlockSelection({
    selectedIds: [],
    allowedIds: new Set(["b1"]),
  });
  assert.equal(result.valid, false);
  assert.equal(result.error, REQUIREMENT_BLOCK_ERROR);
});

test("requirement block selection rejects mismatched program blocks", () => {
  const result = validateRequirementBlockSelection({
    selectedIds: ["b2"],
    allowedIds: new Set(["b1"]),
  });
  assert.equal(result.valid, false);
});

test("requirement block selection accepts valid blocks", () => {
  const result = validateRequirementBlockSelection({
    selectedIds: ["b1"],
    allowedIds: new Set(["b1", "b2"]),
  });
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});
