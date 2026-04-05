import test from "node:test";
import assert from "node:assert/strict";
import {
  STRUCTURE_POSITION_ERROR,
  validateStructurePosition,
} from "../src/lib/module-structure";

test("structure position accepts non-negative integers", () => {
  const result = validateStructurePosition("0");
  assert.equal(result.error, null);
  assert.equal(result.value, 0);
  const resultTwo = validateStructurePosition("3");
  assert.equal(resultTwo.error, null);
  assert.equal(resultTwo.value, 3);
});

test("structure position rejects empty input", () => {
  const result = validateStructurePosition("");
  assert.equal(result.error, STRUCTURE_POSITION_ERROR);
  assert.equal(result.value, null);
});

test("structure position rejects negative input", () => {
  const result = validateStructurePosition("-2");
  assert.equal(result.error, STRUCTURE_POSITION_ERROR);
  assert.equal(result.value, null);
});

test("structure position rejects non-numeric input", () => {
  const result = validateStructurePosition("alpha");
  assert.equal(result.error, STRUCTURE_POSITION_ERROR);
  assert.equal(result.value, null);
});
