import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReviewAccess = {
  id: string;
  program_id: string;
  expires_at: string | null;
  revoked_at: string | null;
};

export type ReviewProgram = {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
};

export const hashReviewToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export async function getReviewAccess(
  token: string,
  options?: { logAccess?: boolean }
): Promise<ReviewAccess | null> {
  if (!token) return null;
  const admin = createAdminClient();
  const tokenHash = hashReviewToken(token);
  const { data, error } = await admin
    .from("review_links")
    .select("id, program_id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data) return null;
  if (data.revoked_at) return null;
  if (data.expires_at && new Date(data.expires_at) <= new Date()) {
    return null;
  }

  if (options?.logAccess) {
    await admin
      .from("review_links")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", data.id);
  }

  return data;
}

export async function getReviewProgram(
  token: string,
  options?: { logAccess?: boolean }
): Promise<{ access: ReviewAccess; program: ReviewProgram } | null> {
  const access = await getReviewAccess(token, options);
  if (!access) return null;
  const admin = createAdminClient();
  const { data: program, error } = await admin
    .from("programs")
    .select("id, title, description, owner_id")
    .eq("id", access.program_id)
    .single();
  if (error || !program) return null;
  return { access, program };
}
