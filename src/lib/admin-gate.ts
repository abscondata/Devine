import { redirect } from "next/navigation";
import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Checks whether the given user has administrative access
 * (owner of any program, or member with owner/admin/staff role).
 * Returns true/false without redirecting.
 */
export async function checkAdminAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data: memberships } = await supabase
    .from("program_members")
    .select("program_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin", "staff"])
    .limit(1);

  if (memberships?.length) return true;

  const { data: ownedPrograms } = await supabase
    .from("programs")
    .select("id")
    .eq("owner_id", userId)
    .limit(1);

  return Boolean(ownedPrograms?.length);
}

/**
 * Requires administrative access. Redirects to /dashboard with
 * an access-denied error if the user lacks admin privileges.
 */
export async function requireAdminAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const isAdmin = await checkAdminAccess(supabase, userId);
  if (!isAdmin) {
    redirect("/dashboard?error=Access denied.");
  }
}
