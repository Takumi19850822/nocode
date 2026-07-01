/**
 * Supabase 疎通テスト（publishable key のみでも実行可）
 *   node scripts/test-connect.mjs
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(root, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log("\n=== Supabase 疎通テスト ===\n");

if (!url?.startsWith("https://")) {
  console.error("❌ NEXT_PUBLIC_SUPABASE_URL が未設定または不正です");
  process.exit(1);
}
console.log(`✅ URL: ${url}`);

if (!publishableKey) {
  console.error("❌ publishable key が未設定です");
  process.exit(1);
}
console.log(`✅ Publishable key: ${publishableKey.slice(0, 20)}...`);

const client = createClient(url, publishableKey);

// 1. REST API 疎通
const { error: pingErr } = await client.from("profiles").select("id").limit(1);

if (pingErr) {
  const missingTable =
    pingErr.code === "42P01" ||
    pingErr.message.includes("does not exist") ||
    pingErr.message.includes("schema cache");
  if (missingTable) {
    console.log("⚠️  profiles テーブル未作成（API接続自体は OK）");
    console.log("   → Dashboard > SQL Editor で supabase/migrations/001_initial_schema.sql を実行");
  } else {
    console.error(`❌ API 接続エラー: ${pingErr.message}`);
    process.exit(1);
  }
} else {
  console.log("✅ Publishable key → Supabase REST API 接続 OK");
}

// 2. Auth エンドポイント疎通（存在しないユーザーで意図的に失敗させる）
const { error: authErr } = await client.auth.signInWithPassword({
  email: "connectivity-test@invalid.local",
  password: "wrong-password-for-test",
});

if (authErr) {
  if (
    authErr.message.includes("Invalid login credentials") ||
    authErr.message.includes("invalid_credentials")
  ) {
    console.log("✅ Auth API 疎通 OK（認証サーバー応答あり）");
  } else {
    console.log(`⚠️  Auth 応答: ${authErr.message}`);
  }
} else {
  console.log("✅ Auth API 疎通 OK");
}

// 3. secret key があれば管理操作もテスト
if (secretKey && !secretKey.includes("your-") && !secretKey.startsWith("sb_secret_...")) {
  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (error) {
    console.log(`⚠️  Secret key テスト: ${error.message}`);
  } else {
    console.log(`✅ Secret key → Admin API OK（ユーザー数: ${data.users.length}+）`);
  }
} else {
  console.log("ℹ️  Secret key 未設定 → ユーザー自動作成はスキップ");
  console.log("   初回ログイン用ユーザーは Dashboard > Authentication > Users から作成してください");
}

console.log("\n=== テスト完了 ===");
console.log("   次: npm run dev → http://localhost:3000/login\n");
