"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Sidebar } from "./Sidebar";
import type { SessionProfile } from "@/types";

interface DashboardShellProps {
  profile: SessionProfile;
  apps: { id: string; name: string; icon: string }[];
  children: React.ReactNode;
}

export function DashboardShell({ profile, apps, children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* デスクトップのサイドバー */}
      <div className="hidden md:flex">
        <Sidebar profile={profile} apps={apps} />
      </div>

      {/* モバイルのドロワー */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative h-full">
            <Sidebar
              profile={profile}
              apps={apps}
              forceExpanded
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute top-3 right-3 text-white/80 hover:text-white"
            aria-label="メニューを閉じる"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* モバイルのトップバー */}
        <header className="md:hidden flex items-center gap-3 h-14 px-4 border-b border-gray-200 bg-white shrink-0">
          <button
            onClick={() => setMobileOpen(true)}
            className="text-gray-600 hover:text-gray-900"
            aria-label="メニューを開く"
          >
            <Menu className="w-6 h-6" />
          </button>
          <Link href="/" className="font-bold text-gray-900">
            Bridge-code
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="p-4 sm:p-6 max-w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
