-- マルチテナント ノーコードツール 初期スキーマ

-- ロール enum
CREATE TYPE user_role AS ENUM ('super_admin', 'tenant_admin', 'user');

-- フィールドタイプ enum
CREATE TYPE field_type AS ENUM (
  'text',
  'textarea',
  'number',
  'date',
  'datetime',
  'duration',
  'select',
  'radio',
  'checkbox',
  'search',
  'calculation'
);

-- テナント
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- プロファイル（Supabase Auth と連携）
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  role user_role NOT NULL DEFAULT 'user',
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- アプリ定義
CREATE TABLE apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'layout-grid',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- フィールド定義
CREATE TABLE app_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0,
  width INT NOT NULL DEFAULT 100, -- パーセント (25, 50, 75, 100)
  placeholder TEXT DEFAULT '',
  default_value TEXT DEFAULT '',
  options JSONB DEFAULT '[]', -- select/radio/checkbox 用
  config JSONB DEFAULT '{}',   -- search/calculation 等の拡張設定
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- レコード（アプリのデータ行）
CREATE TABLE app_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- レコード値
CREATE TABLE app_record_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES app_records(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES app_fields(id) ON DELETE CASCADE,
  value TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(record_id, field_id)
);

-- インデックス
CREATE INDEX idx_profiles_tenant ON profiles(tenant_id);
CREATE INDEX idx_apps_tenant ON apps(tenant_id);
CREATE INDEX idx_app_fields_app ON app_fields(app_id);
CREATE INDEX idx_app_records_app ON app_records(app_id);
CREATE INDEX idx_app_records_tenant ON app_records(tenant_id);
CREATE INDEX idx_record_values_record ON app_record_values(record_id);
CREATE INDEX idx_record_values_field ON app_record_values(field_id);

-- updated_at 自動更新
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON apps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_fields_updated BEFORE UPDATE ON app_fields FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_app_records_updated BEFORE UPDATE ON app_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_record_values_updated BEFORE UPDATE ON app_record_values FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS 有効化
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_record_values ENABLE ROW LEVEL SECURITY;

-- ヘルパー関数: 現在のユーザーのロール取得
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS ポリシー: profiles
CREATE POLICY "super_admin_all_profiles" ON profiles
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_admin_own_tenant_profiles" ON profiles
  FOR ALL USING (
    get_user_role() = 'tenant_admin' AND tenant_id = get_user_tenant_id()
  );

CREATE POLICY "users_read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE USING (id = auth.uid());

-- RLS ポリシー: tenants
CREATE POLICY "super_admin_all_tenants" ON tenants
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_admin_read_own_tenant" ON tenants
  FOR SELECT USING (id = get_user_tenant_id());

CREATE POLICY "users_read_own_tenant" ON tenants
  FOR SELECT USING (id = get_user_tenant_id());

-- RLS ポリシー: apps
CREATE POLICY "super_admin_all_apps" ON apps
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_users_own_tenant_apps" ON apps
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- RLS ポリシー: app_fields
CREATE POLICY "super_admin_all_fields" ON app_fields
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_users_own_fields" ON app_fields
  FOR ALL USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

-- RLS ポリシー: app_records
CREATE POLICY "super_admin_all_records" ON app_records
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_users_own_records" ON app_records
  FOR ALL USING (tenant_id = get_user_tenant_id());

-- RLS ポリシー: app_record_values
CREATE POLICY "super_admin_all_values" ON app_record_values
  FOR ALL USING (get_user_role() = 'super_admin');

CREATE POLICY "tenant_users_own_values" ON app_record_values
  FOR ALL USING (
    record_id IN (SELECT id FROM app_records WHERE tenant_id = get_user_tenant_id())
  );

-- 新規ユーザー登録時にプロファイル自動作成
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
