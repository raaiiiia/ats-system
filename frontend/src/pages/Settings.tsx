import { useEffect, useState } from "react";
import { Database, RefreshCw, SlidersHorizontal, UploadCloud } from "lucide-react";

import { api } from "../api";
import { Badge, Button, Card, PageHeader } from "../components/UI";
import type { ImportDebugItem, ResumeScoreConfig, ResumeScoreWeights } from "../types";

const weightLabels: Record<keyof ResumeScoreWeights, string> = {
  text_match: "文本匹配",
  skills: "技能",
  experience: "经验",
  education: "学历",
};

export function Settings({ setPage }: { setPage?: (page: string) => void }) {
  const [debugItems, setDebugItems] = useState<ImportDebugItem[]>([]);
  const [scoreConfig, setScoreConfig] = useState<ResumeScoreConfig | null>(null);
  const [weights, setWeights] = useState<ResumeScoreWeights>({ text_match: 0, skills: 0, experience: 0, education: 0 });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function loadSettings() {
    setLoading(true);
    try {
      const [debugData, configData] = await Promise.all([api.importDebug(), api.scoreConfig()]);
      setDebugItems(debugData);
      setScoreConfig(configData);
      setWeights(configData.weights);
    } finally {
      setLoading(false);
    }
  }

  async function saveWeights() {
    setSaving(true);
    try {
      const next = await api.updateScoreConfig(weights);
      setScoreConfig(next);
      setWeights(next.weights);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    void loadSettings();
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader
        title="设置与工具"
        subtitle="把低频调试、导入检查和评分权重集中在这里，主工作台只保留 HR 当前要操作的信息。"
        action={
          <Button variant="secondary" onClick={() => setPage?.("Data Import")} className="gap-2">
            <UploadCloud size={16} /> 简历导入
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <SlidersHorizontal size={16} /> 简历评分权重
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">影响候选人库和工作台中的匹配分，用于初筛排序。</p>
            </div>
            <Button onClick={saveWeights} disabled={saving} className="shrink-0">
              {saving ? "保存中" : "保存"}
            </Button>
          </div>

          <div className="space-y-3">
            {(Object.keys(weights) as Array<keyof ResumeScoreWeights>).map((key) => (
              <label key={key} className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-3 text-sm">
                <span className="text-slate-600">{weightLabels[key]}</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={weights[key]}
                  onChange={(event) => setWeights((current) => ({ ...current, [key]: Number(event.target.value) || 0 }))}
                  className="h-9 rounded-app border border-blue-100 px-2 text-right text-sm"
                />
              </label>
            ))}
          </div>

          <div className="rounded-app bg-slate-50 p-3 text-xs leading-5 text-slate-500">
            最近更新：{scoreConfig?.updated ? new Date(scoreConfig.updated * 1000).toLocaleString() : "暂无记录"}
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Database size={16} /> 导入解析检查
              </div>
              <p className="mt-1 text-xs text-slate-500">这些信息不进入主流程，只在排查简历解析质量时展开查看。</p>
            </div>
            <Button variant="secondary" onClick={() => void loadSettings()} disabled={loading} className="gap-2">
              <RefreshCw size={16} /> 刷新
            </Button>
          </div>

          <div className="space-y-3">
            {debugItems.map((item) => (
              <details key={item.file.id} className="rounded-app border border-blue-100 bg-white p-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{item.file.filename}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.file.detected_type || "未识别类型"} · {item.file.status}</div>
                    </div>
                    <Badge>{item.file.row_count || 0} 行</Badge>
                  </div>
                </summary>
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-500">解析字段</div>
                    <pre className="max-h-72 overflow-auto rounded-app bg-slate-950 p-3 text-xs text-slate-100">
                      {JSON.stringify(item.parsedData, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <div className="mb-2 text-xs font-semibold text-slate-500">原始文本</div>
                    <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-app bg-slate-50 p-3 text-xs leading-5 text-slate-700">
                      {item.rawResume || "暂无原始文本"}
                    </pre>
                  </div>
                </div>
              </details>
            ))}
            {!debugItems.length && <div className="rounded-app bg-slate-50 p-6 text-sm text-slate-500">暂无可检查的导入记录。</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
