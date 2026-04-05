import test from "node:test";
import assert from "node:assert/strict";
import {
  ASSIGNMENT_TYPE_ALLOWED,
  ASSIGNMENT_TYPE_ERROR,
  validateAssignmentType,
} from "../src/lib/assignment-structure";

test("assignment type validation accepts allowed values", () => {
  ASSIGNMENT_TYPE_ALLOWED.forEach((value) => {
    const result = validateAssignmentType(value);
    assert.equal(result.error, null);
    assert.equal(result.value, value);
  });
});

test("assignment type validation rejects empty", () => {
  const result = validateAssignmentType("");
  assert.equal(result.error, ASSIGNMENT_TYPE_ERROR);
  assert.equal(result.value, null);
});

test("assignment type validation rejects invalid value", () => {
  const result = validateAssignmentType("unknown");
  assert.equal(result.error, ASSIGNMENT_TYPE_ERROR);
  assert.equal(result.value, null);
});
