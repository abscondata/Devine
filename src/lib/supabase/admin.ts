import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export class AdminClientUnavailableError extends Error {
  constructor() {
    super(
      "Supabase service role key is not configured. " +
        "Set SUPABASE_SERVICE_ROLE_KEY in .env.local (local) or environment variables (deployed). " +
        "The external review system and admin operations require this key."
    );
    this.name = "AdminClientUnavailableError";
  }
}

export function isAdminClientAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new AdminClientUnavailableError();
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
