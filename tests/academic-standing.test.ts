import test from "node:test";
import assert from "node:assert/strict";
import {
  getCompletionTruth,
  getReadingCounts,
  getReadingNextAction,
  getCourseStanding,
  getModuleNextAction,
  getModuleStanding,
  getCurrentWorkSelection,
  getTranscriptLiteSummary,
  buildReadinessByCourse,
  selectRecommendedNextCourse,
  getReadinessState,
  getProgramRequirementSummary,
  getStandingLabel,
  getStandingStatus,
  resolveReadingStatus,
  summarizeRequirementBlocks,
} from "../src/lib/academic-standing";
import {
  buildMissingThesisSummary,
  summarizeThesisProject,
} from "../src/lib/thesis-governance";

const reading = (status: string, title = "Reading") => ({
  id: `${status}-${title}`,
  title,
  status,
});

const block = (
  id: string,
  minimumCourses: number | null,
  minimumCredits: number | null = null
) => ({
  id,
  program_id: "program",
  minimum_courses_required: minimumCourses,
  minimum_credits_required: minimumCredits,
});

const course = (id: string, credits = 3) => ({
  id,
  credits_or_weight: credits,
});

test("all readings complete, no final submission", () => {
  const counts = getReadingCounts([reading("complete")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 1,
    finalAssignments: 0,
  });
  assert.equal(truth.isComplete, false);
  assert.equal(truth.unreadReadings, 0);
  assert.equal(truth.skippedReadings, 0);
  assert.equal(truth.missingFinals, 1);
});

test("all readings complete, final exists", () => {
  const counts = getReadingCounts([reading("complete")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 1,
    finalAssignments: 1,
  });
  assert.equal(truth.isComplete, true);
});

test("one required reading not started blocks completion", () => {
  const counts = getReadingCounts([reading("not_started")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 0,
    finalAssignments: 0,
  });
  assert.equal(truth.isComplete, false);
  assert.equal(truth.unreadReadings, 1);
});

test("one required reading skipped blocks completion", () => {
  const counts = getReadingCounts([reading("skipped")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 0,
    finalAssignments: 0,
  });
  assert.equal(truth.isComplete, false);
  assert.equal(truth.skippedReadings, 1);
});

test("final exists but skipped reading blocks completion", () => {
  const counts = getReadingCounts([reading("complete"), reading("skipped")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 1,
    finalAssignments: 1,
  });
  assert.equal(truth.isComplete, false);
  assert.equal(truth.skippedReadings, 1);
});

test("skipped-only blocker drives next action", () => {
  const next = getReadingNextAction([reading("skipped"), reading("complete")]);
  assert.ok(next);
  assert.equal(next?.kind, "skipped");
});

test("no skipped, no unread, final absent", () => {
  const counts = getReadingCounts([reading("complete")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 1,
    finalAssignments: 0,
  });
  assert.equal(truth.isComplete, false);
  assert.equal(truth.missingFinals, 1);
});

test("no skipped, no unread, final present", () => {
  const counts = getReadingCounts([reading("complete")]);
  const truth = getCompletionTruth({
    readingCounts: counts,
    totalAssignments: 1,
    finalAssignments: 1,
  });
  assert.equal(truth.isComplete, true);
});

test("resolveReadingStatus accepts allowed values", () => {
  assert.equal(resolveReadingStatus("complete"), "complete");
  assert.equal(resolveReadingStatus("skipped"), "skipped");
  assert.equal(resolveReadingStatus("not_started"), "not_started");
  assert.equal(resolveReadingStatus("in_progress"), "in_progress");
});

test("resolveReadingStatus rejects invalid values", () => {
  assert.throws(() => resolveReadingStatus("finished"), /Invalid reading status/);
});

test("resolveReadingStatus uses fallback when empty", () => {
  assert.equal(resolveReadingStatus("", "not_started"), "not_started");
});

test("resolveReadingStatus rejects empty when no fallback", () => {
  assert.throws(() => resolveReadingStatus(""), /Reading status is required/);
});

test("module standing reflects completion truth", () => {
  const moduleStanding = getModuleStanding({
    readings: [reading("complete")],
    assignments: [{ id: "a1", title: "Essay" }],
    assignmentStatus: new Map([["a1", { hasFinal: true, hasDraft: false, hasCritique: false }]]),
  });
  assert.equal(moduleStanding.completion.isComplete, true);
  assert.equal(moduleStanding.status, "completed");
});

test("module standing remains incomplete with skipped reading", () => {
  const moduleStanding = getModuleStanding({
    readings: [reading("skipped")],
    assignments: [],
    assignmentStatus: new Map(),
  });
  assert.equal(moduleStanding.completion.isComplete, false);
  assert.equal(moduleStanding.completion.skippedReadings, 1);
});

test("module next action prioritizes readings over assignments", () => {
  const next = getModuleNextAction({
    readings: [reading("not_started", "Intro")],
    assignments: [{ id: "a1", title: "Essay" }],
    assignmentStatus: new Map(),
  });
  assert.ok(next);
  assert.equal(next?.title, "Complete reading: Intro");
});

test("module next action falls back to draft assignment", () => {
  const next = getModuleNextAction({
    readings: [reading("complete")],
    assignments: [{ id: "a1", title: "Essay" }],
    assignmentStatus: new Map([["a1", { hasFinal: false, hasDraft: true, hasCritique: false }]]),
  });
  assert.ok(next);
  assert.equal(next?.title, "Finalize assignment: Essay");
});

test("course standing aggregates module completion truth", () => {
  const readingsByModule = new Map<string, { status: string }[]>();
  readingsByModule.set("m1", [reading("complete")]);
  readingsByModule.set("m2", [reading("skipped")]);
  const assignmentsByModule = new Map<string, { id: string }[]>();
  assignmentsByModule.set("m1", [{ id: "a1" }]);
  assignmentsByModule.set("m2", []);
  const standing = getCourseStanding({
    modules: [{ id: "m1" }, { id: "m2" }],
    readingsByModule,
    assignmentsByModule,
    assignmentStatus: new Map([["a1", { hasFinal: true, hasDraft: false, hasCritique: false }]]),
  });
  assert.equal(standing.completion.isComplete, false);
  assert.equal(standing.readingCounts.skippedReadings, 1);
});

test("RSYN 720 cannot complete without thesis project", () => {
  const readingsByModule = new Map<string, { status: string }[]>();
  readingsByModule.set("m1", [reading("complete")]);
  const assignmentsByModule = new Map<string, { id: string }[]>();
  assignmentsByModule.set("m1", [{ id: "a1" }]);
  const standing = getCourseStanding({
    modules: [{ id: "m1" }],
    readingsByModule,
    assignmentsByModule,
    assignmentStatus: new Map([["a1", { hasFinal: true, hasDraft: false, hasCritique: false }]]),
    thesisSummary: buildMissingThesisSummary(),
  });
  assert.equal(standing.completion.isComplete, false);
  assert.equal(standing.completion.thesisIncomplete, true);
});

test("RSYN 720 completes when thesis milestones are complete", () => {
  const readingsByModule = new Map<string, { status: string }[]>();
  readingsByModule.set("m1", [reading("complete")]);
  const assignmentsByModule = new Map<string, { id: string }[]>();
  assignmentsByModule.set("m1", [{ id: "a1" }]);
  const thesisSummary = summarizeThesisProject({
    project: {
      id: "t1",
      program_id: "p1",
      course_id: "c1",
      title: "Thesis",
      research_question: "Question",
      governing_problem: "Problem",
      thesis_claim: null,
      scope_statement: "Scope",
      status: "final_submitted",
      opened_at: null,
      candidacy_established_at: null,
      prospectus_locked_at: null,
      final_submitted_at: null,
    },
    milestones: [
      {
        id: "m1",
        thesis_project_id: "t1",
        milestone_key: "question_problem",
        title: "Question and Problem Statement",
        position: 0,
        required: true,
        completed_at: "2026-01-01T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m2",
        thesis_project_id: "t1",
        milestone_key: "scope_boundaries",
        title: "Scope and Boundaries",
        position: 1,
        required: true,
        completed_at: "2026-01-02T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m3",
        thesis_project_id: "t1",
        milestone_key: "preliminary_bibliography",
        title: "Preliminary Bibliography",
        position: 2,
        required: true,
        completed_at: "2026-01-03T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m4",
        thesis_project_id: "t1",
        milestone_key: "method_architecture_memo",
        title: "Method / Architecture Memo",
        position: 3,
        required: true,
        completed_at: "2026-01-04T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m5",
        thesis_project_id: "t1",
        milestone_key: "prospectus",
        title: "Prospectus",
        position: 4,
        required: true,
        completed_at: "2026-01-05T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m6",
        thesis_project_id: "t1",
        milestone_key: "draft_thesis",
        title: "Draft Thesis",
        position: 5,
        required: true,
        completed_at: "2026-01-06T00:00:00Z",
        submission_id: null,
      },
      {
        id: "m7",
        thesis_project_id: "t1",
        milestone_key: "final_thesis",
        title: "Final Thesis",
        position: 6,
        required: true,
        completed_at: "2026-01-07T00:00:00Z",
        submission_id: "s1",
      },
      {
        id: "m8",
        thesis_project_id: "t1",
        milestone_key: "final_synthesis_reflection",
        title: "Final Synthesis Reflection",
        position: 7,
        required: true,
        completed_at: "2026-01-08T00:00:00Z",
        submission_id: "s2",
      },
    ],
    finalSubmissionIds: new Set(["s1", "s2"]),
  });

  const standing = getCourseStanding({
    modules: [{ id: "m1" }],
    readingsByModule,
    assignmentsByModule,
    assignmentStatus: new Map([["a1", { hasFinal: true, hasDraft: false, hasCritique: false }]]),
    thesisSummary,
  });
  assert.equal(standing.completion.isComplete, true);
  assert.equal(standing.completion.thesisIncomplete, false);
});

test("standing labels are canonical", () => {
  assert.equal(getStandingLabel(getStandingStatus({ isComplete: true, completedTasks: 4 })), "Officially Complete");
  assert.equal(getStandingLabel(getStandingStatus({ isComplete: false, completedTasks: 2 })), "In Progress");
  assert.equal(getStandingLabel(getStandingStatus({ isComplete: false, completedTasks: 0 })), "Not Yet Started");
});

test("readiness state is blocked when prereqs unmet", () => {
  const readiness = getReadinessState({
    isComplete: false,
    unmetPrereqs: [{ id: "p1", title: "Foundations", code: "PHIL 501" }],
    hasPrereqs: true,
  });
  assert.equal(readiness.status, "blocked");
});

test("requirement block requires 1 course, none complete", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1)],
    mappings: [{ requirement_block_id: "b1", course_id: "c1" }],
    coursesById: new Map([["c1", course("c1")]]),
    completedCourseIds: new Set(),
  });
  assert.equal(summaries[0]?.missingCourses, 1);
  assert.equal(summaries[0]?.satisfied, false);
});

test("requirement block requires 1 course, one complete", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1)],
    mappings: [{ requirement_block_id: "b1", course_id: "c1" }],
    coursesById: new Map([["c1", course("c1")]]),
    completedCourseIds: new Set(["c1"]),
  });
  assert.equal(summaries[0]?.missingCourses, 0);
  assert.equal(summaries[0]?.satisfied, true);
});

test("requirement block requires 2 courses, one complete", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 2)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(["c1"]),
  });
  assert.equal(summaries[0]?.missingCourses, 1);
  assert.equal(summaries[0]?.satisfied, false);
});

test("requirement block requires 2 courses, two complete", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 2)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(["c1", "c2"]),
  });
  assert.equal(summaries[0]?.missingCourses, 0);
  assert.equal(summaries[0]?.satisfied, true);
});

test("extra completed courses do not distort requirement threshold", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(["c1", "c2"]),
  });
  assert.equal(summaries[0]?.missingCourses, 0);
  assert.equal(summaries[0]?.satisfied, true);
});

test("in-progress courses do not satisfy requirement blocks", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1)],
    mappings: [{ requirement_block_id: "b1", course_id: "c1" }],
    coursesById: new Map([["c1", course("c1")]]),
    completedCourseIds: new Set(),
    inProgressCourseIds: new Set(["c1"]),
  });
  assert.equal(summaries[0]?.missingCourses, 1);
  assert.equal(summaries[0]?.satisfied, false);
  assert.equal(summaries[0]?.status, "in progress");
});

test("program remains incomplete if one block is short", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(["c1"]),
  });
  const programSummary = getProgramRequirementSummary(summaries);
  assert.equal(programSummary.isComplete, false);
  assert.equal(programSummary.remainingBlocks, 1);
});

test("program completes only when all blocks are satisfied", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(["c1", "c2"]),
  });
  const programSummary = getProgramRequirementSummary(summaries);
  assert.equal(programSummary.isComplete, true);
  assert.equal(programSummary.remainingBlocks, 0);
});

test("transcript-lite recognizes no courses started", () => {
  const transcript = getTranscriptLiteSummary([
    { id: "c1", completedTasks: 0, totalTasks: 5, isComplete: false },
    { id: "c2", completedTasks: 0, totalTasks: 3, isComplete: false },
  ]);
  assert.equal(transcript.completedCourses.length, 0);
  assert.equal(transcript.inProgressCourses.length, 0);
  assert.equal(transcript.notStartedCourses.length, 2);
});

test("current work selects module with reading blocker", () => {
  const selection = getCurrentWorkSelection({
    moduleProgress: [
      {
        id: "m1",
        course_id: "c1",
        title: "Module 1",
        position: 0,
        totalTasks: 2,
        completedTasks: 1,
      },
    ],
    coursesById: new Map([["c1", { title: "Course 1" }]]),
    readingsByModule: new Map([["m1", [reading("not_started", "Intro")]]]),
    assignmentsByModule: new Map([["m1", [{ id: "a1", title: "Essay" }]]]),
    assignmentStatus: new Map(),
    finalAssignmentIds: new Set(),
  });
  assert.equal(selection.currentModule?.id, "m1");
  assert.equal(selection.nextAction?.title, "Complete reading: Intro");
});

test("recommended next prefers ready course when another is blocked", () => {
  const readiness = buildReadinessByCourse({
    courseIds: ["c1", "c2"],
    prereqsByCourse: new Map([
      ["c1", [{ id: "p1", title: "Prereq", code: "P1" }]],
      ["c2", []],
    ]),
    completionByCourse: new Map([["p1", false]]),
  });
  const blocks = [block("b1", 1), block("b2", 1)];
  const summaries = summarizeRequirementBlocks({
    blocks,
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "C1", completedTasks: 0, totalTasks: 2, isComplete: false },
      { id: "c2", code: "C2", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
  });
  assert.equal(recommended?.id, "c2");
});

test("current work favors active incomplete course over untouched future course", () => {
  const selection = getCurrentWorkSelection({
    moduleProgress: [
      {
        id: "m1",
        course_id: "c1",
        title: "Module 1",
        position: 0,
        totalTasks: 2,
        completedTasks: 1,
      },
      {
        id: "m2",
        course_id: "c2",
        title: "Module 1",
        position: 0,
        totalTasks: 2,
        completedTasks: 0,
      },
    ],
    coursesById: new Map([
      ["c1", { title: "Alpha Course" }],
      ["c2", { title: "Beta Course" }],
    ]),
    readingsByModule: new Map([
      ["m1", [reading("not_started", "Intro")]],
      ["m2", [reading("not_started", "Later")]],
    ]),
    assignmentsByModule: new Map([
      ["m1", [{ id: "a1", title: "Essay" }]],
      ["m2", [{ id: "a2", title: "Essay" }]],
    ]),
    assignmentStatus: new Map(),
    finalAssignmentIds: new Set(),
  });
  assert.equal(selection.currentModule?.id, "m1");
});

test("two ready courses prefer unsatisfied block over satisfied block", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
      { requirement_block_id: "b2", course_id: "c3" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
      ["c3", course("c3")],
    ]),
    completedCourseIds: new Set(["c3"]),
  });
  const readiness = new Map([
    ["c1", { status: "ready", reason: "Ready." }],
    ["c2", { status: "ready", reason: "Ready." }],
  ]);
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "C1", completedTasks: 0, totalTasks: 2, isComplete: false },
      { id: "c2", code: "C2", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
      { requirement_block_id: "b2", course_id: "c3" },
    ],
  });
  assert.equal(recommended?.id, "c1");
});

test("foundation-ready course outranks advanced-ready course", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [
      { ...block("b1", 1), category: "Foundations", position: 0 },
      { ...block("b2", 1), category: "Advanced", position: 1 },
    ],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const readiness = new Map([
    ["c1", { status: "ready", reason: "Ready." }],
    ["c2", { status: "ready", reason: "Ready." }],
  ]);
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "PHIL 501", completedTasks: 0, totalTasks: 2, isComplete: false },
      { id: "c2", code: "DOGM 710", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
  });
  assert.equal(recommended?.id, "c1");
});

test("earlier sequence course wins within same block", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [{ ...block("b1", 1), category: "Foundations", position: 0 }],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const readiness = new Map([
    ["c1", { status: "ready", reason: "Ready." }],
    ["c2", { status: "ready", reason: "Ready." }],
  ]);
  const recommended = selectRecommendedNextCourse({
    courses: [
      {
        id: "c1",
        code: "PHIL 501",
        sequence_position: 10,
        completedTasks: 0,
        totalTasks: 2,
        isComplete: false,
      },
      {
        id: "c2",
        code: "PHIL 610",
        sequence_position: 20,
        completedTasks: 0,
        totalTasks: 2,
        isComplete: false,
      },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
  });
  assert.equal(recommended?.id, "c1");
});

test("explicit sequence outranks code heuristics", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [{ ...block("b1", 1), category: "Foundations", position: 0 }],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const readiness = new Map([
    ["c1", { status: "ready", reason: "Ready." }],
    ["c2", { status: "ready", reason: "Ready." }],
  ]);
  const recommended = selectRecommendedNextCourse({
    courses: [
      {
        id: "c1",
        code: "ZZZ 999",
        sequence_position: 20,
        completedTasks: 0,
        totalTasks: 2,
        isComplete: false,
      },
      {
        id: "c2",
        code: "AAA 001",
        sequence_position: 10,
        completedTasks: 0,
        totalTasks: 2,
        isComplete: false,
      },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b1", course_id: "c2" },
    ],
  });
  assert.equal(recommended?.id, "c2");
});

test("active in-progress course outranks untouched ready course", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const readiness = new Map([
    ["c1", { status: "ready", reason: "Ready." }],
    ["c2", { status: "ready", reason: "Ready." }],
  ]);
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "C1", completedTasks: 1, totalTasks: 2, isComplete: false },
      { id: "c2", code: "C2", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
  });
  assert.equal(recommended?.id, "c1");
});

test("no ready course returns null", () => {
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1)],
    mappings: [{ requirement_block_id: "b1", course_id: "c1" }],
    coursesById: new Map([["c1", course("c1")]]),
    completedCourseIds: new Set(),
  });
  const recommended = selectRecommendedNextCourse({
    courses: [{ id: "c1", code: "C1", completedTasks: 0, totalTasks: 2, isComplete: false }],
    readinessByCourse: new Map([["c1", { status: "blocked", reason: "Prereqs" }]]),
    blockSummaries: summaries,
    blockMappings: [{ requirement_block_id: "b1", course_id: "c1" }],
  });
  assert.equal(recommended, null);
});
test("recommended next chooses ready course when no active course exists", () => {
  const readiness = buildReadinessByCourse({
    courseIds: ["c1", "c2"],
    prereqsByCourse: new Map(),
    completionByCourse: new Map(),
  });
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "PHIL 501", completedTasks: 0, totalTasks: 2, isComplete: false },
      { id: "c2", code: "THEO 510", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    preferredOrderCodes: ["PHIL 501", "THEO 510"],
  });
  assert.equal(recommended?.id, "c1");
});

test("blocked courses do not become recommended next", () => {
  const readiness = new Map([
    ["c1", { status: "blocked", reason: "Prereqs" }],
    ["c2", { status: "blocked", reason: "Prereqs" }],
  ]);
  const summaries = summarizeRequirementBlocks({
    blocks: [block("b1", 1), block("b2", 1)],
    mappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
    coursesById: new Map([
      ["c1", course("c1")],
      ["c2", course("c2")],
    ]),
    completedCourseIds: new Set(),
  });
  const recommended = selectRecommendedNextCourse({
    courses: [
      { id: "c1", code: "C1", completedTasks: 0, totalTasks: 2, isComplete: false },
      { id: "c2", code: "C2", completedTasks: 0, totalTasks: 2, isComplete: false },
    ],
    readinessByCourse: readiness,
    blockSummaries: summaries,
    blockMappings: [
      { requirement_block_id: "b1", course_id: "c1" },
      { requirement_block_id: "b2", course_id: "c2" },
    ],
  });
  assert.equal(recommended, null);
});

test("transcript-lite status labels align with canonical standing labels", () => {
  const transcript = getTranscriptLiteSummary([
    { id: "c1", completedTasks: 3, totalTasks: 3, isComplete: true },
    { id: "c2", completedTasks: 1, totalTasks: 3, isComplete: false },
    { id: "c3", completedTasks: 0, totalTasks: 3, isComplete: false },
  ]);
  const statusLabels = [
    getStandingLabel(getStandingStatus({ isComplete: true, completedTasks: 3 })),
    getStandingLabel(getStandingStatus({ isComplete: false, completedTasks: 1 })),
    getStandingLabel(getStandingStatus({ isComplete: false, completedTasks: 0 })),
  ];
  assert.equal(statusLabels[0], "Officially Complete");
  assert.equal(statusLabels[1], "In Progress");
  assert.equal(statusLabels[2], "Not Yet Started");
  assert.equal(transcript.completedCourses.length, 1);
  assert.equal(transcript.inProgressCourses.length, 1);
  assert.equal(transcript.notStartedCourses.length, 1);
});
