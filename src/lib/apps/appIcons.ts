import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bookmark,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Clock,
  Database,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Heart,
  Kanban,
  Layers,
  LayoutGrid,
  ListChecks,
  Mail,
  MapPin,
  Package,
  Phone,
  Settings,
  ShoppingCart,
  Star,
  Table,
  Tag,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

/** サイドバー等で使うアプリアイコン（Lucide・同一テイスト） */
export const APP_ICON_OPTIONS = [
  { key: "layout-grid", label: "グリッド", Icon: LayoutGrid },
  { key: "clipboard-list", label: "リスト", Icon: ClipboardList },
  { key: "list-checks", label: "チェックリスト", Icon: ListChecks },
  { key: "table", label: "テーブル", Icon: Table },
  { key: "kanban", label: "カンバン", Icon: Kanban },
  { key: "calendar", label: "カレンダー", Icon: Calendar },
  { key: "file-text", label: "ドキュメント", Icon: FileText },
  { key: "file-spreadsheet", label: "表計算", Icon: FileSpreadsheet },
  { key: "folder-open", label: "フォルダ", Icon: FolderOpen },
  { key: "database", label: "データベース", Icon: Database },
  { key: "bar-chart-3", label: "グラフ", Icon: BarChart3 },
  { key: "users", label: "ユーザー", Icon: Users },
  { key: "building-2", label: "ビル", Icon: Building2 },
  { key: "briefcase", label: "ビジネス", Icon: Briefcase },
  { key: "package", label: "荷物", Icon: Package },
  { key: "shopping-cart", label: "カート", Icon: ShoppingCart },
  { key: "truck", label: "配送", Icon: Truck },
  { key: "wallet", label: "ウォレット", Icon: Wallet },
  { key: "mail", label: "メール", Icon: Mail },
  { key: "phone", label: "電話", Icon: Phone },
  { key: "map-pin", label: "場所", Icon: MapPin },
  { key: "clock", label: "時計", Icon: Clock },
  { key: "tag", label: "タグ", Icon: Tag },
  { key: "bookmark", label: "ブックマーク", Icon: Bookmark },
  { key: "star", label: "スター", Icon: Star },
  { key: "heart", label: "ハート", Icon: Heart },
  { key: "layers", label: "レイヤー", Icon: Layers },
  { key: "settings", label: "設定", Icon: Settings },
] as const;

export type AppIconKey = (typeof APP_ICON_OPTIONS)[number]["key"];

export const DEFAULT_APP_ICON: AppIconKey = "layout-grid";

const ICON_MAP = new Map<string, LucideIcon>(
  APP_ICON_OPTIONS.map((o) => [o.key, o.Icon])
);

export function getAppIcon(key: string | null | undefined): LucideIcon {
  return ICON_MAP.get(key ?? "") ?? LayoutGrid;
}

export function sanitizeAppIcon(key: string | null | undefined): AppIconKey {
  if (key && ICON_MAP.has(key)) return key as AppIconKey;
  return DEFAULT_APP_ICON;
}

export function getAppIconLabel(key: string): string {
  return APP_ICON_OPTIONS.find((o) => o.key === key)?.label ?? "グリッド";
}
