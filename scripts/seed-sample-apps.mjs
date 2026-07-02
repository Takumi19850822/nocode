/**
 * サンプルアプリ + テストデータ投入スクリプト
 *
 * 指定テナントに以下の3アプリを作成し、テストデータを大量投入します。
 *   - サンプル顧客管理
 *   - サンプル商品マスタ
 *   - サンプル訪問結果（顧客・商品を参照する検索フィールド + 商談ステータス）
 *
 * 既に同名アプリが存在する場合は削除してから再作成します（再実行可）。
 *
 * 使い方:
 *   node scripts/seed-sample-apps.mjs [tenantId]
 *   # tenantId 省略時は下記 DEFAULT_TENANT_ID を使用
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";

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

const DEFAULT_TENANT_ID = "926953af-53bb-4f45-b695-505f767d1fad";
const TENANT_ID = process.argv[2] ?? DEFAULT_TENANT_ID;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

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

if (!url?.startsWith("https://")) fail("NEXT_PUBLIC_SUPABASE_URL が未設定です");
if (!secretKey) fail("SUPABASE_SECRET_KEY（または SUPABASE_SERVICE_ROLE_KEY）が未設定です");

const admin = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function generateFieldName(label) {
  return (
    label
      .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .toLowerCase() || "field"
  );
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}
function toDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function randomDateWithinDays(daysBack) {
  const d = new Date();
  d.setDate(d.getDate() - randomInt(0, daysBack));
  return toDateString(d);
}

console.log("\n=== サンプルアプリ + テストデータ投入 ===\n");
console.log(`対象テナントID: ${TENANT_ID}\n`);

// -----------------------------------------------------------------
// 0. テナント存在確認
// -----------------------------------------------------------------
const { data: tenant, error: tenantErr } = await admin
  .from("tenants")
  .select("id, name")
  .eq("id", TENANT_ID)
  .maybeSingle();

if (tenantErr) fail(`テナント確認エラー: ${tenantErr.message}`);
if (!tenant) fail(`テナントID ${TENANT_ID} が見つかりません`);
ok(`テナント確認 OK: ${tenant.name}`);

// -----------------------------------------------------------------
// ヘルパー
// -----------------------------------------------------------------
const { data: maxRow } = await admin
  .from("apps")
  .select("sort_order")
  .eq("tenant_id", TENANT_ID)
  .order("sort_order", { ascending: false })
  .limit(1)
  .maybeSingle();
let nextSortOrder = (maxRow?.sort_order ?? -1) + 1;

async function createApp(name, description, icon) {
  const { data: existing } = await admin
    .from("apps")
    .select("id")
    .eq("tenant_id", TENANT_ID)
    .eq("name", name);

  if (existing?.length) {
    await admin.from("apps").delete().in("id", existing.map((a) => a.id));
    warn(`既存の「${name}」を削除して再作成します`);
  }

  const { data: app, error } = await admin
    .from("apps")
    .insert({
      tenant_id: TENANT_ID,
      name,
      description,
      icon,
      sort_order: nextSortOrder++,
      is_active: true,
    })
    .select()
    .single();

  if (error) fail(`アプリ作成失敗（${name}）: ${error.message}`);
  ok(`アプリ作成: ${name}`);
  return app;
}

async function insertFields(appId, defs) {
  const rows = defs.map((d, i) => ({
    id: uuidv4(),
    app_id: appId,
    name: d.name ?? generateFieldName(d.label),
    label: d.label,
    field_type: d.field_type,
    is_required: d.is_required ?? false,
    sort_order: i,
    width: d.width ?? 100,
    placeholder: d.placeholder ?? "",
    default_value: d.default_value ?? "",
    options: d.options ?? [],
    config: d.config ?? {},
    break_before: d.break_before ?? false,
  }));

  const { error } = await admin.from("app_fields").insert(rows);
  if (error) fail(`フィールド作成失敗: ${error.message}`);

  const byLabel = {};
  rows.forEach((r) => (byLabel[r.label] = r.id));
  return byLabel;
}

async function setListFields(appId, fieldIds) {
  const { error } = await admin
    .from("apps")
    .update({ list_field_ids: fieldIds })
    .eq("id", appId);
  if (error) fail(`一覧設定失敗: ${error.message}`);
}

async function insertRecordValues(rows) {
  const CHUNK = 300;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await admin
      .from("app_record_values")
      .insert(rows.slice(i, i + CHUNK));
    if (error) fail(`レコード値の投入失敗: ${error.message}`);
  }
}

// ===================================================================
// 1. サンプル顧客管理
// ===================================================================
const customerApp = await createApp(
  "サンプル顧客管理",
  "テスト用の顧客マスタです（自動生成）",
  "users"
);

const customerFields = await insertFields(customerApp.id, [
  { label: "顧客名", field_type: "text", is_required: true, width: 50 },
  { label: "会社名", field_type: "text", width: 50 },
  { label: "部署", field_type: "text", width: 50 },
  { label: "電話番号", field_type: "text", width: 50 },
  { label: "メールアドレス", field_type: "text", width: 50 },
  { label: "住所", field_type: "text", width: 100 },
  { label: "備考", field_type: "textarea", width: 100 },
]);

await setListFields(customerApp.id, [
  customerFields["顧客名"],
  customerFields["会社名"],
  customerFields["部署"],
  customerFields["電話番号"],
  customerFields["メールアドレス"],
]);

const surnames = [
  "山田", "鈴木", "佐藤", "田中", "高橋", "伊藤", "渡辺", "中村", "小林", "加藤",
  "吉田", "山本", "松本", "井上", "木村", "林", "清水", "斎藤", "山口", "森",
];
const givenNames = [
  "太郎", "花子", "一郎", "美咲", "健太", "由美", "大輔", "直子", "拓也", "smtomo",
  "陽子", "翔太", "真理", "健一", "麻衣", "浩二", "恵子", "亮太", "さくら", "誠",
].map((n) => (n === "smtomo" ? "智子" : n));
const companySuffixes = [
  "商事", "物産", "工業", "フーズ", "商店", "システムズ", "電機", "建設", "運輸", "流通",
];
const departments = [
  "営業部", "購買部", "総務部", "経営企画部", "情報システム部", "製造部", "マーケティング部", "人事部",
];
const wards = [
  "千代田区", "中央区", "港区", "新宿区", "渋谷区", "品川区", "目黒区", "世田谷区", "豊島区", "中野区",
];
const customerNotes = ["既存取引先", "紹介案件", "新規開拓先", "展示会で名刺交換", "Web問い合わせ経由", ""];

const CUSTOMER_COUNT = 20;
const customers = Array.from({ length: CUSTOMER_COUNT }, (_, i) => {
  const company = `${surnames[i % surnames.length]}${companySuffixes[(i * 3) % companySuffixes.length]}株式会社`;
  const contactName = `${surnames[(i + 7) % surnames.length]} ${givenNames[(i * 2) % givenNames.length]}`;
  return {
    id: uuidv4(),
    company,
    contactName,
    department: departments[i % departments.length],
    phone: `03-${randomInt(3000, 5999)}-${randomInt(1000, 9999)}`,
    email: `contact${i + 1}@example.com`,
    address: `東京都${wards[i % wards.length]}${randomInt(1, 9)}-${randomInt(1, 20)}-${randomInt(1, 15)}`,
    note: pick(customerNotes),
  };
});

await admin.from("app_records").insert(
  customers.map((c) => ({ id: c.id, app_id: customerApp.id, tenant_id: TENANT_ID, created_by: null }))
);

await insertRecordValues(
  customers.flatMap((c) => [
    { record_id: c.id, field_id: customerFields["顧客名"], value: c.contactName },
    { record_id: c.id, field_id: customerFields["会社名"], value: c.company },
    { record_id: c.id, field_id: customerFields["部署"], value: c.department },
    { record_id: c.id, field_id: customerFields["電話番号"], value: c.phone },
    { record_id: c.id, field_id: customerFields["メールアドレス"], value: c.email },
    { record_id: c.id, field_id: customerFields["住所"], value: c.address },
    { record_id: c.id, field_id: customerFields["備考"], value: c.note },
  ])
);
ok(`顧客データ投入: ${customers.length}件`);

// ===================================================================
// 2. サンプル商品マスタ
// ===================================================================
const productApp = await createApp(
  "サンプル商品マスタ",
  "テスト用の商品マスタです（自動生成）",
  "package"
);

const productFields = await insertFields(productApp.id, [
  { label: "商品名", field_type: "text", is_required: true, width: 60 },
  { label: "商品コード", field_type: "text", width: 40 },
  {
    label: "カテゴリ",
    field_type: "select",
    width: 40,
    options: ["ソフトウェア", "ハードウェア", "消耗品", "保守サービス", "その他"].map((label, i) => ({
      label,
      value: String(i + 1),
    })),
  },
  { label: "単価", field_type: "number", width: 30, config: { use_comma_separator: true } },
  { label: "在庫数", field_type: "number", width: 30 },
  { label: "備考", field_type: "textarea", width: 100 },
]);

await setListFields(productApp.id, [
  productFields["商品名"],
  productFields["商品コード"],
  productFields["カテゴリ"],
  productFields["単価"],
  productFields["在庫数"],
]);

const productDefs = [
  { name: "クラウド管理システム", category: 1, price: 298000 },
  { name: "業務用プリンタ", category: 2, price: 128000 },
  { name: "オフィスチェア", category: 3, price: 24800 },
  { name: "セキュリティソフト", category: 1, price: 48000 },
  { name: "複合機", category: 2, price: 398000 },
  { name: "ノートPC", category: 2, price: 158000 },
  { name: "デスクトップPC", category: 2, price: 128000 },
  { name: "タブレット端末", category: 2, price: 68000 },
  { name: "Web会議システム", category: 1, price: 88000 },
  { name: "在庫管理システム", category: 1, price: 198000 },
  { name: "会計ソフト", category: 1, price: 98000 },
  { name: "名刺管理ツール", category: 1, price: 29800 },
  { name: "監視カメラ", category: 2, price: 45000 },
  { name: "無停電電源装置", category: 2, price: 68000 },
  { name: "ルーター", category: 2, price: 18000 },
  { name: "スイッチングハブ", category: 3, price: 9800 },
  { name: "プロジェクター", category: 2, price: 88000 },
  { name: "電子黒板", category: 2, price: 348000 },
  { name: "勤怠管理システム", category: 4, price: 58000 },
  { name: "CRMソフト", category: 1, price: 148000 },
];

const products = productDefs.map((p, i) => ({
  id: uuidv4(),
  name: p.name,
  code: `PRD-${String(i + 1).padStart(4, "0")}`,
  category: String(p.category),
  price: p.price,
  stock: randomInt(0, 150),
}));

await admin.from("app_records").insert(
  products.map((p) => ({ id: p.id, app_id: productApp.id, tenant_id: TENANT_ID, created_by: null }))
);

await insertRecordValues(
  products.flatMap((p) => [
    { record_id: p.id, field_id: productFields["商品名"], value: p.name },
    { record_id: p.id, field_id: productFields["商品コード"], value: p.code },
    { record_id: p.id, field_id: productFields["カテゴリ"], value: p.category },
    { record_id: p.id, field_id: productFields["単価"], value: String(p.price) },
    { record_id: p.id, field_id: productFields["在庫数"], value: String(p.stock) },
    { record_id: p.id, field_id: productFields["備考"], value: "" },
  ])
);
ok(`商品データ投入: ${products.length}件`);

// ===================================================================
// 3. サンプル訪問結果（顧客・商品を検索フィールドで参照）
// ===================================================================
const visitApp = await createApp(
  "サンプル訪問結果",
  "顧客・商品マスタを参照する訪問結果です（自動生成）",
  "clipboard-list"
);

const DEAL_STATUSES = [
  "ヒアリング", "提案", "セミクロージング", "クロージング", "受注", "失注", "完了",
].map((label, i) => ({ label, value: String(i + 1) }));

const visitFields = await insertFields(visitApp.id, [
  { label: "訪問日", field_type: "date", is_required: true, width: 30 },
  {
    label: "顧客",
    field_type: "search",
    width: 40,
    config: {
      source_app_id: customerApp.id,
      source_field_id: customerFields["顧客名"],
      display_field_id: customerFields["顧客名"],
      mappings: [{ source_field_id: customerFields["会社名"], target_field_id: "" }], // 後で更新
    },
  },
  { label: "会社名", field_type: "text", width: 30 },
  {
    label: "商品",
    field_type: "search",
    width: 40,
    config: {
      source_app_id: productApp.id,
      source_field_id: productFields["商品名"],
      display_field_id: productFields["商品名"],
      mappings: [{ source_field_id: productFields["単価"], target_field_id: "" }], // 後で更新
    },
  },
  { label: "単価", field_type: "number", width: 30, config: { use_comma_separator: true } },
  { label: "担当者", field_type: "text", width: 30 },
  { label: "商談ステータス", field_type: "select", width: 40, options: DEAL_STATUSES },
  { label: "訪問内容", field_type: "textarea", width: 100 },
  { label: "次回アクション", field_type: "text", width: 100 },
]);

// search フィールドの mapping.target_field_id を実際の会社名/単価フィールドIDに更新
await admin
  .from("app_fields")
  .update({
    config: {
      source_app_id: customerApp.id,
      source_field_id: customerFields["顧客名"],
      display_field_id: customerFields["顧客名"],
      mappings: [{ source_field_id: customerFields["会社名"], target_field_id: visitFields["会社名"] }],
    },
  })
  .eq("id", visitFields["顧客"]);

await admin
  .from("app_fields")
  .update({
    config: {
      source_app_id: productApp.id,
      source_field_id: productFields["商品名"],
      display_field_id: productFields["商品名"],
      mappings: [{ source_field_id: productFields["単価"], target_field_id: visitFields["単価"] }],
    },
  })
  .eq("id", visitFields["商品"]);

await setListFields(visitApp.id, [
  visitFields["訪問日"],
  visitFields["顧客"],
  visitFields["商品"],
  visitFields["商談ステータス"],
  visitFields["担当者"],
]);

// --- カンバン & カレンダー ビューを自動作成 ---
await admin.from("app_views").insert([
  {
    app_id: visitApp.id,
    name: "商談ステータスボード",
    sort_order: 0,
    config: {
      type: "kanban",
      status_field_id: visitFields["商談ステータス"],
      title_field_id: visitFields["顧客"],
      card_field_ids: [visitFields["会社名"], visitFields["商品"], visitFields["担当者"]],
    },
  },
  {
    app_id: visitApp.id,
    name: "訪問カレンダー",
    sort_order: 1,
    config: {
      type: "calendar",
      date_field_id: visitFields["訪問日"],
      default_mode: "month",
      title_field_id: visitFields["会社名"],
      field_ids: [visitFields["商談ステータス"], visitFields["担当者"]],
    },
  },
]);
ok("ビュー作成: 商談ステータスボード（カンバン）/ 訪問カレンダー");

const reps = ["田中 一郎", "佐々木 花子", "高橋 健太", "伊藤 美咲", "渡辺 大輔"];
const STATUS_TEXT = {
  ヒアリング: {
    content: "ニーズヒアリングを実施。現状の課題について確認した。",
    next: "提案書を作成し再訪問",
  },
  提案: {
    content: "提案書を提示し、製品説明を実施。",
    next: "見積もりを提示し価格交渉",
  },
  セミクロージング: {
    content: "見積内容にご納得いただき、導入前提で最終確認中。",
    next: "契約条件の最終調整",
  },
  クロージング: {
    content: "契約条件について最終合意に向け交渉中。",
    next: "契約書送付・締結",
  },
  受注: {
    content: "正式に契約締結、受注確定。",
    next: "納品スケジュール調整",
  },
  失注: {
    content: "予算都合により見送りとなった。",
    next: "半年後に再アプローチ",
  },
  完了: {
    content: "導入・納品が完了し、案件クローズ。",
    next: "アフターフォロー実施",
  },
};

const VISIT_COUNT = 60;
const visits = Array.from({ length: VISIT_COUNT }, () => {
  const customer = pick(customers);
  const product = pick(products);
  const status = pick(DEAL_STATUSES);
  const text = STATUS_TEXT[status.label];
  return {
    id: uuidv4(),
    date: randomDateWithinDays(180),
    customer,
    product,
    rep: pick(reps),
    status,
    content: `${text.content}（${product.name}について）`,
    next: text.next,
  };
});

await admin.from("app_records").insert(
  visits.map((v) => ({ id: v.id, app_id: visitApp.id, tenant_id: TENANT_ID, created_by: null }))
);

await insertRecordValues(
  visits.flatMap((v) => [
    { record_id: v.id, field_id: visitFields["訪問日"], value: v.date },
    {
      record_id: v.id,
      field_id: visitFields["顧客"],
      value: v.customer.contactName,
      referenced_record_id: v.customer.id,
    },
    { record_id: v.id, field_id: visitFields["会社名"], value: v.customer.company },
    {
      record_id: v.id,
      field_id: visitFields["商品"],
      value: v.product.name,
      referenced_record_id: v.product.id,
    },
    { record_id: v.id, field_id: visitFields["単価"], value: String(v.product.price) },
    { record_id: v.id, field_id: visitFields["担当者"], value: v.rep },
    { record_id: v.id, field_id: visitFields["商談ステータス"], value: v.status.value },
    { record_id: v.id, field_id: visitFields["訪問内容"], value: v.content },
    { record_id: v.id, field_id: visitFields["次回アクション"], value: v.next },
  ])
);
ok(`訪問結果データ投入: ${visits.length}件`);

console.log("\n=== 完了 ===");
console.log(`  顧客管理   : ${customers.length}件`);
console.log(`  商品マスタ : ${products.length}件`);
console.log(`  訪問結果   : ${visits.length}件`);
console.log("\n  ダッシュボードのアプリ一覧から確認してください。");
console.log("  「サンプル訪問結果」には商談ステータスのカンバンビューと訪問カレンダーも自動作成済みです。\n");
