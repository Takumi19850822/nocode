"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Card, Badge, Modal } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import type { App } from "@/types";
import { Plus, Pencil, Settings, LayoutGrid, ArrowLeft } from "lucide-react";

interface TenantAppsManagerProps {
  tenantId: string;
  tenantName: string;
  backHref?: string;
}

export function TenantAppsManager({
  tenantId,
  tenantName,
  backHref,
}: TenantAppsManagerProps) {
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<App | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");

  const loadApps = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error: fetchError } = await supabase
      .from("apps")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order");

    if (fetchError) setError(fetchError.message);
    else {
      setApps(data ?? []);
      setError("");
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setModalOpen(true);
  }

  function openEdit(app: App) {
    setEditing(app);
    setName(app.name);
    setDescription(app.description);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    const supabase = createClient();

    if (editing) {
      const { error: updateError } = await supabase
        .from("apps")
        .update({ name, description })
        .eq("id", editing.id);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("apps").insert({
        name,
        description,
        tenant_id: tenantId,
        sort_order: apps.length,
      });
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    setModalOpen(false);
    setError("");
    loadApps();
  }

  if (loading) return <p className="text-gray-500">読み込み中...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {backHref && (
            <Link href={backHref} className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold">アプリ管理</h1>
            <p className="text-gray-500 text-sm mt-1">
              テナント: <span className="font-medium text-gray-700">{tenantName}</span>
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-1" />
          新規アプリ
        </Button>
      </div>

      {error && !modalOpen && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => (
          <Card key={app.id}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <LayoutGrid className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">{app.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                    {app.description || "説明なし"}
                  </p>
                </div>
              </div>
              <Badge variant={app.is_active ? "success" : "danger"}>
                {app.is_active ? "有効" : "無効"}
              </Badge>
            </div>
            <div className="flex gap-2 mt-4">
              <Link href={`/tenant/apps/${app.id}/builder`} className="flex-1">
                <Button variant="secondary" size="sm" className="w-full">
                  <Settings className="w-3 h-3 mr-1" />
                  設計
                </Button>
              </Link>
              <Link href={`/apps/${app.id}`} className="flex-1">
                <Button size="sm" className="w-full">
                  開く
                </Button>
              </Link>
              <button
                onClick={() => openEdit(app)}
                className="text-gray-400 hover:text-blue-600 p-1"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ))}
        {apps.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400">
            アプリがありません。「新規アプリ」から作成してください。
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "アプリ編集" : "新規アプリ"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>保存</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="アプリ名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Textarea
            label="説明"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>
    </div>
  );
}
