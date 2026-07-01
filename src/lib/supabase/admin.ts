import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, getSupabaseUrl } from "./env";

export function createAdminClient() {
  const key = getSupabaseSecretKey();
  if (!key) {
    throw new Error("SUPABASE_SECRET_KEY が設定されていません");
  }
  return createClient(getSupabaseUrl(), key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function hasAdminClient() {
  return Boolean(getSupabaseSecretKey());
}
