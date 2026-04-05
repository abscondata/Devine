import test from "node:test";
import assert from "node:assert/strict";
import {
  SEQUENCE_POSITION_ERROR,
  validateSequencePosition,
} from "../src/lib/course-sequence";

test("sequence position validation accepts non-negative integers", () => {
  const result = validateSequencePosition("0");
  assert.equal(result.error, null);
  assert.equal(result.value, 0);
  const resultTwo = validateSequencePosition("12");
  assert.equal(resultTwo.error, null);
  assert.equal(resultTwo.value, 12);
});

test("sequence position validation rejects empty", () => {
  const result = validateSequencePosition("");
  assert.equal(result.error, SEQUENCE_POSITION_ERROR);
  assert.equal(result.value, null);
});

test("sequence position validation rejects negative values", () => {
  const result = validateSequencePosition("-1");
  assert.equal(result.error, SEQUENCE_POSITION_ERROR);
  assert.equal(result.value, null);
});

test("sequence position validation rejects non-numeric input", () => {
  const result = validateSequencePosition("alpha");
  assert.equal(result.error, SEQUENCE_POSITION_ERROR);
  assert.equal(result.value, null);
});
