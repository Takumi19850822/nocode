"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Badge, Modal } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import {
  PageBody,
  PageFrame,
  PageHeader,
  PageSection,
} from "@/components/layout/PageLayout";
import type { App } from "@/types";
import { Plus, Pencil, Settings, LayoutGrid } from "lucide-react";

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
    <PageFrame>
      <PageHeader
        title="アプリ管理"
        description={`テナント: ${tenantName}`}
        backHref={backHref}
        actions={
          <Button onClick={openCreate} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1" />
            新規アプリ
          </Button>
        }
      />

      <PageBody>
        {error && !modalOpen && <p className="text-sm text-red-600">{error}</p>}

        <PageSection>
          {apps.length === 0 ? (
            <p className="text-center py-12 text-gray-400">
              アプリがありません。「新規アプリ」から作成してください。
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {apps.map((app) => (
                <li key={app.id} className="py-4 first:pt-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                        <LayoutGrid className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold">{app.name}</h3>
                          <Badge variant={app.is_active ? "success" : "danger"}>
                            {app.is_active ? "有効" : "無効"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {app.description || "説明なし"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Link href={`/tenant/apps/${app.id}/builder`}>
                        <Button variant="secondary" size="sm">
                          <Settings className="w-3 h-3 mr-1" />
                          設計
                        </Button>
                      </Link>
                      <Link href={`/apps/${app.id}`}>
                        <Button size="sm">開く</Button>
                      </Link>
                      <button
                        onClick={() => openEdit(app)}
                        className="text-gray-400 hover:text-blue-600 p-1"
                        title="編集"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PageSection>
      </PageBody>

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
    </PageFrame>
  );
}
