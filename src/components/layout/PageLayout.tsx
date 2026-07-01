"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createContext, useContext } from "react";
import { cn } from "@/lib/utils";

/** PageHeader 内かどうか（ボタンの見た目調整用） */
export const PageHeaderContext = createContext(false);
export function useInPageHeader() {
  return useContext(PageHeaderContext);
}

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  action?: React.ReactNode;
  /** 上に区切り線を表示 */
  bordered?: boolean;
}

/** カード枠なしのページセクション */
export function PageSection({
  children,
  className,
  title,
  action,
  bordered = false,
}: PageSectionProps) {
  return (
    <section
      className={cn(
        "min-w-0",
        bordered && "border-t border-gray-200 pt-8",
        className
      )}
    >
      {(title || action) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4 pb-3 border-b border-gray-200">
          {title && (
            <h2 className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 tracking-tight">
              <span className="w-0.5 h-4 bg-primary rounded-full shrink-0" aria-hidden />
              {title}
            </h2>
          )}
          {action && <div className="w-full sm:w-auto shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  backHref?: string;
}

/** メインカラム上部のページヘッダー */
export function PageHeader({ title, description, actions, backHref }: PageHeaderProps) {
  return (
    <PageHeaderContext.Provider value={true}>
      <header className="bg-gradient-to-r from-header-from via-header-via to-header-to border-b border-slate-950/50 px-4 sm:px-6 py-2.5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="text-slate-300 hover:text-white shrink-0"
                aria-label="戻る"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-white break-words leading-tight">{title}</h1>
              {description && (
                <p className="text-slate-400 text-xs mt-0.5 break-words leading-snug">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex flex-col sm:flex-row gap-1.5 w-full sm:w-auto shrink-0 [&_button]:px-3 [&_button]:py-1.5 [&_button]:text-sm">
              {actions}
            </div>
          )}
        </div>
      </header>
    </PageHeaderContext.Provider>
  );
}

/** ヘッダー下のコンテンツをフル幅白背景で包む */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-white px-4 sm:px-6 py-6 space-y-8", className)}>
      {children}
    </div>
  );
}

/** ダッシュボード内でヘッダーを横・上いっぱいに広げるラッパー */
export function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 min-w-0">{children}</div>;
}
