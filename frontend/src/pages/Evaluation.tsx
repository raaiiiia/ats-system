import { CheckCircle2, ClipboardCheck, FileText, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { Badge, Button, Card, PageHeader } from "../components/UI";
import type { Candidate, Interview } from "../types";

const scoreFields = [
  ["communication", "沟通表达"],
  ["technical", "专业能力"],
  ["leadership", "协作领导"],
  ["problem_solving", "问题解决"],
  ["culture_fit", "文化匹配"],
] as const;
const resultLabels: Record<string, string> = { Pass: "通过", Reject: "拒绝", Hold: "待定" };

type ScoreDraft = {
  communication: number;
  technical: number;
  leadership: number;
  problem_solving: number;
  culture_fit: number;
  result: string;
  notes: string;
};
type DetailCandidate = { candidate: Candidate; score: ScoreDraft & { average_score?: number | null } };

const emptyScore: ScoreDraft = {
  communication: 0,
  technical: 0,
  leadership: 0,
  problem_solving: 0,
  culture_fit: 0,
  result: "Hold",
  notes: "",
};

function normalizeScore(score?: Partial<ScoreDraft>): ScoreDraft {
  return {
    communication: Number(score?.communication ?? 0),
    technical: Number(score?.technical ?? 0),
    leadership: Number(score?.leadership ?? 0),
    problem_solving: Number(score?.problem_solving ?? 0),
    culture_fit: Number(score?.culture_fit ?? 0),
    result: String(score?.result ?? "Hold"),
    notes: String(score?.notes ?? ""),
  };
}

function resultTone(result?: string): "green" | "red" | "amber" | "slate" {
  if (result === "Pass") return "green";
  if (result === "Reject") return "red";
  if (result === "Hold") return "amber";
  return "slate";
}

export function Evaluation() {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DetailCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(emptyScore);
  const [savingScore, setSavingScore] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);

  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) || null, [sessions, selectedId]);
  const selectedCandidate = useMemo(() => detail.find((item) => item.candidate.id === selectedCandidateId), [detail, selectedCandidateId]);
  const average = scoreFields.reduce((sum, [key]) => sum + Number(scoreDraft[key] ?? 0), 0) / scoreFields.length;
  const completedCount = detail.filter((item) => item.score?.average_score !== null && item.score?.average_score !== undefined).length;

  async function loadSessions() {
    const data = await api.interviews();
    setSessions(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
  }

  async function loadDetail(id: string, preferredCandidateId?: string) {
    const data = await api.interviewDetail(id);
    const candidates = data.candidates as DetailCandidate[];
    setDetail(candidates);
    const nextSelected = preferredCandidateId && candidates.some((item) => item.candidate.id === preferredCandidateId) ? preferredCandidateId : candidates[0]?.candidate.id ?? "";
    setSelectedCandidateId(nextSelected);
    setScoreDraft(normalizeScore(candidates.find((item) => item.candidate.id === nextSelected)?.score));
  }

  useEffect(() => void loadSessions(), []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId, selectedCandidateId);
  }, [selectedId]);

  useEffect(() => {
    setScoreDraft(normalizeScore(selectedCandidate?.score));
  }, [selectedCandidateId, detail]);

  function updateDraft(key: keyof ScoreDraft, value: string) {
    setScoreDraft((current) => ({
      ...current,
      [key]: key === "notes" || key === "result" ? value : Math.max(0, Math.min(10, Number(value) || 0)),
    }));
  }

  async function saveScore() {
    if (!selectedId || !selectedCandidate) return;
    setSavingScore(true);
    try {
      const score = (await api.scoreCandidate(selectedId, selectedCandidate.candidate.id, scoreDraft)) as DetailCandidate["score"];
      setDetail((items) => items.map((item) => (item.candidate.id === selectedCandidate.candidate.id ? { ...item, score } : item)));
      setScoreDraft(normalizeScore(score));
    } finally {
      setSavingScore(false);
    }
  }

  async function markFinalDecision(decision: "Offer" | "Rejected" | "Hired") {
    if (!selectedCandidate) return;
    setSavingDecision(true);
    try {
      if (decision === "Hired") {
        await api.updateStatus(selectedCandidate.candidate.id, "Offer");
        await api.updateTags(selectedCandidate.candidate.id, Array.from(new Set([...(selectedCandidate.candidate.tags || []), "已入职"])));
        await api.addCandidateNote(selectedCandidate.candidate.id, "已确认入职");
      } else {
        await api.updateStatus(selectedCandidate.candidate.id, decision);
      }
      await loadDetail(selectedId, selectedCandidate.candidate.id);
    } finally {
      setSavingDecision(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="面试评价" subtitle="面试场次结束后，在这里记录评分、面试结论，并完成拟录用或入职确认。" />

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[300px_320px_minmax(0,1fr)]">
        <Card className="flex min-h-0 flex-col">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="font-semibold">选择场次</div>
            <Badge tone="slate">{sessions.length}</Badge>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 thin-scrollbar">
            {sessions.map((session) => (
              <button key={session.id} onClick={() => setSelectedId(session.id)} className={`w-full rounded-app border p-3 text-left transition ${selectedId === session.id ? "border-feishu bg-blue-50" : "border-blue-100 hover:border-feishu"}`}>
                <div className="font-medium text-ink">{session.title}</div>
                <div className="mt-1 text-sm text-slate-500">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="mt-1 text-xs text-slate-500">{session.interviewer || "面试官待定"}</div>
              </button>
            ))}
            {!sessions.length && <div className="rounded-app bg-slate-50 p-4 text-sm text-slate-500">暂无面试场次</div>}
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="mb-4">
            <div className="font-semibold">评价队列</div>
            <div className="mt-1 text-sm text-slate-500">{selectedSession ? `${completedCount}/${detail.length} 已评分` : "先选择场次"}</div>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 thin-scrollbar">
            {detail.map(({ candidate, score }) => (
              <button key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)} className={`w-full rounded-app border p-3 text-left transition ${selectedCandidateId === candidate.id ? "border-feishu bg-blue-50" : "border-blue-100 bg-white hover:border-feishu"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-ink">{candidate.name}</div>
                    <div className="truncate text-sm text-slate-500">{candidate.role}</div>
                  </div>
                  <Badge tone={resultTone(score.result)}>{resultLabels[score.result || ""] || "未评价"}</Badge>
                </div>
                <div className="mt-2 text-xs text-slate-500">均分：{score.average_score === null || score.average_score === undefined ? "未评分" : Number(score.average_score).toFixed(1)}</div>
              </button>
            ))}
            {!detail.length && <div className="rounded-app bg-slate-50 p-4 text-sm text-slate-500">本场次还没有候选人，请先在“面试场次”中加入。</div>}
          </div>
        </Card>

        <div className="flex min-h-0 flex-col gap-4">
          <Card className="shrink-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">评分表</div>
                <div className="mt-1 text-sm text-slate-500">{selectedCandidate ? `${selectedCandidate.candidate.name} / ${selectedCandidate.candidate.role}` : "选择候选人后开始评分"}</div>
              </div>
              <Badge tone="green">当前均分 {average.toFixed(1)}</Badge>
            </div>

            {selectedCandidate ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {scoreFields.map(([key, label]) => (
                    <label key={key} className="block rounded-app border border-blue-100 p-3">
                      <span className="mb-2 block text-sm text-slate-600">{label}</span>
                      <div className="grid grid-cols-[minmax(0,1fr)_68px] items-center gap-3">
                        <input type="range" min="0" max="10" step="0.5" value={scoreDraft[key]} onChange={(event) => updateDraft(key, event.target.value)} />
                        <input type="number" min="0" max="10" step="0.5" value={scoreDraft[key]} onChange={(event) => updateDraft(key, event.target.value)} className="w-full rounded-app border border-blue-100 px-3 py-2 text-right text-lg font-semibold" />
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap gap-3">
                  {Object.entries(resultLabels).map(([value, label]) => (
                    <Button key={value} variant={scoreDraft.result === value ? "primary" : "secondary"} onClick={() => updateDraft("result", value)}>
                      {label}
                    </Button>
                  ))}
                </div>

                <textarea value={scoreDraft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="面试评价、风险点、复盘备注" className="h-28 w-full resize-none rounded-app border border-blue-100 px-3 py-2 text-sm" />

                <div className="flex flex-wrap gap-3">
                  <Button onClick={() => void saveScore()} disabled={savingScore}>
                    {savingScore ? "保存中..." : "保存评分与评价"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid h-48 place-items-center rounded-app bg-slate-50 text-slate-500">暂无可评价候选人</div>
            )}
          </Card>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="flex min-h-0 flex-col">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <FileText size={17} className="text-feishu" /> 面试参考
              </div>
              <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-app bg-slate-50 p-4 text-sm leading-6 text-slate-600 thin-scrollbar">
                {selectedCandidate?.candidate.resume || "暂无候选人简历"}
              </div>
            </Card>

            <Card className="space-y-4 overflow-hidden">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <ClipboardCheck size={17} className="text-feishu" /> 最终处理
                </div>
                <div className="mt-1 text-xs text-slate-500">建议先保存评分，再确认录用状态。</div>
              </div>
              <div className="grid gap-2">
                <button disabled={!selectedCandidate || savingDecision} onClick={() => void markFinalDecision("Offer")} className="flex items-center justify-between rounded-app bg-emerald-50 px-3 py-2 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                  拟录用 <CheckCircle2 size={16} />
                </button>
                <button disabled={!selectedCandidate || savingDecision} onClick={() => void markFinalDecision("Hired")} className="flex items-center justify-between rounded-app bg-blue-50 px-3 py-2 text-sm text-feishu hover:bg-blue-100 disabled:opacity-50">
                  确认入职 <CheckCircle2 size={16} />
                </button>
                <button disabled={!selectedCandidate || savingDecision} onClick={() => void markFinalDecision("Rejected")} className="flex items-center justify-between rounded-app bg-rose-50 px-3 py-2 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                  淘汰 <XCircle size={16} />
                </button>
              </div>
              {scoreDraft.result === "Reject" && <div className="rounded-app bg-rose-50 p-3 text-xs leading-5 text-rose-700">当前面试结论为拒绝。保存评价后，可在这里同步把候选人标记为淘汰。</div>}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
