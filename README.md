# NoCode Platform — マルチテナント ノーコードツール

Next.js + Cloudflare Pages + Supabase で構築するマルチテナント型ノーコードアプリケーションプラットフォームです。

## 構成

```
Admin（スーパー管理者）
  └── テナント管理
  └── 全ユーザー管理
  └── システム設定

テナント管理者
  └── ユーザー管理（テナント内ユーザーの追加）
  └── アプリ管理（ノーコードフォーム設計）
  └── テナント設定

一般ユーザー
  └── アプリ利用（レコードの作成・閲覧）
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 15 (App Router) |
| スタイリング | Tailwind CSS 4 |
| 認証・DB | Supabase (Auth + PostgreSQL + RLS) |
| デプロイ | Cloudflare Pages |
| D&D | @dnd-kit |

## セットアップ

### 1. Supabase プロジェクト作成

1. [Supabase](https://supabase.com) でプロジェクトを作成
2. SQL Editor で `supabase/migrations/001_initial_schema.sql` を実行
3. Authentication > Settings で Email 認証を有効化

### 2. 環境変数

```bash
cp .env.local.example .env.local
```

`.env.local` に Supabase の URL とキーを設定:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### 3. 初期管理者の作成

Supabase Auth でユーザーを作成後、SQL Editor で:

```sql
UPDATE profiles
SET role = 'super_admin'
WHERE email = 'admin@example.com';
```

### 4. 開発サーバー起動

```bash
npm install
npm run dev
```

http://localhost:3000 でアクセス

### 5. Cloudflare Pages デプロイ

```bash
npm run pages:build
npm run pages:deploy
```

Cloudflare Dashboard で環境変数も設定してください。

## フィールドタイプ

| タイプ | 説明 |
|--------|------|
| text | テキスト（1行） |
| textarea | テキスト（複数行） |
| number | 数値 |
| date | 日付 |
| datetime | 日時 |
| duration | 所要時間 |
| select | プルダウン |
| radio | ラジオボタン |
| checkbox | チェックボックス |
| search | 他アプリからの検索・転記 |
| calculation | 四則演算（Excel的） |

## アプリビルダー機能

- **ドラッグ&ドロップ**: フィールドの並び替え
- **幅調整**: 各フィールド 25% / 50% / 75% / 100%
- **必須/非必須**: 項目ごとに設定
- **検索フィールド**: 対象アプリ・フィールド選択、転記マッピング
- **計算フィールド**: ウィザード形式でフィールド + 演算子を組み合わせ

## ディレクトリ構成

```
src/
├── app/
│   ├── (dashboard)/          # 認証済みレイアウト
│   │   ├── admin/            # スーパー管理者画面
│   │   ├── tenant/           # テナント管理者画面
│   │   │   └── apps/[id]/builder/  # アプリビルダー
│   │   └── apps/[id]/        # アプリ実行画面
│   └── login/
├── components/
│   ├── builder/              # ビルダー関連
│   ├── layout/               # サイドバー等
│   └── ui/                   # 共通UI
├── lib/
│   ├── supabase/             # Supabase クライアント
│   └── utils.ts
└── types/
supabase/
└── migrations/               # DB マイグレーション
```

## ライセンス

MIT
