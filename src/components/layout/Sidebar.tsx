"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutGrid,
  LogOut,
  Settings,
  Users,
  Shield,
} from "lucide-react";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  profile: Profile;
  apps: { id: string; name: string; icon: string }[];
}

export function Sidebar({ profile, apps }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isSuperAdmin = profile.role === "super_admin";
  const isTenantAdmin = profile.role === "tenant_admin";
  const showTenantMenu =
    isTenantAdmin || (isSuperAdmin && Boolean(profile.tenant_id));

  const adminLinks = [
    { href: "/admin/tenants", label: "テナント管理", icon: Building2 },
    { href: "/admin/users", label: "ユーザー管理", icon: Users },
    { href: "/admin/settings", label: "システム設定", icon: Settings },
  ];

  const tenantLinks = [
    { href: "/tenant/users", label: "ユーザー管理", icon: Users },
    { href: "/tenant/apps", label: "アプリ管理", icon: LayoutGrid },
    { href: "/tenant/settings", label: "テナント設定", icon: Settings },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 bg-sidebar text-white flex flex-col shrink-0">
      <div className="p-4 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <Shield className="w-6 h-6 text-blue-400" />
          NoCode Platform
        </Link>
        <p className="text-xs text-gray-400 mt-1 truncate">
          {getProfileDisplayName(profile) || "（氏名未設定）"}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {isSuperAdmin && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              Admin
            </p>
            <ul className="space-y-1">
              {adminLinks.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  active={pathname.startsWith(link.href)}
                />
              ))}
            </ul>
          </div>
        )}

        {showTenantMenu && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              テナント管理
            </p>
            <ul className="space-y-1">
              {tenantLinks.map((link) => (
                <NavItem
                  key={link.href}
                  href={link.href}
                  label={link.label}
                  icon={link.icon}
                  active={pathname.startsWith(link.href)}
                />
              ))}
            </ul>
          </div>
        )}

        {apps.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
              アプリ
            </p>
            <ul className="space-y-1">
              {apps.map((app) => (
                <NavItem
                  key={app.id}
                  href={`/apps/${app.id}`}
                  label={app.name}
                  icon={LayoutGrid}
                  active={pathname.startsWith(`/apps/${app.id}`)}
                />
              ))}
            </ul>
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-sidebar-hover transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ログアウト
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
          active
            ? "bg-sidebar-active text-white"
            : "text-gray-300 hover:bg-sidebar-hover"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        <span className="truncate">{label}</span>
      </Link>
    </li>
  );
}
