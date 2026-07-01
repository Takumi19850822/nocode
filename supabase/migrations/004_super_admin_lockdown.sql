-- super_admin を固定し、テナントユーザー運用を明確化

-- 1. 初回ユーザー自動 super_admin 昇格を無効化
DROP TRIGGER IF EXISTS on_profile_created_promote ON public.profiles;
DROP FUNCTION IF EXISTS public.promote_first_user_to_admin();

-- 2. super_admin への昇格を DB レベルで禁止（SQL 直接実行のみ可）
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role user_role;
BEGIN
  -- super_admin への昇格はアプリ/API から不可
  IF TG_OP = 'UPDATE' AND NEW.role = 'super_admin' AND OLD.role IS DISTINCT FROM 'super_admin' THEN
    NEW.role := OLD.role;
  END IF;

  actor_role := get_user_role();

  -- 一般ユーザーが自分のプロフィールを更新
  IF TG_OP = 'UPDATE' AND auth.uid() = OLD.id AND actor_role = 'user' THEN
    NEW.role := OLD.role;
    NEW.tenant_id := OLD.tenant_id;
    NEW.is_active := OLD.is_active;
  END IF;

  -- テナント管理者: super_admin 昇格禁止、自テナント外は変更不可
  IF TG_OP = 'UPDATE' AND actor_role = 'tenant_admin' AND auth.uid() IS DISTINCT FROM OLD.id THEN
    IF OLD.tenant_id IS DISTINCT FROM get_user_tenant_id() THEN
      RAISE EXCEPTION 'permission denied';
    END IF;
    IF NEW.role = 'super_admin' THEN
      NEW.role := OLD.role;
    END IF;
    -- テナント管理者は tenant_admin の任命不可（一般ユーザーのみ管理）
    IF NEW.role = 'tenant_admin' AND OLD.role IS DISTINCT FROM 'tenant_admin' THEN
      NEW.role := OLD.role;
    END IF;
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id AND NEW.tenant_id IS DISTINCT FROM get_user_tenant_id() THEN
      NEW.tenant_id := OLD.tenant_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. super_admin はテナントに所属させない（プラットフォーム管理者は tenant_id NULL）
CREATE OR REPLACE FUNCTION public.prevent_super_admin_tenant_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'super_admin' THEN
    NEW.tenant_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_super_admin_tenant ON public.profiles;
CREATE TRIGGER prevent_super_admin_tenant
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_super_admin_tenant_assignment();
