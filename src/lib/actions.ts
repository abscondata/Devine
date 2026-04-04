"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { generateCritique } from "@/lib/ai/critique";
import { createClient } from "@/lib/supabase/server";

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
  const isActive = status === "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: course, error } = await supabase
    .from("courses")
    .insert({
      program_id: programId,
      created_by: user.id,
      title,
      description: description || null,
      code: code || null,
      department_or_domain: departmentOrDomain || null,
      credits_or_weight: creditsOrWeight,
      level: level || null,
      learning_outcomes: learningOutcomes || null,
      syllabus: syllabus || null,
      status,
      domain_id: domainId || null,
      is_active: isActive,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/courses/new?error=${encodeMessage(error.message)}`);
  }

  if (course?.id && prerequisiteIds.length) {
    const uniquePrereqs = Array.from(new Set(prerequisiteIds)).filter(
      (prereqId) => prereqId !== course.id
    );

    if (uniquePrereqs.length) {
      const { error: prereqError } = await supabase
        .from("course_prerequisites")
        .insert(
          uniquePrereqs.map((prereqId) => ({
            course_id: course.id,
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
  const isActive = status === "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (!courseId) {
    redirect("/dashboard?error=" + encodeMessage("Course not found."));
  }

  const { error } = await supabase
    .from("courses")
    .update({
      title,
      description: description || null,
      code: code || null,
      department_or_domain: departmentOrDomain || null,
      credits_or_weight: creditsOrWeight,
      level: level || null,
      learning_outcomes: learningOutcomes || null,
      syllabus: syllabus || null,
      status,
      domain_id: domainId || null,
      is_active: isActive,
    })
    .eq("id", courseId);

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: latestModule } = await supabase
    .from("modules")
    .select("position")
    .eq("course_id", courseId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (latestModule?.position ?? -1) + 1;

  const { error } = await supabase.from("modules").insert({
    course_id: courseId,
    created_by: user.id,
    title,
    overview: overview || null,
    position: nextPosition,
  });

  if (error) {
    redirect(`/modules/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
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
  const assignmentType = normalizeText(formData.get("assignmentType")) || "general";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
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
  const status = normalizeText(formData.get("status")) || "not_started";
  const notes = normalizeText(formData.get("notes"));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: latestReading } = await supabase
    .from("readings")
    .select("position")
    .eq("module_id", moduleId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextPosition = (latestReading?.position ?? -1) + 1;

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
    position: nextPosition,
  });

  if (error) {
    redirect(`/readings/new?error=${encodeMessage(error.message)}`);
  }

  revalidatePath(`/modules/${moduleId}`);
  redirect(`/modules/${moduleId}`);
}

export async function updateReadingStatus(formData: FormData) {
  const readingId = normalizeText(formData.get("readingId"));
  const status = normalizeText(formData.get("status"));
  const moduleId = normalizeText(formData.get("moduleId"));

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
