import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { api } from "../api";
import { Badge, Button, Card, PageHeader } from "../components/UI";
import type { ImportDebugItem } from "../types";

export function Settings() {
  const [items, setItems] = useState<ImportDebugItem[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadDebug() {
    setLoading(true);
    try {
      setItems(await api.importDebug());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDebug();
  }, []);

  return (
    <div>
      <PageHeader title="设置" subtitle="调试数据导入、简历解析和字段映射结果。" />

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Debug</h2>
            <p className="mt-1 text-sm text-slate-500">
              对比解析前 Resume 和解析后 candidate.profile，检查联系方式、姓名、学历和技能是否正确映射。
            </p>
          </div>
          <Button onClick={loadDebug} disabled={loading} className="inline-flex items-center gap-2">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            刷新
          </Button>
        </div>

        {items.length === 0 && (
          <div className="rounded-app border border-dashed border-blue-100 bg-blue-50/50 p-8 text-center text-sm text-slate-500">
            暂无可调试的导入记录。
          </div>
        )}

        <div className="space-y-4">
          {items.map((item) => {
            const profile = item.parsedData?.profile || {};
            return (
              <div key={item.file.id} className="rounded-app border border-blue-100 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.file.filename}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.file.created_at || item.file.uploaded_at}</div>
                  </div>
                  <Badge tone={item.file.status === "processed" ? "green" : "slate"}>{item.file.status}</Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">解析前：Resume</div>
                    <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-app border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                      {item.rawResume || "N/A"}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">解析后：candidate.profile</div>
                    <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-app border border-blue-100 bg-blue-50/50 p-3 text-xs leading-5 text-slate-700">
                      {JSON.stringify(profile, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
