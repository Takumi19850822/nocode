import { createClient } from "@/lib/supabase/server";

export async function isSignupAllowed(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_ALLOW_SIGNUP === "true") return true;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_signup_allowed");
  if (error) {
    // RPC 未適用時は安全側に倒す（サインアップ不可）
    return false;
  }
  return Boolean(data);
}
