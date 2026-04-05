export const READING_STATUS_ALLOWED = [
  "not_started",
  "in_progress",
  "complete",
  "skipped",
] as const;

export type ReadingStatus = (typeof READING_STATUS_ALLOWED)[number] | string;
export type ReadingStatusValue = (typeof READING_STATUS_ALLOWED)[number];

export type ReadingLike = {
  id?: string;
  title?: string | null;
  status?: ReadingStatus | null;
};

export type ReadingCounts = {
  totalReadings: number;
  completedReadings: number;
  skippedReadings: number;
  incompleteReadings: number;
};

export type ReadingNextAction = {
  kind: "incomplete" | "skipped";
  reading: ReadingLike;
};

export const READING_STATUS_COMPLETE: ReadingStatusValue = "complete";
export const READING_STATUS_SKIPPED: ReadingStatusValue = "skipped";

export const isReadingStatusAllowed = (status?: string | null) =>
  !!status && (READING_STATUS_ALLOWED as readonly string[]).includes(status);

export const resolveReadingStatus = (
  input?: string | null,
  fallback?: ReadingStatusValue
): ReadingStatusValue => {
  const normalized = String(input ?? "").trim();
  if (!normalized) {
    if (fallback) {
      return fallback;
    }
    throw new Error("Reading status is required.");
  }
  if (!isReadingStatusAllowed(normalized)) {
    throw new Error("Invalid reading status.");
  }
  return normalized as ReadingStatusValue;
};

export const isReadingComplete = (status?: string | null) =>
  status === READING_STATUS_COMPLETE;
export const isReadingSkipped = (status?: string | null) =>
  status === READING_STATUS_SKIPPED;
export const isReadingIncomplete = (status?: string | null) =>
  !isReadingComplete(status) && !isReadingSkipped(status);

export const initReadingCounts = (): ReadingCounts => ({
  totalReadings: 0,
  completedReadings: 0,
  skippedReadings: 0,
  incompleteReadings: 0,
});

export const addReadingToCounts = (
  counts: ReadingCounts,
  reading: ReadingLike
) => {
  counts.totalReadings += 1;
  if (isReadingComplete(reading.status)) {
    counts.completedReadings += 1;
    return;
  }
  if (isReadingSkipped(reading.status)) {
    counts.skippedReadings += 1;
    return;
  }
  counts.incompleteReadings += 1;
};

export const getReadingCounts = (readings?: ReadingLike[] | null) => {
  const counts = initReadingCounts();
  (readings ?? []).forEach((reading) => addReadingToCounts(counts, reading));
  return counts;
};

export const getReadingBlockers = (readings?: ReadingLike[] | null) => {
  const counts = getReadingCounts(readings);
  const firstIncomplete = (readings ?? []).find((reading) =>
    isReadingIncomplete(reading.status)
  );
  const firstSkipped = (readings ?? []).find((reading) =>
    isReadingSkipped(reading.status)
  );
  return {
    unreadReadings: counts.incompleteReadings,
    skippedReadings: counts.skippedReadings,
    firstIncomplete,
    firstSkipped,
    counts,
  };
};

export const getReadingNextAction = (
  readings?: ReadingLike[] | null
): ReadingNextAction | null => {
  const firstIncomplete = (readings ?? []).find((reading) =>
    isReadingIncomplete(reading.status)
  );
  if (firstIncomplete) {
    return { kind: "incomplete", reading: firstIncomplete };
  }
  const firstSkipped = (readings ?? []).find((reading) =>
    isReadingSkipped(reading.status)
  );
  if (firstSkipped) {
    return { kind: "skipped", reading: firstSkipped };
  }
  return null;
};

export const getCompletionTruth = (params: {
  readingCounts: ReadingCounts;
  totalAssignments: number;
  finalAssignments: number;
}) => {
  const { readingCounts, totalAssignments, finalAssignments } = params;
  const totalTasks = readingCounts.totalReadings + totalAssignments;
  const completedTasks = readingCounts.completedReadings + finalAssignments;
  const missingFinals = Math.max(0, totalAssignments - finalAssignments);
  const unreadReadings = readingCounts.incompleteReadings;
  const skippedReadings = readingCounts.skippedReadings;
  const isComplete =
    totalTasks > 0 &&
    unreadReadings === 0 &&
    skippedReadings === 0 &&
    missingFinals === 0;

  return {
    totalTasks,
    completedTasks,
    missingFinals,
    unreadReadings,
    skippedReadings,
    isComplete,
  };
};

export type AssignmentLike = {
  id: string;
  title?: string | null;
};

export type SubmissionLike = {
  id: string;
  assignment_id: string;
  is_final: boolean;
};

export type CritiqueLike = {
  submission_id: string;
};

export type AssignmentStatus = {
  hasFinal: boolean;
  hasDraft: boolean;
  hasCritique: boolean;
};

export type AssignmentSummary = {
  totalAssignments: number;
  finalAssignments: number;
  draftAssignments: number;
  critiquedFinals: number;
};

export type StandingStatus = "completed" | "in_progress" | "not_started";

export type ReadinessStatus = "ready" | "blocked" | "completed";

export type ReadinessState = {
  status: ReadinessStatus;
  reason: string;
};

export type NextAction = {
  title: string;
  reason: string;
};

export const buildAssignmentStatusMap = (
  submissions?: SubmissionLike[] | null,
  critiques?: CritiqueLike[] | null
) => {
  const critiqueSet = new Set(
    (critiques ?? []).map((critique) => critique.submission_id)
  );
  const assignmentStatus = new Map<string, AssignmentStatus>();
  (submissions ?? []).forEach((submission) => {
    const current = assignmentStatus.get(submission.assignment_id) ?? {
      hasFinal: false,
      hasDraft: false,
      hasCritique: false,
    };
    if (submission.is_final) {
      current.hasFinal = true;
      if (critiqueSet.has(submission.id)) {
        current.hasCritique = true;
      }
    } else {
      current.hasDraft = true;
    }
    assignmentStatus.set(submission.assignment_id, current);
  });
  return assignmentStatus;
};

export const getFinalAssignmentSet = (assignmentStatus: Map<string, AssignmentStatus>) =>
  new Set(
    Array.from(assignmentStatus.entries())
      .filter(([, status]) => status.hasFinal)
      .map(([assignmentId]) => assignmentId)
  );

export const summarizeAssignments = (
  assignments?: AssignmentLike[] | null,
  assignmentStatus?: Map<string, AssignmentStatus> | null
): AssignmentSummary => {
  const summary: AssignmentSummary = {
    totalAssignments: 0,
    finalAssignments: 0,
    draftAssignments: 0,
    critiquedFinals: 0,
  };
  (assignments ?? []).forEach((assignment) => {
    summary.totalAssignments += 1;
    const status = assignmentStatus?.get(assignment.id);
    if (status?.hasFinal) {
      summary.finalAssignments += 1;
      if (status.hasCritique) {
        summary.critiquedFinals += 1;
      }
      return;
    }
    if (status?.hasDraft) {
      summary.draftAssignments += 1;
    }
  });
  return summary;
};

export const getStandingStatus = (completion: {
  isComplete: boolean;
  completedTasks: number;
}): StandingStatus => {
  if (completion.isComplete) return "completed";
  if (completion.completedTasks > 0) return "in_progress";
  return "not_started";
};

export const getStandingLabel = (status: StandingStatus) => {
  if (status === "completed") return "Officially Complete";
  if (status === "in_progress") return "In Progress";
  return "Not Yet Started";
};

export const getReadinessState = (params: {
  isComplete: boolean;
  unmetPrereqs: { id: string; title: string; code: string | null }[];
  hasPrereqs: boolean;
}): ReadinessState => {
  const { isComplete, unmetPrereqs, hasPrereqs } = params;
  if (isComplete) {
    return { status: "completed", reason: "Course completed." };
  }
  if (!hasPrereqs) {
    return { status: "ready", reason: "No prerequisites." };
  }
  if (unmetPrereqs.length) {
    return {
      status: "blocked",
      reason: `Prerequisites incomplete: ${unmetPrereqs
        .map((prereq) => (prereq.code ? `${prereq.code} — ` : "") + prereq.title)
        .join(", ")}`,
    };
  }
  return { status: "ready", reason: "Prerequisites satisfied." };
};

export const getModuleStanding = (params: {
  readings?: ReadingLike[] | null;
  assignments?: AssignmentLike[] | null;
  assignmentStatus?: Map<string, AssignmentStatus> | null;
}) => {
  const readingCounts = getReadingCounts(params.readings ?? []);
  const assignmentSummary = summarizeAssignments(
    params.assignments ?? [],
    params.assignmentStatus ?? null
  );
  const completion = getCompletionTruth({
    readingCounts,
    totalAssignments: assignmentSummary.totalAssignments,
    finalAssignments: assignmentSummary.finalAssignments,
  });
  const status = getStandingStatus(completion);
  return {
    readingCounts,
    assignmentSummary,
    completion,
    status,
  };
};

export const getCourseStanding = (params: {
  modules: { id: string }[];
  readingsByModule: Map<string, ReadingLike[] | null | undefined>;
  assignmentsByModule: Map<string, AssignmentLike[] | null | undefined>;
  assignmentStatus: Map<string, AssignmentStatus>;
  thesisSummary?: import("./thesis-governance").ThesisProjectSummary | null;
}) => {
  const readingCounts = initReadingCounts();
  const assignmentSummary: AssignmentSummary = {
    totalAssignments: 0,
    finalAssignments: 0,
    draftAssignments: 0,
    critiquedFinals: 0,
  };
  params.modules.forEach((module) => {
    const moduleReadings = params.readingsByModule.get(module.id) ?? [];
    const moduleAssignments = params.assignmentsByModule.get(module.id) ?? [];
    const moduleReadingCounts = getReadingCounts(moduleReadings);
    readingCounts.totalReadings += moduleReadingCounts.totalReadings;
    readingCounts.completedReadings += moduleReadingCounts.completedReadings;
    readingCounts.skippedReadings += moduleReadingCounts.skippedReadings;
    readingCounts.incompleteReadings += moduleReadingCounts.incompleteReadings;
    const moduleSummary = summarizeAssignments(
      moduleAssignments,
      params.assignmentStatus
    );
    assignmentSummary.totalAssignments += moduleSummary.totalAssignments;
    assignmentSummary.finalAssignments += moduleSummary.finalAssignments;
    assignmentSummary.draftAssignments += moduleSummary.draftAssignments;
    assignmentSummary.critiquedFinals += moduleSummary.critiquedFinals;
  });
  const completion = getCompletionTruth({
    readingCounts,
    totalAssignments: assignmentSummary.totalAssignments,
    finalAssignments: assignmentSummary.finalAssignments,
  });
  const thesisSummary = params.thesisSummary ?? null;
  const thesisIncomplete = Boolean(thesisSummary && !thesisSummary.isComplete);
  const completionWithThesis = {
    ...completion,
    isComplete: completion.isComplete && !thesisIncomplete,
    thesisIncomplete,
  };
  return {
    readingCounts,
    assignmentSummary,
    completion: completionWithThesis,
    status: getStandingStatus(completionWithThesis),
    thesis: thesisSummary,
  };
};

export const getModuleNextAction = (params: {
  readings?: ReadingLike[] | null;
  assignments?: AssignmentLike[] | null;
  assignmentStatus?: Map<string, AssignmentStatus> | null;
}): NextAction | null => {
  const readingAction = getReadingNextAction(params.readings ?? []);
  if (readingAction) {
    return readingAction.kind === "incomplete"
      ? {
          title: `Complete reading: ${readingAction.reading.title}`,
          reason: "Unread readings block module completion.",
        }
      : {
          title: `Resolve skipped reading: ${readingAction.reading.title}`,
          reason:
            "Skipped readings do not count toward completion and must be completed.",
        };
  }
  const assignmentStatus = params.assignmentStatus ?? new Map();
  const assignments = params.assignments ?? [];
  const firstDraftOnlyAssignment = assignments.find((assignment) => {
    const status = assignmentStatus.get(assignment.id);
    return status?.hasDraft && !status?.hasFinal;
  });
  if (firstDraftOnlyAssignment) {
    return {
      title: `Finalize assignment: ${firstDraftOnlyAssignment.title}`,
      reason: "Drafts do not count toward official completion.",
    };
  }
  const firstMissingAssignment = assignments.find((assignment) => {
    const status = assignmentStatus.get(assignment.id);
    return !status?.hasDraft && !status?.hasFinal;
  });
  if (firstMissingAssignment) {
    return {
      title: `Draft assignment: ${firstMissingAssignment.title}`,
      reason: "Assignments require a final submission to complete the module.",
    };
  }
  return null;
};

export type RequirementBlockLike = {
  id: string;
  program_id: string;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  minimum_courses_required?: number | null;
  minimum_credits_required?: number | null;
  position?: number | null;
};

export type CourseLike = {
  id: string;
  title?: string | null;
  code?: string | null;
  credits_or_weight?: number | null;
};

export type RequirementBlockMappingLike = {
  requirement_block_id: string;
  course_id: string;
};

export type RequirementBlockSummary = {
  block: RequirementBlockLike;
  assignedCourseIds: string[];
  completedCourseIds: string[];
  completedCredits: number;
  missingCourses: number | null;
  missingCredits: number | null;
  satisfied: boolean;
  status: "complete" | "in progress" | "incomplete";
  hasActivity: boolean;
};

export type ProgramRequirementSummary = {
  totalBlocks: number;
  satisfiedBlocks: number;
  remainingBlocks: number;
  isComplete: boolean;
};

export type CourseProgressLike = {
  id: string;
  title?: string | null;
  code?: string | null;
  completedTasks: number;
  totalTasks: number;
  isComplete: boolean;
  sequence_position?: number | null;
};

export type TranscriptLiteSummary = {
  completedCourses: CourseProgressLike[];
  inProgressCourses: CourseProgressLike[];
  notStartedCourses: CourseProgressLike[];
  completedCourseIds: Set<string>;
  inProgressCourseIds: Set<string>;
};

export type PrereqCourseLike = {
  id: string;
  title: string;
  code: string | null;
};

export type ModuleProgressLike = {
  id: string;
  course_id: string;
  title?: string | null;
  position: number;
  totalTasks: number;
  completedTasks: number;
};

export const getTranscriptLiteSummary = (
  courses: CourseProgressLike[]
): TranscriptLiteSummary => {
  const completedCourses = courses.filter((course) => course.isComplete);
  const inProgressCourses = courses.filter(
    (course) => !course.isComplete && course.completedTasks > 0
  );
  const notStartedCourses = courses.filter(
    (course) => !course.isComplete && course.completedTasks === 0
  );
  return {
    completedCourses,
    inProgressCourses,
    notStartedCourses,
    completedCourseIds: new Set(completedCourses.map((course) => course.id)),
    inProgressCourseIds: new Set(inProgressCourses.map((course) => course.id)),
  };
};

export const buildReadinessByCourse = (params: {
  courseIds: string[];
  prereqsByCourse: Map<string, PrereqCourseLike[]>;
  completionByCourse: Map<string, boolean>;
}) => {
  const readiness = new Map<string, ReadinessState>();
  params.courseIds.forEach((courseId) => {
    const isComplete = params.completionByCourse.get(courseId) ?? false;
    const prereqs = params.prereqsByCourse.get(courseId) ?? [];
    const unmet = prereqs.filter(
      (prereq) => !(params.completionByCourse.get(prereq.id) ?? false)
    );
    readiness.set(
      courseId,
      getReadinessState({
        isComplete,
        unmetPrereqs: unmet,
        hasPrereqs: prereqs.length > 0,
      })
    );
  });
  return readiness;
};

export const selectRecommendedNextCourse = <
  T extends CourseProgressLike & { code?: string | null; title?: string | null }
>(params: {
  courses: T[];
  readinessByCourse: Map<string, ReadinessState>;
  blockSummaries: RequirementBlockSummary[];
  blockMappings: RequirementBlockMappingLike[];
  preferredOrderCodes?: string[];
}): T | null => {
  const preferredOrderCodes = params.preferredOrderCodes ?? [];
  const blockSummaryById = new Map(
    params.blockSummaries.map((summary) => [summary.block.id, summary])
  );
  const courseToBlockIds = new Map<string, string[]>();
  params.blockMappings.forEach((mapping) => {
    const list = courseToBlockIds.get(mapping.course_id) ?? [];
    list.push(mapping.requirement_block_id);
    courseToBlockIds.set(mapping.course_id, list);
  });

  const readyCourses = params.courses.filter(
    (course) => params.readinessByCourse.get(course.id)?.status === "ready"
  );
  const activeCourses = readyCourses.filter(
    (course) => !course.isComplete && course.completedTasks > 0
  );
  const candidateCourses =
    activeCourses.length > 0
      ? activeCourses
      : readyCourses.filter((course) => !course.isComplete);

  if (candidateCourses.length === 0) {
    return null;
  }

  const categoryRankMap: Record<string, number> = {
    Foundations: 0,
    Core: 1,
    Advanced: 2,
    Capstone: 3,
    Research: 4,
  };

  const getCourseRank = (course: T) => {
    const blockIds = courseToBlockIds.get(course.id) ?? [];
    const blockSummaries = blockIds
      .map((blockId) => blockSummaryById.get(blockId))
      .filter((summary): summary is RequirementBlockSummary => Boolean(summary));
    let satisfactionRank = 2;
    let categoryRank = 99;
    let positionRank = 9999;
    if (blockSummaries.length) {
      const best = blockSummaries
        .map((summary) => {
          const category = summary.block.category ?? "Uncategorized";
          return {
            summary,
            satisfactionRank: summary.satisfied ? 1 : 0,
            categoryRank: categoryRankMap[category] ?? 5,
            positionRank: summary.block.position ?? 9999,
          };
        })
        .sort((a, b) => {
          if (a.satisfactionRank !== b.satisfactionRank) {
            return a.satisfactionRank - b.satisfactionRank;
          }
          if (a.categoryRank !== b.categoryRank) {
            return a.categoryRank - b.categoryRank;
          }
          if (a.positionRank !== b.positionRank) {
            return a.positionRank - b.positionRank;
          }
          return (a.summary.block.title ?? "").localeCompare(
            b.summary.block.title ?? ""
          );
        })[0];
      if (best) {
        satisfactionRank = best.satisfactionRank;
        categoryRank = best.categoryRank;
        positionRank = best.positionRank;
      }
    }

    const sequenceRank =
      course.sequence_position !== null && course.sequence_position !== undefined
        ? course.sequence_position
        : 9999;
    const preferredRank =
      preferredOrderCodes.length && course.code
        ? preferredOrderCodes.indexOf(course.code)
        : -1;
    const preferredOrderRank = preferredRank >= 0 ? preferredRank : 9999;

    const codeRank = (course.code ?? course.title ?? "").toLowerCase();
    return {
      satisfactionRank,
      categoryRank,
      positionRank,
      sequenceRank,
      preferredOrderRank,
      codeRank,
    };
  };

  return candidateCourses.sort((a, b) => {
    const rankA = getCourseRank(a);
    const rankB = getCourseRank(b);
    if (rankA.satisfactionRank !== rankB.satisfactionRank) {
      return rankA.satisfactionRank - rankB.satisfactionRank;
    }
    if (rankA.categoryRank !== rankB.categoryRank) {
      return rankA.categoryRank - rankB.categoryRank;
    }
    if (rankA.positionRank !== rankB.positionRank) {
      return rankA.positionRank - rankB.positionRank;
    }
    if (rankA.sequenceRank !== rankB.sequenceRank) {
      return rankA.sequenceRank - rankB.sequenceRank;
    }
    if (rankA.preferredOrderRank !== rankB.preferredOrderRank) {
      return rankA.preferredOrderRank - rankB.preferredOrderRank;
    }
    return rankA.codeRank.localeCompare(rankB.codeRank);
  })[0];
};

export const selectCurrentModule = (
  modules: ModuleProgressLike[],
  coursesById: Map<string, { title?: string | null }>
) =>
  modules
    .filter((module) => module.totalTasks > 0 && module.completedTasks < module.totalTasks)
    .sort((a, b) => {
      const courseA = coursesById.get(a.course_id);
      const courseB = coursesById.get(b.course_id);
      const titleCompare = (courseA?.title ?? "").localeCompare(courseB?.title ?? "");
      if (titleCompare !== 0) return titleCompare;
      return a.position - b.position;
    })[0] ?? null;

export const getCurrentWorkSelection = (params: {
  moduleProgress: ModuleProgressLike[];
  coursesById: Map<string, { title?: string | null }>;
  readingsByModule: Map<string, ReadingLike[] | null | undefined>;
  assignmentsByModule: Map<string, AssignmentLike[] | null | undefined>;
  assignmentStatus: Map<string, AssignmentStatus>;
  finalAssignmentIds: Set<string>;
}) => {
  const currentModule = selectCurrentModule(params.moduleProgress, params.coursesById);
  const currentModuleReadings = currentModule
    ? params.readingsByModule.get(currentModule.id) ?? []
    : [];
  const currentModuleAssignments = currentModule
    ? params.assignmentsByModule.get(currentModule.id) ?? []
    : [];
  const currentReadings = currentModuleReadings.filter((reading) =>
    isReadingIncomplete(reading.status)
  );
  const currentSkippedReadings = currentModuleReadings.filter((reading) =>
    isReadingSkipped(reading.status)
  );
  const currentAssignments = currentModuleAssignments.filter(
    (assignment) => !params.finalAssignmentIds.has(assignment.id)
  );
  const nextAction = currentModule
    ? getModuleNextAction({
        readings: currentModuleReadings,
        assignments: currentModuleAssignments,
        assignmentStatus: params.assignmentStatus,
      })
    : null;

  return {
    currentModule,
    currentModuleReadings,
    currentReadings,
    currentSkippedReadings,
    currentModuleAssignments,
    currentAssignments,
    nextAction,
  };
};

export const buildRequirementBlockCourseMap = (
  mappings?: RequirementBlockMappingLike[] | null
) => {
  const map = new Map<string, string[]>();
  (mappings ?? []).forEach((mapping) => {
    const list = map.get(mapping.requirement_block_id) ?? [];
    list.push(mapping.course_id);
    map.set(mapping.requirement_block_id, list);
  });
  return map;
};

export const summarizeRequirementBlocks = (params: {
  blocks: RequirementBlockLike[];
  mappings: RequirementBlockMappingLike[];
  coursesById: Map<string, CourseLike>;
  completedCourseIds: Set<string>;
  inProgressCourseIds?: Set<string>;
}): RequirementBlockSummary[] => {
  const blockCourseIds = buildRequirementBlockCourseMap(params.mappings);
  return (params.blocks ?? []).map((block) => {
    const assignedCourseIds = blockCourseIds.get(block.id) ?? [];
    const completedCourseIds = assignedCourseIds.filter((courseId) =>
      params.completedCourseIds.has(courseId)
    );
    const completedCredits = completedCourseIds.reduce((sum, courseId) => {
      const course = params.coursesById.get(courseId);
      return sum + (course?.credits_or_weight ?? 0);
    }, 0);
    const missingCourses =
      block.minimum_courses_required !== null &&
      block.minimum_courses_required !== undefined
        ? Math.max(0, block.minimum_courses_required - completedCourseIds.length)
        : null;
    const missingCredits =
      block.minimum_credits_required !== null &&
      block.minimum_credits_required !== undefined
        ? Math.max(0, block.minimum_credits_required - completedCredits)
        : null;
    const satisfied =
      (missingCourses === null || missingCourses === 0) &&
      (missingCredits === null || missingCredits === 0);
    const inProgressCount = assignedCourseIds.filter((courseId) =>
      params.inProgressCourseIds?.has(courseId)
    ).length;
    const hasActivity = completedCourseIds.length > 0 || inProgressCount > 0;
    const status = satisfied ? "complete" : hasActivity ? "in progress" : "incomplete";
    return {
      block,
      assignedCourseIds,
      completedCourseIds,
      completedCredits,
      missingCourses,
      missingCredits,
      satisfied,
      status,
      hasActivity,
    };
  });
};

export const getProgramRequirementSummary = (
  summaries: RequirementBlockSummary[]
): ProgramRequirementSummary => {
  const totalBlocks = summaries.length;
  const satisfiedBlocks = summaries.filter((summary) => summary.satisfied).length;
  const remainingBlocks = Math.max(0, totalBlocks - satisfiedBlocks);
  return {
    totalBlocks,
    satisfiedBlocks,
    remainingBlocks,
    isComplete: totalBlocks > 0 && remainingBlocks === 0,
  };
};
