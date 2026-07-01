/**
 * Supabase 疎通確認 & 初期セットアップ
 *
 * 使い方:
 *   1. .env に Supabase URL / anon key / service role key を設定
 *   2. Supabase Dashboard > SQL Editor で supabase/migrations/001_initial_schema.sql を実行
 *   3. node scripts/setup-supabase.mjs
 *
 * 環境変数（任意）:
 *   SETUP_ADMIN_EMAIL=admin@example.com
 *   SETUP_ADMIN_PASSWORD=nocode2026FCG
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
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.SETUP_ADMIN_EMAIL ?? "admin@example.com";
const adminPassword = process.env.SETUP_ADMIN_PASSWORD ?? "nocode2026FCG";

function fail(msg) {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

function warn(msg) {
  console.log(`⚠️  ${msg}`);
}

console.log("\n=== Supabase 疎通チェック ===\n");

if (!url || !url.startsWith("https://") || !url.includes("supabase.co")) {
  fail(
    "NEXT_PUBLIC_SUPABASE_URL が正しくありません。\n" +
      "   Supabase Dashboard > Project Settings > API の Project URL を設定してください。\n" +
      "   例: https://abcdefghijklmnop.supabase.co\n" +
      "   ※ ログインパスワードをここに入れる必要はありません。"
  );
}

if (!anonKey || anonKey.includes("your-supabase")) {
  fail("NEXT_PUBLIC_SUPABASE_ANON_KEY を設定してください（Dashboard > API > anon public）");
}

if (!serviceKey || serviceKey.includes("your-service")) {
  fail("SUPABASE_SERVICE_ROLE_KEY を設定してください（Dashboard > API > service_role）");
}

// 1. anon key で REST API 疎通
const anon = createClient(url, anonKey);
const { error: anonErr } = await anon.from("profiles").select("id").limit(1);

if (anonErr) {
  if (anonErr.message.includes("does not exist") || anonErr.code === "42P01") {
    fail(
      "profiles テーブルがありません。\n" +
        "   Supabase Dashboard > SQL Editor で以下を実行してください:\n" +
        "   supabase/migrations/001_initial_schema.sql"
    );
  }
  fail(`anon key 接続エラー: ${anonErr.message}`);
}
ok("anon key → Supabase API 接続 OK");

// 2. service role で管理操作
const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 3. テストユーザー作成 or 取得
let userId;
const { data: existingUsers } = await admin.auth.admin.listUsers();
const existing = existingUsers?.users?.find((u) => u.email === adminEmail);

if (existing) {
  userId = existing.id;
  warn(`ユーザー ${adminEmail} は既に存在します（id: ${userId}）`);
  const { error: pwErr } = await admin.auth.admin.updateUserById(userId, {
    password: adminPassword,
  });
  if (pwErr) warn(`パスワード更新スキップ: ${pwErr.message}`);
  else ok(`パスワードを ${adminPassword} に更新しました`);
} else {
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { display_name: "Admin" },
  });
  if (createErr) fail(`ユーザー作成失敗: ${createErr.message}`);
  userId = created.user.id;
  ok(`テストユーザー作成: ${adminEmail}`);
}

// 4. super_admin に昇格
const { error: profileErr } = await admin
  .from("profiles")
  .update({ role: "super_admin", display_name: "Admin" })
  .eq("id", userId);

if (profileErr) fail(`profiles 更新失敗: ${profileErr.message}`);
ok("role = super_admin に設定");

// 5. ログイン疎通（anon + signInWithPassword）
const loginClient = createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: session, error: loginErr } = await loginClient.auth.signInWithPassword({
  email: adminEmail,
  password: adminPassword,
});

if (loginErr) fail(`ログイン疎通失敗: ${loginErr.message}`);
ok(`ログイン疎通 OK（${adminEmail}）`);

// 6. ログイン後の profiles 読み取り
const authed = createClient(url, anonKey, {
  global: { headers: { Authorization: `Bearer ${session.session.access_token}` } },
  auth: { autoRefreshToken: false, persistSession: false },
});
const { data: profile, error: readErr } = await authed
  .from("profiles")
  .select("email, role, display_name")
  .eq("id", userId)
  .single();

if (readErr) fail(`プロファイル読み取り失敗: ${readErr.message}`);
ok(`プロファイル取得 OK → role: ${profile.role}, name: ${profile.display_name}`);

console.log("\n=== セットアップ完了 ===");
console.log(`\n  ログイン URL : http://localhost:3000/login`);
console.log(`  メール       : ${adminEmail}`);
console.log(`  パスワード   : ${adminPassword}`);
console.log("\n  ※ anon key はブラウザに載りますが、RLS で保護されています。");
console.log("  ※ service role key は絶対に NEXT_PUBLIC_ を付けないでください。\n");
