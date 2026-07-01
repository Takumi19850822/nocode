"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Card";
import type { RecordReference } from "@/types";

interface RecordDeleteModalProps {
  appId: string;
  recordId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function RecordDeleteModal({
  appId,
  recordId,
  open,
  onClose,
  onDeleted,
}: RecordDeleteModalProps) {
  const [references, setReferences] = useState<RecordReference[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !recordId) {
      setReferences([]);
      setError("");
      return;
    }

    let cancelled = false;
    setLoadingRefs(true);
    setError("");
    setReferences([]);

    fetch(`/api/apps/${appId}/records/${recordId}`)
      .then(async (res) => {
        const body = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(body.error ?? "参照情報の取得に失敗しました");
          return;
        }
        setReferences(body.references ?? []);
      })
      .catch(() => {
        if (!cancelled) setError("参照情報の取得に失敗しました");
      })
      .finally(() => {
        if (!cancelled) setLoadingRefs(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, recordId, appId]);

  async function confirmDelete() {
    if (!recordId) return;
    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/apps/${appId}/records/${recordId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "削除に失敗しました");
        return;
      }
      onDeleted();
      onClose();
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="レコードを削除"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={deleting || loadingRefs}>
            キャンセル
          </Button>
          <Button
            variant="danger"
            onClick={confirmDelete}
            disabled={deleting || loadingRefs}
          >
            {deleting ? "削除中..." : "削除する"}
          </Button>
        </>
      }
    >
      {loadingRefs && (
        <p className="text-sm text-gray-500">参照情報を確認しています...</p>
      )}
      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
      {!loadingRefs && !error && references.length === 0 && (
        <p className="text-sm text-gray-600">
          このレコードを削除しますか？この操作は取り消せません。
        </p>
      )}
      {!loadingRefs && references.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            このレコードは <strong>{references.length}件</strong>{" "}
            の他レコードから参照されています。削除すると、参照元の検索フィールドの値がクリアされます。
          </p>
          <ul className="max-h-40 overflow-y-auto border rounded-lg divide-y text-sm">
            {references.map((ref) => (
              <li key={ref.value_id} className="px-3 py-2">
                <span className="font-medium">{ref.app_name}</span>
                <span className="text-gray-500"> — {ref.field_label}: </span>
                <span className="text-gray-700">{ref.display_value}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-red-600">本当に削除しますか？</p>
        </div>
      )}
    </Modal>
  );
}
