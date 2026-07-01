-- 009: 複数テナント所属（メンバーシップ制）とテナント切替
-- Supabase SQL Editor で 008 までの適用後に実行してください。
-- 概要:
--   * 1ユーザーが複数テナントに所属できるよう tenant_members を追加
--   * profiles.active_tenant_id で「現在作業中のテナント」を管理
--   * RLS ヘルパー get_user_tenant_id() を active テナント基準に再定義
--   * テナント内ロールは tenant_members.role が正（profiles.role は super_admin 判定専用）

-- =========================================================
-- 1. tenant_members テーブル
-- =========================================================
CREATE TABLE IF NOT EXISTS tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'user',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant ON tenant_members(tenant_id);

DROP TRIGGER IF EXISTS trg_tenant_members_updated ON tenant_members;
CREATE TRIGGER trg_tenant_members_updated
  BEFORE UPDATE ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =========================================================
-- 2. profiles.active_tenant_id
-- =========================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS active_tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL;

-- =========================================================
-- 3. 既存データ移行
-- =========================================================
INSERT INTO tenant_members (user_id, tenant_id, role, is_active)
SELECT id, tenant_id, role, is_active
FROM profiles
WHERE tenant_id IS NOT NULL
  AND role <> 'super_admin'
ON CONFLICT (user_id, tenant_id) DO NOTHING;

UPDATE profiles
SET active_tenant_id = tenant_id
WHERE tenant_id IS NOT NULL
  AND active_tenant_id IS NULL
  AND role <> 'super_admin';

-- =========================================================
-- 4. ヘルパー関数（すべて SECURITY DEFINER = RLS をバイパスし再帰を防ぐ）
-- =========================================================

-- 現在作業中テナント（active かつ在籍中の場合のみ返す）。
-- 既存の apps/app_fields/app_records/app_record_values ポリシーはこの関数を
-- 参照しているため、これで自動的に active テナントスコープになる。
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT tm.tenant_id
  FROM tenant_members tm
  JOIN profiles p ON p.id = tm.user_id
  WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = p.active_tenant_id
    AND tm.is_active
  LIMIT 1;
$$;

-- active テナントでのロール
CREATE OR REPLACE FUNCTION get_active_tenant_role()
RETURNS user_role
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT tm.role
  FROM tenant_members tm
  JOIN profiles p ON p.id = tm.user_id
  WHERE tm.user_id = auth.uid()
    AND tm.tenant_id = p.active_tenant_id
    AND tm.is_active
  LIMIT 1;
$$;

-- 指定テナントの管理者か（active に関係なく在籍ベース）
CREATE OR REPLACE FUNCTION is_tenant_admin(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = tid
      AND role = 'tenant_admin'
      AND is_active
  );
$$;

-- 指定テナントに在籍しているか
CREATE OR REPLACE FUNCTION is_tenant_member(tid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = auth.uid()
      AND tenant_id = tid
      AND is_active
  );
$$;

-- 対象ユーザーが自分の active テナントに在籍しているか（プロフィール管理用）
CREATE OR REPLACE FUNCTION shares_active_tenant(target UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM tenant_members
    WHERE user_id = target
      AND tenant_id = get_user_tenant_id()
      AND is_active
  );
$$;

-- =========================================================
-- 5. tenant_members の RLS
-- =========================================================
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_all_members" ON tenant_members;
CREATE POLICY "super_admin_all_members" ON tenant_members
  FOR ALL USING (get_user_role() = 'super_admin');

DROP POLICY IF EXISTS "self_read_members" ON tenant_members;
CREATE POLICY "self_read_members" ON tenant_members
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "tenant_admin_read_members" ON tenant_members;
CREATE POLICY "tenant_admin_read_members" ON tenant_members
  FOR SELECT USING (is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "tenant_admin_insert_members" ON tenant_members;
CREATE POLICY "tenant_admin_insert_members" ON tenant_members
  FOR INSERT WITH CHECK (is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "tenant_admin_update_members" ON tenant_members;
CREATE POLICY "tenant_admin_update_members" ON tenant_members
  FOR UPDATE USING (is_tenant_admin(tenant_id));

DROP POLICY IF EXISTS "tenant_admin_delete_members" ON tenant_members;
CREATE POLICY "tenant_admin_delete_members" ON tenant_members
  FOR DELETE USING (is_tenant_admin(tenant_id));

-- テナント管理者は tenant_admin ロールを付与できない（一般ユーザーのみ）。
-- super_admin もしくはサービスロール(auth.uid() IS NULL)は制限なし。
CREATE OR REPLACE FUNCTION protect_tenant_member_role()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_user_role() = 'super_admin' OR auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'tenant_admin' THEN
    RAISE EXCEPTION 'tenant_admin role can only be granted by super_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_tenant_member_role ON tenant_members;
CREATE TRIGGER trg_protect_tenant_member_role
  BEFORE INSERT OR UPDATE ON tenant_members
  FOR EACH ROW EXECUTE FUNCTION protect_tenant_member_role();

-- =========================================================
-- 6. tenants の RLS: 在籍しているテナントを読めるように
-- =========================================================
DROP POLICY IF EXISTS "users_read_own_tenant" ON tenants;
DROP POLICY IF EXISTS "tenant_admin_read_own_tenant" ON tenants;
DROP POLICY IF EXISTS "members_read_member_tenants" ON tenants;
CREATE POLICY "members_read_member_tenants" ON tenants
  FOR SELECT USING (is_tenant_member(id));

-- =========================================================
-- 7. profiles の RLS: テナント管理者は active テナント在籍者のみ管理
-- =========================================================
DROP POLICY IF EXISTS "tenant_admin_own_tenant_profiles" ON profiles;
DROP POLICY IF EXISTS "tenant_admin_manage_member_profiles" ON profiles;
CREATE POLICY "tenant_admin_manage_member_profiles" ON profiles
  FOR ALL USING (
    get_active_tenant_role() = 'tenant_admin'
    AND shares_active_tenant(profiles.id)
  );

-- =========================================================
-- 8. apps / app_fields の管理ポリシーを active ロール基準に更新
-- =========================================================
DROP POLICY IF EXISTS "tenant_admin_manage_own_tenant_apps" ON apps;
CREATE POLICY "tenant_admin_manage_own_tenant_apps" ON apps
  FOR ALL USING (
    tenant_id = get_user_tenant_id()
    AND get_active_tenant_role() = 'tenant_admin'
  );

DROP POLICY IF EXISTS "tenant_admin_manage_own_fields" ON app_fields;
CREATE POLICY "tenant_admin_manage_own_fields" ON app_fields
  FOR ALL USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
    AND get_active_tenant_role() = 'tenant_admin'
  );

-- =========================================================
-- 9. profiles 更新ガード（active_tenant_id 改ざん防止・他人編集は氏名のみ）
-- =========================================================
CREATE OR REPLACE FUNCTION protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  -- super_admin への昇格はアプリ/API から不可
  IF TG_OP = 'UPDATE' AND NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    NEW.role := OLD.role;
  END IF;

  actor_role := get_user_role();

  -- active_tenant_id は在籍テナントのみ選択可（super_admin / サービスロールは除外）
  IF TG_OP = 'UPDATE'
     AND NEW.active_tenant_id IS DISTINCT FROM OLD.active_tenant_id
     AND NEW.active_tenant_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin'
     AND NOT EXISTS (
       SELECT 1 FROM tenant_members
       WHERE user_id = NEW.id
         AND tenant_id = NEW.active_tenant_id
         AND is_active
     ) THEN
    RAISE EXCEPTION 'not a member of the selected tenant';
  END IF;

  -- 一般ユーザーが自分のプロフィールを更新: active_tenant_id と display_name 以外は変更不可
  IF TG_OP = 'UPDATE' AND auth.uid() = OLD.id AND actor_role = 'user' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
  END IF;

  -- 非 super_admin が他人のプロフィールを更新する場合は display_name のみ変更可
  IF TG_OP = 'UPDATE'
     AND auth.uid() IS DISTINCT FROM OLD.id
     AND auth.uid() IS NOT NULL
     AND COALESCE(actor_role, 'user') <> 'super_admin' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
    NEW.active_tenant_id := OLD.active_tenant_id;
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

-- トリガーは 003 で作成済み（protect_profile_columns）。関数の差し替えのみで反映される。
