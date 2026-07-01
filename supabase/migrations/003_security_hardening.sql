-- セキュリティ強化
-- Supabase SQL Editor で実行してください

-- 1. 緩い INSERT ポリシーを削除（トリガーは SECURITY DEFINER で RLS をバイパス）
DROP POLICY IF EXISTS "allow_signup_insert" ON profiles;

-- 2. 自分の role / tenant_id / is_active を勝手に変えられないようにする
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  actor_role := get_user_role();

  -- 一般ユーザーが自分のプロフィールを更新
  IF auth.uid() = OLD.id AND actor_role = 'user' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
  END IF;

  -- テナント管理者: super_admin への昇格禁止、自テナント外のユーザーは変更不可
  IF actor_role = 'tenant_admin' AND auth.uid() IS DISTINCT FROM OLD.id THEN
    IF OLD.tenant_id IS DISTINCT FROM get_user_tenant_id() THEN
      RAISE EXCEPTION 'permission denied';
    END IF;
    IF NEW.role = 'super_admin' THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND NEW.tenant_id IS DISTINCT FROM get_user_tenant_id() THEN
      NEW.tenant_id := OLD.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_columns ON profiles;
CREATE TRIGGER protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- 3. サインアップ可否（初回ユーザーのみ許可）
CREATE OR REPLACE FUNCTION public.is_signup_allowed()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*) = 0 FROM public.profiles;
$$;

REVOKE ALL ON FUNCTION public.is_signup_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_signup_allowed() TO anon, authenticated;

-- 5. apps / app_fields: 一般ユーザーは読み取りのみ、管理は tenant_admin 以上
DROP POLICY IF EXISTS "tenant_users_own_tenant_apps" ON apps;
CREATE POLICY "tenant_users_read_own_tenant_apps" ON apps
  FOR SELECT USING (tenant_id = get_user_tenant_id());

CREATE POLICY "tenant_admin_manage_own_tenant_apps" ON apps
  FOR ALL USING (
    tenant_id = get_user_tenant_id()
    AND get_user_role() IN ('tenant_admin', 'super_admin')
  );

DROP POLICY IF EXISTS "tenant_users_own_fields" ON app_fields;
CREATE POLICY "tenant_users_read_own_fields" ON app_fields
  FOR SELECT USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
  );

CREATE POLICY "tenant_admin_manage_own_fields" ON app_fields
  FOR ALL USING (
    app_id IN (SELECT id FROM apps WHERE tenant_id = get_user_tenant_id())
    AND get_user_role() IN ('tenant_admin', 'super_admin')
  );

-- 6. handle_new_user を再確認（SECURITY DEFINER）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
