/**
 * Institutional Readiness
 *
 * Centralizes the runtime expectations of the Devine College Core codebase
 * against the live Supabase database. Used by diagnostic surfaces and
 * blocked-state rendering. Does not query the live database — it declares
 * what the code requires and provides standard failure language.
 */

import { isAdminClientAvailable } from "@/lib/supabase/admin";

// ── Required live objects ────────────────────────────────────────────────

export type LiveObjectKind = "table" | "column" | "function" | "config";

export type LiveObjectExpectation = {
  name: string;
  kind: LiveObjectKind;
  requiredBy: string;
  blockedMessage: string;
};

export const REQUIRED_LIVE_OBJECTS: LiveObjectExpectation[] = [
  {
    name: "academic_terms",
    kind: "table",
    requiredBy: "Term review, dashboard, admin term governance",
    blockedMessage:
      "The academic_terms table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "term_courses",
    kind: "table",
    requiredBy: "Term review, dashboard current course load",
    blockedMessage:
      "The term_courses table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "term_assignment_schedule",
    kind: "table",
    requiredBy: "Term review, course dossier due dates",
    blockedMessage:
      "The term_assignment_schedule table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "thesis_projects",
    kind: "table",
    requiredBy: "Research register, thesis dossier, admin thesis management",
    blockedMessage:
      "The thesis_projects table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "thesis_milestones",
    kind: "table",
    requiredBy: "Thesis dossier, milestone ledger, thesis governance",
    blockedMessage:
      "The thesis_milestones table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "review_links",
    kind: "table",
    requiredBy: "External review packet system, admin review link management",
    blockedMessage:
      "The review_links table does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "program_members.current_course_id",
    kind: "column",
    requiredBy: "Enrollment state tracking, dashboard enrollment detection",
    blockedMessage:
      "The current_course_id column on program_members does not exist. Run convergence-block-1-tables.sql in the Supabase SQL Editor.",
  },
  {
    name: "private.enforce_thesis_course",
    kind: "function",
    requiredBy: "Thesis project creation guard",
    blockedMessage:
      "Thesis governance functions are missing. Run convergence-block-2-functions.sql in the Supabase SQL Editor.",
  },
  {
    name: "SUPABASE_SERVICE_ROLE_KEY",
    kind: "config",
    requiredBy:
      "External review token pages, admin review link management, admin thesis actions",
    blockedMessage:
      "SUPABASE_SERVICE_ROLE_KEY is not set. Copy the service role key from the Supabase dashboard (Settings > API) into .env.local and restart.",
  },
];

// ── Runtime checks ──────────────────────────────────────────────────────

export type ReadinessCheckResult = {
  name: string;
  kind: LiveObjectKind;
  status: "ok" | "missing" | "unknown";
  blockedMessage: string;
};

/**
 * Returns the subset of required live objects that can be checked
 * without querying the database (config-level checks only).
 */
export function checkConfigReadiness(): ReadinessCheckResult[] {
  return REQUIRED_LIVE_OBJECTS.filter((obj) => obj.kind === "config").map(
    (obj) => {
      if (obj.name === "SUPABASE_SERVICE_ROLE_KEY") {
        return {
          name: obj.name,
          kind: obj.kind,
          status: isAdminClientAvailable() ? ("ok" as const) : ("missing" as const),
          blockedMessage: obj.blockedMessage,
        };
      }
      return {
        name: obj.name,
        kind: obj.kind,
        status: "unknown" as const,
        blockedMessage: obj.blockedMessage,
      };
    }
  );
}

/**
 * Returns all required live objects with their expected status.
 * Database-level objects are reported as "unknown" since this module
 * does not query the live database.
 */
export function getFullReadinessManifest(): ReadinessCheckResult[] {
  const configResults = checkConfigReadiness();
  const configNames = new Set(configResults.map((r) => r.name));

  const dbResults = REQUIRED_LIVE_OBJECTS.filter(
    (obj) => !configNames.has(obj.name)
  ).map((obj) => ({
    name: obj.name,
    kind: obj.kind,
    status: "unknown" as const,
    blockedMessage: obj.blockedMessage,
  }));

  return [...configResults, ...dbResults];
}

// ── Standard blocked-state messages ─────────────────────────────────────

export const BLOCKED_MESSAGES = {
  serviceRoleKey:
    "SUPABASE_SERVICE_ROLE_KEY is not configured. The external review system and administrative operations that require elevated database access are unavailable until this key is set.",
  liveConvergence:
    "The live database has not been fully converged. Some institutional tables required by this surface may not exist yet. Apply the convergence SQL blocks in the Supabase SQL Editor.",
  reviewLaneUnavailable:
    "The external review system is not available. This may be caused by a missing service role key or incomplete database convergence.",
} as const;
