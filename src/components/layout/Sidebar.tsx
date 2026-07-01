"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutGrid,
  LogOut,
  Users,
  Shield,
  Check,
  ChevronsUpDown,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { getProfileDisplayName } from "@/lib/auth/profileDisplayName";
import { cn } from "@/lib/utils";
import type { SessionProfile, TenantMembership } from "@/types";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  profile: SessionProfile;
  apps: { id: string; name: string; icon: string }[];
}

const COLLAPSE_KEY = "sidebar-collapsed";

export function Sidebar({ profile, apps }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      return next;
    });
  }

  const isSuperAdmin = profile.role === "super_admin";
  const isTenantAdmin = profile.role === "tenant_admin";
  const showTenantMenu =
    isTenantAdmin || (isSuperAdmin && Boolean(profile.tenant_id));

  // 機能が存在するメニューのみ表示（システム設定 / テナント設定は非表示）
  const adminLinks = [
    { href: "/admin/tenants", label: "テナント管理", icon: Building2 },
    { href: "/admin/users", label: "ユーザー管理", icon: Users },
  ];

  const tenantLinks = [
    { href: "/tenant/users", label: "ユーザー管理", icon: Users },
    { href: "/tenant/apps", label: "アプリ管理", icon: LayoutGrid },
  ];

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "bg-sidebar text-white flex flex-col shrink-0 transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="p-4 border-b border-white/10 flex items-center justify-between gap-2">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2 font-bold min-w-0",
            collapsed && "justify-center w-full"
          )}
        >
          <Shield className="w-6 h-6 text-blue-400 shrink-0" />
          {!collapsed && (
            <span className="leading-tight min-w-0">
              <span className="block text-lg truncate">Bridge-code</span>
              <span className="block text-[10px] font-normal text-gray-400 truncate">
                by ForvalCrossGear+
              </span>
            </span>
          )}
        </Link>
        {!collapsed && (
          <button
            onClick={toggleCollapsed}
            className="text-gray-400 hover:text-white p-1 shrink-0"
            title="メニューを折りたたむ"
          >
            <PanelLeftClose className="w-5 h-5" />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={toggleCollapsed}
          className="flex justify-center py-2 text-gray-400 hover:text-white border-b border-white/10"
          title="メニューを開く"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>
      )}

      {!collapsed && (
        <p className="px-4 py-2 text-xs text-gray-400 truncate border-b border-white/10">
          {getProfileDisplayName(profile) || "（氏名未設定）"}
        </p>
      )}

      <TenantSwitcher
        memberships={profile.memberships}
        activeTenantId={profile.active_tenant_id}
        collapsed={collapsed}
      />

      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {isSuperAdmin && (
          <NavSection label="Admin" collapsed={collapsed}>
            {adminLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={pathname.startsWith(link.href)}
                collapsed={collapsed}
              />
            ))}
          </NavSection>
        )}

        {showTenantMenu && (
          <NavSection label="テナント管理" collapsed={collapsed}>
            {tenantLinks.map((link) => (
              <NavItem
                key={link.href}
                href={link.href}
                label={link.label}
                icon={link.icon}
                active={pathname.startsWith(link.href)}
                collapsed={collapsed}
              />
            ))}
          </NavSection>
        )}

        {apps.length > 0 && (
          <NavSection label="アプリ" collapsed={collapsed}>
            {apps.map((app) => (
              <NavItem
                key={app.id}
                href={`/apps/${app.id}`}
                label={app.name}
                icon={LayoutGrid}
                active={pathname.startsWith(`/apps/${app.id}`)}
                collapsed={collapsed}
              />
            ))}
          </NavSection>
        )}
      </nav>

      <div className="p-3 border-t border-white/10">
        <button
          onClick={handleLogout}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-gray-300 hover:bg-sidebar-hover transition-colors",
            collapsed && "justify-center px-0"
          )}
          title="ログアウト"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && "ログアウト"}
        </button>
      </div>
    </aside>
  );
}

function NavSection({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      {!collapsed && (
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-2">
          {label}
        </p>
      )}
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function TenantSwitcher({
  memberships,
  activeTenantId,
  collapsed,
}: {
  memberships: TenantMembership[];
  activeTenantId: string | null;
  collapsed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  if (memberships.length === 0) return null;

  const active =
    memberships.find((m) => m.tenant_id === activeTenantId) ?? memberships[0];
  const canSwitch = memberships.length > 1;

  async function switchTenant(tenantId: string) {
    setOpen(false);
    if (tenantId === activeTenantId) return;
    setSwitching(true);
    const res = await fetch("/api/session/active-tenant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantId }),
    });
    setSwitching(false);
    if (res.ok) {
      router.refresh();
    }
  }

  return (
    <div className="px-3 py-3 border-b border-white/10 relative">
      {!collapsed && (
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 mb-1">
          テナント
        </p>
      )}
      <button
        type="button"
        onClick={() => canSwitch && setOpen((v) => !v)}
        disabled={!canSwitch || switching}
        title={active.tenant_name}
        className={cn(
          "flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-sm bg-white/5",
          collapsed && "justify-center px-0",
          canSwitch ? "hover:bg-white/10 cursor-pointer" : "cursor-default"
        )}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Building2 className="w-4 h-4 shrink-0 text-blue-400" />
          {!collapsed && (
            <span className="truncate font-medium">
              {switching ? "切替中..." : active.tenant_name || "（テナント）"}
            </span>
          )}
        </span>
        {!collapsed && canSwitch && (
          <ChevronsUpDown className="w-4 h-4 shrink-0 text-gray-400" />
        )}
      </button>

      {open && canSwitch && (
        <ul
          className={cn(
            "absolute mt-1 z-20 bg-sidebar border border-white/10 rounded-lg shadow-xl overflow-hidden max-h-72 overflow-y-auto",
            collapsed ? "left-2 w-56" : "left-3 right-3"
          )}
        >
          {memberships.map((m) => (
            <li key={m.tenant_id}>
              <button
                type="button"
                onClick={() => switchTenant(m.tenant_id)}
                className="flex items-center justify-between gap-2 w-full px-3 py-2 text-sm text-left hover:bg-sidebar-hover"
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{m.tenant_name || "（テナント）"}</span>
                  <span className="text-[10px] text-gray-400">
                    {m.role === "tenant_admin" ? "管理者" : "一般"}
                  </span>
                </span>
                {m.tenant_id === active.tenant_id && (
                  <Check className="w-4 h-4 shrink-0 text-blue-400" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
}) {
  return (
    <li>
      <Link
        href={href}
        title={label}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
          collapsed && "justify-center px-0",
          active
            ? "bg-sidebar-active text-white"
            : "text-gray-300 hover:bg-sidebar-hover"
        )}
      >
        <Icon className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    </li>
  );
}
