"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateCritique } from "@/lib/ai/critique";
import { resolveReadingStatus } from "@/lib/academic-standing";
import { SEQUENCE_POSITION_ERROR, validateSequencePosition } from "@/lib/course-sequence";
import { REQUIREMENT_BLOCK_ERROR, validateRequirementBlockSelection } from "@/lib/course-requirements";
import {
  MODULE_POSITION_CONFLICT_ERROR,
  READING_POSITION_CONFLICT_ERROR,
  STRUCTURE_POSITION_ERROR,
  validateStructurePosition,
} from "@/lib/module-structure";
import { requireAdminAccess } from "@/lib/admin-gate";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ASSIGNMENT_TYPE_ERROR,
  validateAssignmentType,
} from "@/lib/assignment-structure";
import { hashReviewToken } from "@/lib/review-access";
import {
  deriveThesisStatus,
  summarizeThesisProject,
} from "@/lib/thesis-governance";

function encodeMessage(message: string) {
  return encodeURIComponent(message);
}

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeNumber(value: FormDataEntryValue | null) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = Number.parseFloat(raw);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeInteger(value: FormDataEntryValue | null) {
  const raw = normalizeText(value);
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

async function requireProgramAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  programId: string,
  userId: string
) {
  const { data: program } = await supabase
    .from("programs")
    .select("id, owner_id")
    .eq("id", programId)
    .single();

  if (!program) {
    redirect("/dashboard?error=" + encodeMessage("Program not found."));
  }

  if (program.owner_id === userId) {
    return program;
  }

  const { data: membership } = await supabase
    .from("program_members")
    .select("role")
    .eq("program_id", programId)
    .eq("user_id", userId)
    .maybeSingle();

  const allowedRoles = new Set(["owner", "admin", "staff"]);
  if (!allowedRoles.has(membership?.role ?? "")) {
    redirect("/dashboard?error=" + encodeMessage("Access denied."));
  }

  return program;
}

export async function signIn(formData: FormData) {
  const email = normalizeText(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(error.message)}`);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const email = normalizeText(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    redirect(`/login?error=${encodeMessage(error.message)}`);
  }

  redirect(
    "/login?message=" +
      encodeMessage("Check your email to confirm your account before signing in.")
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createProgram(formData: FormData) {
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const isActive = Boolean(formData.get("isActive"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Allow first program creation for bootstrapping; gate all subsequent ones
  const { count } = await supabase
    .from("programs")
    .select("id", { count: "exact", head: true });
  if (count && count > 0) {
    await requireAdminAccess(supabase, user.id);
  }

  const { data: program, error } = await supabase
    .from("programs")
    .insert({
      owner_id: user.id,
      title,
      description: description || null,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/programs/new?error=${encodeMessage(error.message)}`);
  }

  if (program?.id) {
    await supabase.from("program_members").insert({
      program_id: program.id,
      user_id: user.id,
      role: "owner",
    });
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createDomain(formData: FormData) {
  const code = normalizeText(formData.get("code"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const status = normalizeText(formData.get("status")) || "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const { error } = await supabase.from("domains").insert({
    created_by: user.id,
    code: code || null,
    title,
    description: description || null,
    status,
  });

  if (error) {
    redirect(`/domains/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createCourse(formData: FormData) {
  const programId = normalizeText(formData.get("programId"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const code = normalizeText(formData.get("code"));
  const departmentOrDomain = normalizeText(formData.get("departmentOrDomain"));
  const creditsOrWeight = normalizeNumber(formData.get("creditsOrWeight"));
  const level = normalizeText(formData.get("level"));
  const learningOutcomes = normalizeText(formData.get("learningOutcomes"));
  const syllabus = normalizeText(formData.get("syllabus"));
  const status = normalizeText(formData.get("status")) || "active";
  const domainId = normalizeText(formData.get("domainId"));
  const prerequisiteIds = formData
    .getAll("prerequisiteIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const requirementBlockIds = formData
    .getAll("requirementBlockIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const isActive = status === "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const sequenceValidation = validateSequencePosition(formData.get("sequencePosition"));
  if (sequenceValidation.error) {
    redirect(`/courses/new?error=${encodeMessage(SEQUENCE_POSITION_ERROR)}`);
  }

  const { data: programBlocks } = await supabase
    .from("requirement_blocks")
    .select("id")
    .eq("program_id", programId);
  const allowedBlockIds = new Set((programBlocks ?? []).map((block) => block.id));
  const blockValidation = validateRequirementBlockSelection({
    selectedIds: requirementBlockIds,
    allowedIds: allowedBlockIds,
  });
  if (!blockValidation.valid) {
    redirect(`/courses/new?error=${encodeMessage(blockValidation.error ?? REQUIREMENT_BLOCK_ERROR)}`);
  }

  const { data: courseId, error } = await supabase.rpc("create_course_with_blocks", {
    p_program_id: programId,
    p_title: title,
    p_description: description || null,
    p_code: code || null,
    p_department_or_domain: departmentOrDomain || null,
    p_credits_or_weight: creditsOrWeight,
    p_level: level || null,
    p_sequence_position: sequenceValidation.value,
    p_learning_outcomes: learningOutcomes || null,
    p_syllabus: syllabus || null,
    p_status: status,
    p_domain_id: domainId || null,
    p_is_active: isActive,
    p_requirement_block_ids: requirementBlockIds,
  });

  if (error || !courseId) {
    redirect(`/courses/new?error=${encodeMessage(error?.message ?? "Course not created.")}`);
  }

  if (courseId && prerequisiteIds.length) {
    const uniquePrereqs = Array.from(new Set(prerequisiteIds)).filter(
      (prereqId) => prereqId !== courseId
    );

    if (uniquePrereqs.length) {
      const { error: prereqError } = await supabase
        .from("course_prerequisites")
        .insert(
          uniquePrereqs.map((prereqId) => ({
            course_id: courseId,
            prerequisite_course_id: prereqId,
            created_by: user.id,
          }))
        );

      if (prereqError) {
        redirect(`/courses/new?error=${encodeMessage(prereqError.message)}`);
      }
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateCourse(formData: FormData) {
  const courseId = normalizeText(formData.get("courseId"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const code = normalizeText(formData.get("code"));
  const departmentOrDomain = normalizeText(formData.get("departmentOrDomain"));
  const creditsOrWeight = normalizeNumber(formData.get("creditsOrWeight"));
  const level = normalizeText(formData.get("level"));
  const learningOutcomes = normalizeText(formData.get("learningOutcomes"));
  const syllabus = normalizeText(formData.get("syllabus"));
  const status = normalizeText(formData.get("status")) || "active";
  const domainId = normalizeText(formData.get("domainId"));
  const prerequisiteIds = formData
    .getAll("prerequisiteIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const requirementBlockIds = formData
    .getAll("requirementBlockIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const isActive = status === "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (!courseId) {
    redirect("/dashboard?error=" + encodeMessage("Course not found."));
  }

  const sequenceValidation = validateSequencePosition(formData.get("sequencePosition"));
  if (sequenceValidation.error) {
    redirect(`/courses/${courseId}/edit?error=${encodeMessage(SEQUENCE_POSITION_ERROR)}`);
  }

  const { data: courseProgram } = await supabase
    .from("courses")
    .select("program_id")
    .eq("id", courseId)
    .single();
  if (!courseProgram?.program_id) {
    redirect(`/courses/${courseId}/edit?error=${encodeMessage("Course program not found.")}`);
  }
  const { data: programBlocks } = await supabase
    .from("requirement_blocks")
    .select("id")
    .eq("program_id", courseProgram.program_id);
  const allowedBlockIds = new Set((programBlocks ?? []).map((block) => block.id));
  const blockValidation = validateRequirementBlockSelection({
    selectedIds: requirementBlockIds,
    allowedIds: allowedBlockIds,
  });
  if (!blockValidation.valid) {
    redirect(`/courses/${courseId}/edit?error=${encodeMessage(blockValidation.error ?? REQUIREMENT_BLOCK_ERROR)}`);
  }

  const { error } = await supabase.rpc("update_course_with_blocks", {
    p_course_id: courseId,
    p_title: title,
    p_description: description || null,
    p_code: code || null,
    p_department_or_domain: departmentOrDomain || null,
    p_credits_or_weight: creditsOrWeight,
    p_level: level || null,
    p_sequence_position: sequenceValidation.value,
    p_learning_outcomes: learningOutcomes || null,
    p_syllabus: syllabus || null,
    p_status: status,
    p_domain_id: domainId || null,
    p_is_active: isActive,
    p_requirement_block_ids: requirementBlockIds,
  });

  if (error) {
    redirect(`/courses/${courseId}/edit?error=${encodeMessage(error.message)}`);
  }

  await supabase.from("course_prerequisites").delete().eq("course_id", courseId);

  const uniquePrereqs = Array.from(new Set(prerequisiteIds)).filter(
    (prereqId) => prereqId && prereqId !== courseId
  );

  if (uniquePrereqs.length) {
    const { error: prereqError } = await supabase
      .from("course_prerequisites")
      .insert(
        uniquePrereqs.map((prereqId) => ({
          course_id: courseId,
          prerequisite_course_id: prereqId,
          created_by: user.id,
        }))
      );

    if (prereqError) {
      redirect(`/courses/${courseId}/edit?error=${encodeMessage(prereqError.message)}`);
    }
  }

  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/dashboard");
  redirect(`/courses/${courseId}`);
}

export async function createModule(formData: FormData) {
  const courseId = normalizeText(formData.get("courseId"));
  const title = normalizeText(formData.get("title"));
  const overview = normalizeText(formData.get("overview"));
  const positionValidation = validateStructurePosition(formData.get("position"));
  const positionValue = positionValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (positionValidation.error || positionValue === null) {
    redirect(`/modules/new?error=${encodeMessage(STRUCTURE_POSITION_ERROR)}`);
  }

  if (!courseId) {
    redirect(`/modules/new?error=${encodeMessage("Course is required.")}`);
  }

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("id", courseId)
    .maybeSingle();

  if (!course) {
    redirect(`/modules/new?error=${encodeMessage("Course not found.")}`);
  }

  const { data: positionCollision } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", courseId)
    .eq("position", positionValue)
    .maybeSingle();

  if (positionCollision) {
    redirect(`/modules/new?error=${encodeMessage(MODULE_POSITION_CONFLICT_ERROR)}`);
  }

  const { error } = await supabase.from("modules").insert({
    course_id: courseId,
    created_by: user.id,
    title,
    overview: overview || null,
    position: positionValue,
  });

  if (error) {
    redirect(`/modules/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateModule(formData: FormData) {
  const moduleId = normalizeText(formData.get("moduleId"));
  const title = normalizeText(formData.get("title"));
  const overview = normalizeText(formData.get("overview"));
  const positionValidation = validateStructurePosition(formData.get("position"));
  const positionValue = positionValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (!moduleId) {
    redirect(`/dashboard?error=${encodeMessage("Module not found.")}`);
  }

  if (positionValidation.error || positionValue === null) {
    redirect(`/modules/${moduleId}/edit?error=${encodeMessage(STRUCTURE_POSITION_ERROR)}`);
  }

  const { data: moduleRecord } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", moduleId)
    .maybeSingle();

  if (!moduleRecord) {
    redirect(`/dashboard?error=${encodeMessage("Module not found.")}`);
  }

  const { data: collision } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", moduleRecord.course_id)
    .eq("position", positionValue)
    .neq("id", moduleRecord.id)
    .maybeSingle();

  if (collision) {
    redirect(`/modules/${moduleId}/edit?error=${encodeMessage(MODULE_POSITION_CONFLICT_ERROR)}`);
  }

  const { error } = await supabase
    .from("modules")
    .update({
      title,
      overview: overview || null,
      position: positionValue,
    })
    .eq("id", moduleRecord.id);

  if (error) {
    redirect(`/modules/${moduleId}/edit?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/modules/${moduleId}`);
  revalidatePath(`/courses/${moduleRecord.course_id}`);
  revalidatePath("/dashboard");
  redirect(`/modules/${moduleId}`);
}

export async function reorderModule(formData: FormData) {
  const moduleId = normalizeText(formData.get("moduleId"));
  const direction = normalizeText(formData.get("direction"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const { data: moduleRecord, error: moduleError } = await supabase
    .from("modules")
    .select("id, course_id, position")
    .eq("id", moduleId)
    .single();

  if (moduleError || !moduleRecord) {
    redirect("/dashboard?error=" + encodeMessage("Module not found."));
  }

  const positionComparator = direction === "up" ? "lt" : "gt";
  const ordering = direction === "up" ? { ascending: false } : { ascending: true };

  const { data: target } = await supabase
    .from("modules")
    .select("id, position")
    .eq("course_id", moduleRecord.course_id)
    .filter("position", positionComparator, moduleRecord.position)
    .order("position", ordering)
    .limit(1)
    .maybeSingle();

  if (!target) {
    redirect(`/courses/${moduleRecord.course_id}`);
  }

  const { data: maxPosition } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", moduleRecord.course_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const tempPosition = (maxPosition?.position ?? 0) + 1000;

  await supabase.from("modules").update({ position: tempPosition }).eq("id", moduleRecord.id);
  await supabase.from("modules").update({ position: moduleRecord.position }).eq("id", target.id);
  await supabase.from("modules").update({ position: target.position }).eq("id", moduleRecord.id);

  revalidatePath(`/courses/${moduleRecord.course_id}`);
  redirect(`/courses/${moduleRecord.course_id}`);
}

export async function createAssignment(formData: FormData) {
  const moduleId = normalizeText(formData.get("moduleId"));
  const title = normalizeText(formData.get("title"));
  const instructions = normalizeText(formData.get("instructions"));
  const dueAt = normalizeText(formData.get("dueAt"));
  const assignmentTypeValidation = validateAssignmentType(formData.get("assignmentType"));
  const assignmentType = assignmentTypeValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (assignmentTypeValidation.error || !assignmentType) {
    redirect(`/assignments/new?error=${encodeMessage(ASSIGNMENT_TYPE_ERROR)}`);
  }

  if (!moduleId) {
    redirect(`/assignments/new?error=${encodeMessage("Module is required.")}`);
  }

  const { data: moduleRecord } = await supabase
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .maybeSingle();

  if (!moduleRecord) {
    redirect(`/assignments/new?error=${encodeMessage("Module not found.")}`);
  }

  const { error } = await supabase.from("assignments").insert({
    module_id: moduleId,
    created_by: user.id,
    title,
    instructions,
    assignment_type: assignmentType,
    due_at: dueAt ? new Date(dueAt).toISOString() : null,
  });

  if (error) {
    redirect(`/assignments/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateAssignment(formData: FormData) {
  const assignmentId = normalizeText(formData.get("assignmentId"));
  const title = normalizeText(formData.get("title"));
  const instructions = normalizeText(formData.get("instructions"));
  const dueAt = normalizeText(formData.get("dueAt"));
  const assignmentTypeValidation = validateAssignmentType(formData.get("assignmentType"));
  const assignmentType = assignmentTypeValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (!assignmentId) {
    redirect(`/dashboard?error=${encodeMessage("Assignment not found.")}`);
  }

  if (assignmentTypeValidation.error || !assignmentType) {
    redirect(`/assignments/${assignmentId}/edit?error=${encodeMessage(ASSIGNMENT_TYPE_ERROR)}`);
  }

  const { data: assignmentRecord } = await supabase
    .from("assignments")
    .select("id, module_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (!assignmentRecord) {
    redirect(`/dashboard?error=${encodeMessage("Assignment not found.")}`);
  }

  const { error } = await supabase
    .from("assignments")
    .update({
      title,
      instructions,
      assignment_type: assignmentType,
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
    })
    .eq("id", assignmentRecord.id);

  if (error) {
    redirect(`/assignments/${assignmentId}/edit?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/assignments/${assignmentId}`);
  revalidatePath(`/modules/${assignmentRecord.module_id}`);
  revalidatePath("/dashboard");
  redirect(`/assignments/${assignmentId}`);
}

export async function updateReading(formData: FormData) {
  const readingId = normalizeText(formData.get("readingId"));
  const title = normalizeText(formData.get("title"));
  const author = normalizeText(formData.get("author"));
  const sourceType = normalizeText(formData.get("sourceType"));
  const primaryOrSecondary = normalizeText(formData.get("primaryOrSecondary"));
  const traditionOrEra = normalizeText(formData.get("traditionOrEra"));
  const pagesOrLength = normalizeText(formData.get("pagesOrLength"));
  const estimatedHours = normalizeNumber(formData.get("estimatedHours"));
  const reference = normalizeText(formData.get("reference"));
  const notes = normalizeText(formData.get("notes"));
  const positionValidation = validateStructurePosition(formData.get("position"));
  const positionValue = positionValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (!readingId) {
    redirect(`/dashboard?error=${encodeMessage("Reading not found.")}`);
  }

  if (positionValidation.error || positionValue === null) {
    redirect(`/readings/${readingId}/edit?error=${encodeMessage(STRUCTURE_POSITION_ERROR)}`);
  }

  const { data: readingRecord } = await supabase
    .from("readings")
    .select("id, module_id")
    .eq("id", readingId)
    .maybeSingle();

  if (!readingRecord) {
    redirect(`/dashboard?error=${encodeMessage("Reading not found.")}`);
  }

  const { data: collision } = await supabase
    .from("readings")
    .select("id")
    .eq("module_id", readingRecord.module_id)
    .eq("position", positionValue)
    .neq("id", readingRecord.id)
    .maybeSingle();

  if (collision) {
    redirect(
      `/readings/${readingId}/edit?error=${encodeMessage(READING_POSITION_CONFLICT_ERROR)}`
    );
  }

  const { error } = await supabase
    .from("readings")
    .update({
      title,
      author: author || null,
      source_type: sourceType || null,
      primary_or_secondary: primaryOrSecondary || null,
      tradition_or_era: traditionOrEra || null,
      pages_or_length: pagesOrLength || null,
      estimated_hours: estimatedHours,
      reference_url_or_citation: reference || null,
      notes: notes || null,
      position: positionValue,
    })
    .eq("id", readingRecord.id);

  if (error) {
    redirect(`/readings/${readingId}/edit?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/modules/${readingRecord.module_id}`);
  redirect(`/modules/${readingRecord.module_id}`);
}

export async function createReading(formData: FormData) {
  const moduleId = normalizeText(formData.get("moduleId"));
  const title = normalizeText(formData.get("title"));
  const author = normalizeText(formData.get("author"));
  const sourceType = normalizeText(formData.get("sourceType"));
  const primaryOrSecondary = normalizeText(formData.get("primaryOrSecondary"));
  const traditionOrEra = normalizeText(formData.get("traditionOrEra"));
  const pagesOrLength = normalizeText(formData.get("pagesOrLength"));
  const estimatedHours = normalizeNumber(formData.get("estimatedHours"));
  const reference = normalizeText(formData.get("reference"));
  let status: string;
  try {
    status = resolveReadingStatus(normalizeText(formData.get("status")), "not_started");
  } catch (error) {
    redirect(`/readings/new?error=${encodeMessage("Invalid reading status.")}`);
  }
  const notes = normalizeText(formData.get("notes"));
  const positionValidation = validateStructurePosition(formData.get("position"));
  const positionValue = positionValidation.value;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  if (positionValidation.error || positionValue === null) {
    redirect(`/readings/new?error=${encodeMessage(STRUCTURE_POSITION_ERROR)}`);
  }

  if (!moduleId) {
    redirect(`/readings/new?error=${encodeMessage("Module is required.")}`);
  }

  const { data: moduleRecord } = await supabase
    .from("modules")
    .select("id")
    .eq("id", moduleId)
    .maybeSingle();

  if (!moduleRecord) {
    redirect(`/readings/new?error=${encodeMessage("Module not found.")}`);
  }

  const { data: readingCollision } = await supabase
    .from("readings")
    .select("id")
    .eq("module_id", moduleId)
    .eq("position", positionValue)
    .maybeSingle();

  if (readingCollision) {
    redirect(`/readings/new?error=${encodeMessage(READING_POSITION_CONFLICT_ERROR)}`);
  }

  const { error } = await supabase.from("readings").insert({
    module_id: moduleId,
    created_by: user.id,
    title,
    author: author || null,
    source_type: sourceType || null,
    primary_or_secondary: primaryOrSecondary || null,
    tradition_or_era: traditionOrEra || null,
    pages_or_length: pagesOrLength || null,
    estimated_hours: estimatedHours,
    reference_url_or_citation: reference || null,
    status,
    notes: notes || null,
    position: positionValue,
  });

  if (error) {
    redirect(`/readings/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/modules/${moduleId}`);
  redirect(`/modules/${moduleId}`);
}

export async function updateReadingStatus(formData: FormData) {
  const readingId = normalizeText(formData.get("readingId"));
  const moduleId = normalizeText(formData.get("moduleId"));
  let status: string;
  try {
    status = resolveReadingStatus(normalizeText(formData.get("status")));
  } catch (error) {
    redirect(`/modules/${moduleId}?error=${encodeMessage("Invalid reading status.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { error } = await supabase
    .from("readings")
    .update({ status })
    .eq("id", readingId);

  if (error) {
    redirect(`/modules/${moduleId}?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/modules/${moduleId}`);
  redirect(`/modules/${moduleId}`);
}

export async function submitAssignment(formData: FormData) {
  const assignmentId = normalizeText(formData.get("assignmentId"));
  const content = normalizeText(formData.get("content"));
  const markFinal = Boolean(formData.get("markFinal"));

  if (!assignmentId || !content) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage("Submission required.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingFinal } = await supabase
    .from("submissions")
    .select("id, version")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.id)
    .eq("is_final", true)
    .maybeSingle();

  if (existingFinal) {
    redirect(
      `/assignments/${assignmentId}?error=${encodeMessage(
        `Final submission is locked at version ${existingFinal.version}. Request an unlock before submitting revisions.`
      )}`
    );
  }

  const { data: inserted, error } = await supabase
    .from("submissions")
    .insert({
      assignment_id: assignmentId,
      user_id: user.id,
      content,
      is_final: markFinal,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/assignments/${assignmentId}`);
  redirect(`/assignments/${assignmentId}`);
}

export async function setFinalSubmission(formData: FormData) {
  const submissionId = normalizeText(formData.get("submissionId"));
  const assignmentId = normalizeText(formData.get("assignmentId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!submissionId || !assignmentId) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage("Invalid submission.")}`);
  }

  const { data: existingFinal } = await supabase
    .from("submissions")
    .select("id, version")
    .eq("assignment_id", assignmentId)
    .eq("user_id", user.id)
    .eq("is_final", true)
    .maybeSingle();

  if (existingFinal && existingFinal.id !== submissionId) {
    redirect(
      `/assignments/${assignmentId}?error=${encodeMessage(
        `Final submission is already locked at version ${existingFinal.version}.`
      )}`
    );
  }

  const { error } = await supabase
    .from("submissions")
    .update({ is_final: true })
    .eq("id", submissionId)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/assignments/${assignmentId}`);
  redirect(`/assignments/${assignmentId}`);
}

export async function runCritique(formData: FormData) {
  const submissionId = normalizeText(formData.get("submissionId"));
  const assignmentId = normalizeText(formData.get("assignmentId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .select("id, content, assignment_id, version")
    .eq("id", submissionId)
    .eq("user_id", user.id)
    .single();

  if (submissionError || !submission) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage("Submission not found.")}`);
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id, title, instructions, assignment_type")
    .eq("id", submission.assignment_id)
    .single();

  if (assignmentError || !assignment) {
    redirect(`/assignments/${assignmentId}?error=${encodeMessage("Assignment not found.")}`);
  }

  try {
    const { output, model, promptVersion } = await generateCritique({
      assignmentTitle: assignment.title,
      assignmentType: assignment.assignment_type,
      instructions: assignment.instructions,
      submission: submission.content,
    });

    const { error } = await supabase.from("critiques").insert({
      submission_id: submission.id,
      submission_version: submission.version,
      model,
      prompt_version: promptVersion,
      overall_verdict: output.overall_verdict,
      thesis_strength: output.thesis_strength,
      structural_failures: output.structural_failures,
      unsupported_claims: output.unsupported_claims,
      vague_terms: output.vague_terms,
      strongest_objection: output.strongest_objection,
      doctrinal_or_historical_imprecision: output.doctrinal_or_historical_imprecision,
      rewrite_priorities: output.rewrite_priorities,
      score: output.score,
      critique_json: output,
    });

    if (error) {
      redirect(`/assignments/${assignmentId}?error=${encodeMessage(error.message)}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Critique generation failed.";
    redirect(`/assignments/${assignmentId}?error=${encodeMessage(message)}`);
  }

  revalidatePath(`/assignments/${assignmentId}`);
  redirect(`/assignments/${assignmentId}`);
}

export async function createConcept(formData: FormData) {
  const title = normalizeText(formData.get("title"));
  const type = normalizeText(formData.get("type")) || "term";
  const description = normalizeText(formData.get("description"));
  const relatedCourseId = normalizeText(formData.get("relatedCourseId"));
  const relatedModuleId = normalizeText(formData.get("relatedModuleId"));
  const status = normalizeText(formData.get("status")) || "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const { error } = await supabase.from("concepts").insert({
    title,
    type,
    description: description || null,
    related_course_id: relatedCourseId || null,
    related_module_id: relatedModuleId || null,
    status,
    created_by: user.id,
  });

  if (error) {
    redirect(`/concepts/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function createRequirementBlock(formData: FormData) {
  const programId = normalizeText(formData.get("programId"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const category = normalizeText(formData.get("category"));
  const minimumCoursesRequired = normalizeInteger(
    formData.get("minimumCoursesRequired")
  );
  const minimumCreditsRequired = normalizeNumber(
    formData.get("minimumCreditsRequired")
  );

  if (!programId) {
    redirect("/programs?error=" + encodeMessage("Program not found."));
  }

  if (minimumCoursesRequired === null && minimumCreditsRequired === null) {
    redirect(
      `/programs/${programId}/requirements/new?error=${encodeMessage(
        "Provide a minimum course count or credit requirement."
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const { data: latestBlock } = await supabase
    .from("requirement_blocks")
    .select("position")
    .eq("program_id", programId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (latestBlock?.position ?? -1) + 1;

  const { error } = await supabase.from("requirement_blocks").insert({
    program_id: programId,
    title,
    description: description || null,
    category: category || null,
    minimum_courses_required: minimumCoursesRequired,
    minimum_credits_required: minimumCreditsRequired,
    position: nextPosition,
    created_by: user.id,
  });

  if (error) {
    redirect(
      `/programs/${programId}/requirements/new?error=${encodeMessage(error.message)}`
    );
  }

  revalidatePath(`/programs/${programId}/audit`);
  redirect(`/programs/${programId}/audit`);
}

export async function updateRequirementBlock(formData: FormData) {
  const blockId = normalizeText(formData.get("blockId"));
  const programId = normalizeText(formData.get("programId"));
  const title = normalizeText(formData.get("title"));
  const description = normalizeText(formData.get("description"));
  const category = normalizeText(formData.get("category"));
  const minimumCoursesRequired = normalizeInteger(
    formData.get("minimumCoursesRequired")
  );
  const minimumCreditsRequired = normalizeNumber(
    formData.get("minimumCreditsRequired")
  );
  const courseIds = formData
    .getAll("courseIds")
    .map((value) => normalizeText(value))
    .filter(Boolean);

  if (!blockId || !programId) {
    redirect("/programs?error=" + encodeMessage("Requirement block not found."));
  }

  if (minimumCoursesRequired === null && minimumCreditsRequired === null) {
    redirect(
      `/programs/${programId}/requirements/${blockId}/edit?error=${encodeMessage(
        "Provide a minimum course count or credit requirement."
      )}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  await requireAdminAccess(supabase, user.id);

  const { error } = await supabase
    .from("requirement_blocks")
    .update({
      title,
      description: description || null,
      category: category || null,
      minimum_courses_required: minimumCoursesRequired,
      minimum_credits_required: minimumCreditsRequired,
    })
    .eq("id", blockId);

  if (error) {
    redirect(
      `/programs/${programId}/requirements/${blockId}/edit?error=${encodeMessage(error.message)}`
    );
  }

  await supabase
    .from("course_requirement_blocks")
    .delete()
    .eq("requirement_block_id", blockId);

  const uniqueCourses = Array.from(new Set(courseIds));

  if (uniqueCourses.length) {
    const { error: mappingError } = await supabase
      .from("course_requirement_blocks")
      .insert(
        uniqueCourses.map((courseId) => ({
          course_id: courseId,
          requirement_block_id: blockId,
          created_by: user.id,
        }))
      );

    if (mappingError) {
      redirect(
        `/programs/${programId}/requirements/${blockId}/edit?error=${encodeMessage(mappingError.message)}`
      );
    }
  }

  revalidatePath(`/programs/${programId}/audit`);
  redirect(`/programs/${programId}/audit`);
}

async function syncThesisDerivedStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  const { data: project } = await supabase
    .from("thesis_projects")
    .select(
      "id, program_id, course_id, title, research_question, governing_problem, thesis_claim, scope_statement, status, opened_at, candidacy_established_at, prospectus_locked_at, final_submitted_at"
    )
    .eq("id", projectId)
    .single();

  if (!project) return null;

  const { data: milestones } = await supabase
    .from("thesis_milestones")
    .select(
      "id, thesis_project_id, milestone_key, title, position, required, completed_at, submission_id"
    )
    .eq("thesis_project_id", projectId)
    .order("position", { ascending: true });

  const milestoneSubmissionIds = (milestones ?? [])
    .map((milestone) => milestone.submission_id)
    .filter((id): id is string => Boolean(id));

  const { data: finalSubmissions } = milestoneSubmissionIds.length
    ? await supabase
        .from("submissions")
        .select("id, is_final")
        .in("id", milestoneSubmissionIds)
        .eq("is_final", true)
    : { data: [] as { id: string; is_final: boolean }[] };

  const finalSubmissionIds = new Set(
    (finalSubmissions ?? []).map((submission) => submission.id)
  );

  const summary = summarizeThesisProject({
    project,
    milestones: milestones ?? [],
    finalSubmissionIds,
  });

  const derivedStatus = deriveThesisStatus(summary);
  const updatePayload: Record<string, string> = {
    status: derivedStatus,
    updated_at: new Date().toISOString(),
  };

  if (summary.candidacyReady && !project.candidacy_established_at) {
    updatePayload.candidacy_established_at = new Date().toISOString();
  }

  const prospectusComplete =
    summary.milestones.find((milestone) => milestone.key === "prospectus")
      ?.completed ?? false;
  if (prospectusComplete && !project.prospectus_locked_at) {
    updatePayload.prospectus_locked_at = new Date().toISOString();
  }

  if (summary.finalThesisReady && !project.final_submitted_at) {
    updatePayload.final_submitted_at = new Date().toISOString();
  }

  await supabase.from("thesis_projects").update(updatePayload).eq("id", projectId);
  return summary;
}

export async function createThesisProject(formData: FormData) {
  const programId = normalizeText(formData.get("programId"));
  const courseId = normalizeText(formData.get("courseId"));
  const title = normalizeText(formData.get("title"));
  const researchQuestion = normalizeText(formData.get("researchQuestion"));
  const governingProblem = normalizeText(formData.get("governingProblem"));
  const thesisClaim = normalizeText(formData.get("thesisClaim"));
  const scopeStatement = normalizeText(formData.get("scopeStatement"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!programId || !courseId) {
    redirect("/admin/thesis?error=" + encodeMessage("Program or course missing."));
  }

  await requireProgramAdmin(supabase, programId, user.id);

  const { data: projectId, error } = await supabase.rpc(
    "create_thesis_project_with_milestones",
    {
      p_program_id: programId,
      p_course_id: courseId,
      p_title: title,
      p_research_question: researchQuestion,
      p_governing_problem: governingProblem,
      p_thesis_claim: thesisClaim || null,
      p_scope_statement: scopeStatement,
    }
  );

  if (error || !projectId) {
    redirect("/admin/thesis?error=" + encodeMessage(error?.message ?? "Thesis project not created."));
  }

  revalidatePath("/admin/thesis");
  redirect(`/admin/thesis/${projectId}`);
}

export async function updateThesisProject(formData: FormData) {
  const projectId = normalizeText(formData.get("projectId"));
  const title = normalizeText(formData.get("title"));
  const researchQuestion = normalizeText(formData.get("researchQuestion"));
  const governingProblem = normalizeText(formData.get("governingProblem"));
  const thesisClaim = normalizeText(formData.get("thesisClaim"));
  const scopeStatement = normalizeText(formData.get("scopeStatement"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!projectId) {
    redirect("/admin/thesis?error=" + encodeMessage("Thesis project not found."));
  }

  const { data: project } = await supabase
    .from("thesis_projects")
    .select("id, program_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/admin/thesis?error=" + encodeMessage("Thesis project not found."));
  }

  await requireProgramAdmin(supabase, project.program_id, user.id);

  const { error } = await supabase
    .from("thesis_projects")
    .update({
      title,
      research_question: researchQuestion,
      governing_problem: governingProblem,
      thesis_claim: thesisClaim || null,
      scope_statement: scopeStatement,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    redirect(`/admin/thesis/${projectId}?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/admin/thesis/${projectId}`);
  revalidatePath(`/programs/${project.program_id}/thesis`);
  redirect(`/admin/thesis/${projectId}`);
}

export async function updateThesisMilestone(formData: FormData) {
  const projectId = normalizeText(formData.get("projectId"));
  const milestoneId = normalizeText(formData.get("milestoneId"));
  const action = normalizeText(formData.get("action"));
  const submissionId = normalizeText(formData.get("submissionId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!projectId || !milestoneId) {
    redirect("/admin/thesis?error=" + encodeMessage("Milestone not found."));
  }

  const { data: project } = await supabase
    .from("thesis_projects")
    .select("id, program_id, course_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    redirect("/admin/thesis?error=" + encodeMessage("Thesis project not found."));
  }

  await requireProgramAdmin(supabase, project.program_id, user.id);

  const { data: milestone } = await supabase
    .from("thesis_milestones")
    .select("id, milestone_key, required")
    .eq("id", milestoneId)
    .eq("thesis_project_id", projectId)
    .single();

  if (!milestone) {
    redirect(`/admin/thesis/${projectId}?error=${encodeMessage("Milestone not found.")}`);
  }

  if (action === "clear") {
    const { error } = await supabase
      .from("thesis_milestones")
      .update({ completed_at: null, submission_id: null })
      .eq("id", milestoneId);

    if (error) {
      redirect(`/admin/thesis/${projectId}?error=${encodeMessage(error.message)}`);
    }

    await syncThesisDerivedStatus(supabase, projectId);
    revalidatePath(`/admin/thesis/${projectId}`);
    revalidatePath(`/programs/${project.program_id}/thesis`);
    redirect(`/admin/thesis/${projectId}`);
  }

  if (!submissionId) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Submission is required to complete this milestone."
      )}`
    );
  }

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, assignment_id, is_final, user_id")
    .eq("id", submissionId)
    .single();

  if (!submission) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Submission does not belong to the RSYN 720 course."
      )}`
    );
  }

  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, module_id")
    .eq("id", submission.assignment_id)
    .single();

  if (!assignment) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Submission does not belong to the RSYN 720 course."
      )}`
    );
  }

  const { data: moduleRecord } = await supabase
    .from("modules")
    .select("id, course_id")
    .eq("id", assignment.module_id)
    .single();

  if (!moduleRecord || moduleRecord.course_id !== project.course_id) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Submission does not belong to the RSYN 720 course."
      )}`
    );
  }

  const { data: program } = await supabase
    .from("programs")
    .select("id, owner_id")
    .eq("id", project.program_id)
    .single();

  if (!program || submission.user_id !== program.owner_id) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Submission does not belong to the program owner."
      )}`
    );
  }

  const finalMilestones = new Set(["final_thesis", "final_synthesis_reflection"]);
  if (finalMilestones.has(milestone.milestone_key) && !submission.is_final) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Final milestones require a final locked submission."
      )}`
    );
  }

  if (milestone.required && !submissionId) {
    redirect(
      `/admin/thesis/${projectId}?error=${encodeMessage(
        "Required milestones must be linked to a submission."
      )}`
    );
  }

  const { error } = await supabase
    .from("thesis_milestones")
    .update({
      completed_at: new Date().toISOString(),
      submission_id: submissionId,
    })
    .eq("id", milestoneId);

  if (error) {
    redirect(`/admin/thesis/${projectId}?error=${encodeMessage(error.message)}`);
  }

  await syncThesisDerivedStatus(supabase, projectId);
  revalidatePath(`/admin/thesis/${projectId}`);
  revalidatePath(`/programs/${project.program_id}/thesis`);
  redirect(`/admin/thesis/${projectId}`);
}

export async function createReviewLink(formData: FormData) {
  const programId = normalizeText(formData.get("programId"));
  const expiresAt = normalizeText(formData.get("expiresAt"));
  const note = normalizeText(formData.get("note"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!programId) {
    redirect("/admin/review-links?error=" + encodeMessage("Program not found."));
  }

  await requireProgramAdmin(supabase, programId, user.id);

  const token = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashReviewToken(token);
  const expiresAtIso = expiresAt ? new Date(expiresAt).toISOString() : null;

  const admin = createAdminClient();
  const { error } = await admin.from("review_links").insert({
    token_hash: tokenHash,
    program_id: programId,
    expires_at: expiresAtIso,
    note: note || null,
  });

  if (error) {
    redirect(`/admin/review-links?error=${encodeMessage(error.message)}`);
  }

  const cookieStore = await cookies();
  cookieStore.set("review_link_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/admin/review-links",
    maxAge: 300,
  });

  revalidatePath("/admin/review-links");
  redirect("/admin/review-links?created=1");
}

export async function revokeReviewLink(formData: FormData) {
  const linkId = normalizeText(formData.get("linkId"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!linkId) {
    redirect("/admin/review-links?error=" + encodeMessage("Review link not found."));
  }

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("review_links")
    .select("id, program_id")
    .eq("id", linkId)
    .single();

  if (!link) {
    redirect("/admin/review-links?error=" + encodeMessage("Review link not found."));
  }

  await requireProgramAdmin(supabase, link.program_id, user.id);

  const { error } = await admin
    .from("review_links")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", linkId);

  if (error) {
    redirect(`/admin/review-links?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/admin/review-links");
  redirect("/admin/review-links");
}
