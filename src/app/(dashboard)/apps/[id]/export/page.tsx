"use client";



import { useEffect, useState } from "react";

import Link from "next/link";

import { useParams, useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase/client";

import { Button } from "@/components/ui/Button";

import {

  PageBody,

  PageFrame,

  PageHeader,

  PageSection,

} from "@/components/layout/PageLayout";

import { ExportFieldPicker } from "@/components/records/ExportFieldPicker";

import { getListDisplayFields } from "@/lib/records/getListDisplayFields";

import type { App, AppField, AppRecordExport } from "@/types";

import { FileSpreadsheet, Loader2 } from "lucide-react";



export default function RecordExportPage() {

  const params = useParams();

  const router = useRouter();

  const appId = params.id as string;



  const [app, setApp] = useState<App | null>(null);

  const [fields, setFields] = useState<AppField[]>([]);

  const [selectedFieldIds, setSelectedFieldIds] = useState<string[]>([]);

  const [includeCreatedAt, setIncludeCreatedAt] = useState(true);

  const [includeUpdatedAt, setIncludeUpdatedAt] = useState(false);

  const [loading, setLoading] = useState(true);

  const [generating, setGenerating] = useState(false);

  const [error, setError] = useState("");



  const supabase = createClient();



  useEffect(() => {

    async function load() {

      setLoading(true);

      const { data: appData } = await supabase

        .from("apps")

        .select("*")

        .eq("id", appId)

        .single();

      if (!appData) {

        setLoading(false);

        return;

      }

      setApp(appData);



      const { data: fieldsData } = await supabase

        .from("app_fields")

        .select("*")

        .eq("app_id", appId)

        .order("sort_order");



      const fieldList = (fieldsData as AppField[] | null) ?? [];

      setFields(fieldList);



      const defaultIds = getListDisplayFields(fieldList, appData.list_field_ids).map(

        (f) => f.id

      );

      setSelectedFieldIds(

        defaultIds.length > 0 ? defaultIds : fieldList.map((f) => f.id)

      );



      setLoading(false);

    }

    load();

  }, [appId, supabase]);



  async function downloadExport(exportId: string, fileName: string) {

    const res = await fetch(`/api/apps/${appId}/exports/${exportId}/download`);

    if (!res.ok) return;

    const blob = await res.blob();

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = fileName;

    a.click();

    URL.revokeObjectURL(url);

  }



  async function handleGenerate() {

    setError("");

    if (selectedFieldIds.length === 0) {

      setError("出力項目を1つ以上選択してください");

      return;

    }



    setGenerating(true);

    try {

      const res = await fetch(`/api/apps/${appId}/exports`, {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          field_ids: selectedFieldIds,

          include_created_at: includeCreatedAt,

          include_updated_at: includeUpdatedAt,

        }),

      });

      const body = await res.json();

      if (!res.ok) {

        setError(body.error ?? "エクスポートに失敗しました");

        return;

      }



      const created = body.export as AppRecordExport;

      if (created.status === "completed") {

        await downloadExport(created.id, created.file_name);

      }

      router.push("/exports");

    } catch {

      setError("エクスポートに失敗しました");

    } finally {

      setGenerating(false);

    }

  }



  if (loading) {

    return <p className="text-gray-500">読み込み中...</p>;

  }



  if (!app) {

    return <p className="text-gray-500">アプリが見つかりません</p>;

  }



  return (

    <PageFrame>

      <PageHeader

        title={app.name}

        description="Excel 出力"

        backHref={`/apps/${appId}`}

        actions={

          <Link href="/exports" className="text-sm text-slate-300 hover:text-white shrink-0">

            Excel 出力一覧へ

          </Link>

        }

      />



      <PageBody>

        <PageSection title="出力項目の選択">

          <div className="space-y-4">

            <ExportFieldPicker

              fields={fields}

              selectedIds={selectedFieldIds}

              onChange={setSelectedFieldIds}

            />



            <div className="border-t border-gray-100 pt-4 space-y-2">

              <p className="text-xs font-medium text-gray-600">システム項目</p>

              <label className="flex items-center gap-2 text-sm">

                <input

                  type="checkbox"

                  checked={includeCreatedAt}

                  onChange={(e) => setIncludeCreatedAt(e.target.checked)}

                  className="rounded border-gray-300"

                />

                作成日を含める

              </label>

              <label className="flex items-center gap-2 text-sm">

                <input

                  type="checkbox"

                  checked={includeUpdatedAt}

                  onChange={(e) => setIncludeUpdatedAt(e.target.checked)}

                  className="rounded border-gray-300"

                />

                更新日を含める

              </label>

            </div>



            {error && <p className="text-sm text-red-600">{error}</p>}



            <Button variant="excel" onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">

              {generating ? (

                <>

                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />

                  生成中...

                </>

              ) : (

                <>

                  <FileSpreadsheet className="w-4 h-4 mr-1" />

                  Excel を生成

                </>

              )}

            </Button>

            <p className="text-xs text-gray-500">

              生成が完了すると自動でダウンロードが始まり、Excel 出力一覧画面に移動します。

            </p>

          </div>

        </PageSection>

      </PageBody>

    </PageFrame>

  );

}


