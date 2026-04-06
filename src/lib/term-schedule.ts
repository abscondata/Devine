/**
 * Term schedule computation.
 * Derives unit date windows, reading targets, and written-work due dates
 * from a term's start/end dates and a course's module structure.
 * No database writes. Pure computation.
 */

export type UnitSchedule = {
  moduleId: string;
  position: number;
  startsAt: Date;
  endsAt: Date;
};

export type TermSchedule = {
  termStart: Date;
  termEnd: Date;
  totalDays: number;
  currentWeek: number;
  totalWeeks: number;
  unitSchedules: Map<string, UnitSchedule>; // keyed by module ID
};

/**
 * Compute the schedule for a set of courses within a term.
 * Each course's units are distributed evenly across the term duration.
 */
export function computeTermSchedule(params: {
  termStartsAt: string;
  termEndsAt: string;
  courses: { id: string; modules: { id: string; position: number }[] }[];
}): TermSchedule {
  const termStart = new Date(params.termStartsAt);
  const termEnd = new Date(params.termEndsAt);
  const totalDays = Math.max(1, Math.round((termEnd.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)));
  const totalWeeks = Math.ceil(totalDays / 7);
  const now = new Date();
  const daysSinceStart = Math.max(0, Math.round((now.getTime() - termStart.getTime()) / (1000 * 60 * 60 * 24)));
  const currentWeek = Math.min(totalWeeks, Math.floor(daysSinceStart / 7) + 1);

  const unitSchedules = new Map<string, UnitSchedule>();

  params.courses.forEach((course) => {
    const unitCount = course.modules.length;
    if (unitCount === 0) return;
    const daysPerUnit = totalDays / unitCount;

    course.modules
      .sort((a, b) => a.position - b.position)
      .forEach((mod, index) => {
        const unitStart = new Date(termStart.getTime() + index * daysPerUnit * 24 * 60 * 60 * 1000);
        const unitEnd = new Date(termStart.getTime() + (index + 1) * daysPerUnit * 24 * 60 * 60 * 1000);
        unitSchedules.set(mod.id, {
          moduleId: mod.id,
          position: mod.position,
          startsAt: unitStart,
          endsAt: unitEnd,
        });
      });
  });

  return { termStart, termEnd, totalDays, currentWeek, totalWeeks, unitSchedules };
}

/**
 * Compute the target date for a reading within a unit window.
 * Readings are distributed evenly within the unit's date range.
 */
export function computeReadingTargetDate(params: {
  unitSchedule: UnitSchedule;
  readingPosition: number;
  totalReadings: number;
}): Date {
  const { unitSchedule, readingPosition, totalReadings } = params;
  if (totalReadings <= 1) return unitSchedule.endsAt;
  const unitDuration = unitSchedule.endsAt.getTime() - unitSchedule.startsAt.getTime();
  // Readings are distributed across the first 75% of the unit, leaving the last 25% for writing
  const readingWindow = unitDuration * 0.75;
  const offset = (readingPosition / (totalReadings - 1)) * readingWindow;
  return new Date(unitSchedule.startsAt.getTime() + offset);
}

/**
 * Compute the due date for written work within a unit.
 * Uses the explicit due_at if set, otherwise defaults to the unit end date.
 */
export function computeWorkDueDate(params: {
  unitSchedule: UnitSchedule;
  explicitDueAt: string | null;
}): Date {
  if (params.explicitDueAt) return new Date(params.explicitDueAt);
  return params.unitSchedule.endsAt;
}

/**
 * Format a date for display: "Jan 15" or "Jan 15, 2027" if not current year.
 */
export function formatScheduleDate(date: Date): string {
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Term assignment schedule row (from term_assignment_schedule table).
 */
export type TermAssignmentScheduleRow = {
  assignment_id: string;
  default_due_at: string;
  current_due_at: string;
  revised_at: string | null;
};

/**
 * Returns the effective due date for written work.
 * Priority:
 *   1. Term schedule row (current_due_at) — authoritative when materialized
 *   2. Canonical assignment due_at — if set on the assignment itself
 *   3. Computed from unit schedule — ephemeral fallback
 */
export function getEffectiveDueDate(params: {
  termScheduleRow?: TermAssignmentScheduleRow | null;
  canonicalDueAt?: string | null;
  unitSchedule?: UnitSchedule | null;
}): { date: Date; source: "term" | "canonical" | "computed"; isRevised: boolean; defaultDate?: Date } | null {
  if (params.termScheduleRow) {
    return {
      date: new Date(params.termScheduleRow.current_due_at),
      source: "term",
      isRevised: Boolean(params.termScheduleRow.revised_at),
      defaultDate: new Date(params.termScheduleRow.default_due_at),
    };
  }
  if (params.canonicalDueAt) {
    return { date: new Date(params.canonicalDueAt), source: "canonical", isRevised: false };
  }
  if (params.unitSchedule) {
    return { date: params.unitSchedule.endsAt, source: "computed", isRevised: false };
  }
  return null;
}

/**
 * Returns true if the date is in the past.
 */
export function isPast(date: Date): boolean {
  return date.getTime() < Date.now();
}

/**
 * Returns true if the date is within the next 7 days.
 */
export function isDueThisWeek(date: Date): boolean {
  const now = Date.now();
  const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
  return date.getTime() >= now && date.getTime() <= weekFromNow;
}
