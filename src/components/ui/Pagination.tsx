"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

/** 汎用ページネーション（1始まり）。総件数が1ページに収まる場合は非表示。 */
export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-4 mt-2 border-t border-gray-100 text-sm">
      <span className="text-gray-500">
        {from}–{to} / {total}件
      </span>
      <div className="flex items-center justify-center sm:justify-end gap-1">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200",
            page <= 1
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          <ChevronLeft className="w-4 h-4" />
          前へ
        </button>
        <span className="px-2 text-gray-600">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200",
            page >= totalPages
              ? "text-gray-300 cursor-not-allowed"
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          次へ
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
