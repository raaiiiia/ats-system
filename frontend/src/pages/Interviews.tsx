import { CalendarDays, ClipboardCheck, Plus, Trash2, UserPlus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { Badge, Button, Card, PageHeader } from "../components/UI";
import type { Candidate, Interview } from "../types";

type DetailCandidate = {
  candidate: Candidate;
  score: {
    average_score?: number | null;
    result?: string;
    notes?: string;
  } & Record<string, unknown>;
};

const resultLabels: Record<string, string> = { Pass: "通过", Reject: "拒绝", Hold: "待定" };

function scoreText(score?: number | null) {
  return score === undefined || score === null ? "未评分" : `${Number(score).toFixed(1)} 分`;
}

function resultText(result?: string) {
  return resultLabels[result || ""] || "未评价";
}

export function Interviews({ setPage }: { setPage?: (page: string) => void }) {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DetailCandidate[]>([]);
  const [candidatePool, setCandidatePool] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [form, setForm] = useState({ title: "", scheduled_at: "", location: "", interviewer: "" });
  const [saving, setSaving] = useState(false);

  const selectedSession = useMemo(() => sessions.find((session) => session.id === selectedId) || null, [sessions, selectedId]);
  const selectedCandidate = useMemo(() => detail.find((item) => item.candidate.id === selectedCandidateId), [detail, selectedCandidateId]);
  const availableCandidates = useMemo(() => {
    const joined = new Set(detail.map((item) => item.candidate.id));
    return candidatePool.filter((candidate) => !joined.has(candidate.id));
  }, [candidatePool, detail]);

  async function loadSessions(preferredId = selectedId) {
    const data = await api.interviews();
    setSessions(data);
    const nextId = preferredId && data.some((session) => session.id === preferredId) ? preferredId : data[0]?.id ?? "";
    setSelectedId(nextId);
  }

  async function loadDetail(id: string, preferredCandidateId?: string) {
    const data = await api.interviewDetail(id);
    const candidates = data.candidates as DetailCandidate[];
    setDetail(candidates);
    const nextSelected = preferredCandidateId && candidates.some((item) => item.candidate.id === preferredCandidateId) ? preferredCandidateId : candidates[0]?.candidate.id ?? "";
    setSelectedCandidateId(nextSelected);
  }

  useEffect(() => void loadSessions(), []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId, selectedCandidateId);
  }, [selectedId]);

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", page_size: "100" });
    void api.candidates(params).then((data) => setCandidatePool(data.items));
  }, []);

  async function createSession() {
    if (!form.title.trim() || !form.scheduled_at) return;
    setSaving(true);
    try {
      const session = await api.createInterview(form);
      setForm({ title: "", scheduled_at: "", location: "", interviewer: "" });
      await loadSessions(session.id);
    } finally {
      setSaving(false);
    }
  }

  async function addCandidate(candidateId: string) {
    if (!selectedId || !candidateId) return;
    setSaving(true);
    try {
      await api.addCandidateToInterview(selectedId, candidateId);
      await loadDetail(selectedId, candidateId);
    } finally {
      setSaving(false);
    }
  }

  async function removeCandidate(candidateId: string) {
    if (!selectedId) return;
    setSaving(true);
    try {
      await api.removeCandidateFromInterview(selectedId, candidateId);
      await loadDetail(selectedId);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="面试中心"
        subtitle="创建面试场次，将候选人加入具体场次，并使用填写制记录面试表现。"
        action={
          <Button onClick={() => setPage?.("Evaluation")} className="gap-2 px-3 py-1.5 text-xs">
            <ClipboardCheck size={15} /> 面试评价
          </Button>
        }
      />

      <div className="mb-4 grid shrink-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Plus size={16} className="text-feishu" /> 新增面试场次
          </div>
          <div className="space-y-2.5">
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="场次名称"
              className="w-full rounded-app border border-blue-100 px-3 py-2 text-sm"
            />
            <input
              value={form.scheduled_at}
              onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })}
              type="datetime-local"
              className="w-full rounded-app border border-blue-100 px-3 py-2 text-sm"
            />
            <input
              value={form.location}
              onChange={(event) => setForm({ ...form, location: event.target.value })}
              placeholder="地点"
              className="w-full rounded-app border border-blue-100 px-3 py-2 text-sm"
            />
            <input
              value={form.interviewer}
              onChange={(event) => setForm({ ...form, interviewer: event.target.value })}
              placeholder="面试官"
              className="w-full rounded-app border border-blue-100 px-3 py-2 text-sm"
            />
            <Button onClick={() => void createSession()} disabled={saving} className="gap-2 px-3 py-1.5 text-xs">
              <CalendarDays size={15} /> 创建场次
            </Button>
          </div>
        </Card>

        <Card className="flex min-h-0 flex-col p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">面试场次</div>
            <Badge tone="slate">{sessions.length} 个场次</Badge>
          </div>
          <div className="grid flex-1 auto-rows-min gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => setSelectedId(session.id)}
                className={`rounded-app border p-3 text-left text-sm transition ${
                  selectedId === session.id ? "border-feishu bg-blue-50" : "border-blue-100 hover:border-feishu"
                }`}
              >
                <div className="truncate font-medium text-ink">{session.title}</div>
                <div className="mt-1 text-xs text-slate-500">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{session.location || "地点待定"}</div>
                <div className="mt-1 truncate text-xs text-slate-500">{session.interviewer || "面试官待定"}</div>
              </button>
            ))}
            {!sessions.length && <div className="rounded-app bg-slate-50 p-3 text-sm text-slate-500">暂无面试场次</div>}
          </div>
        </Card>
      </div>

      {!selectedId ? (
        <Card className="grid min-h-0 flex-1 place-items-center text-sm text-slate-500">请选择或创建一个面试场次</Card>
      ) : (
        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[280px_minmax(0,1.45fr)_280px]">
          <Card className="flex min-h-0 flex-col p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <UserPlus size={16} className="text-feishu" /> 参会候选人
            </div>
            <select
              onChange={(event) => void addCandidate(event.target.value)}
              value=""
              disabled={saving}
              className="mb-3 w-full rounded-app border border-blue-100 px-3 py-2 text-sm"
            >
              <option value="">从候选人库加入</option>
              {availableCandidates.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} / {candidate.role}
                </option>
              ))}
            </select>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 thin-scrollbar">
              {detail.map(({ candidate, score }) => (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  className={`w-full rounded-app border p-3 text-left text-sm transition ${
                    selectedCandidateId === candidate.id ? "border-feishu bg-blue-50" : "border-blue-100 bg-white hover:border-feishu"
                  }`}
                >
                  <div className="truncate font-medium text-ink">{candidate.name}</div>
                  <div className="truncate text-xs text-slate-500">{candidate.role}</div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <Badge tone={score.average_score ? "green" : "slate"}>{scoreText(score.average_score)}</Badge>
                    <Badge tone="slate">{resultText(score.result)}</Badge>
                  </div>
                </button>
              ))}
              {!detail.length && <div className="rounded-app bg-slate-50 p-3 text-sm text-slate-500">本场次还没有候选人</div>}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">候选人简历</div>
                <div className="truncate text-xs text-slate-500">
                  {selectedCandidate ? `${selectedCandidate.candidate.name} / ${selectedCandidate.candidate.role}` : "选择左侧候选人查看"}
                </div>
              </div>
              {selectedCandidate && (
                <Button variant="secondary" onClick={() => void removeCandidate(selectedCandidate.candidate.id)} disabled={saving} className="shrink-0 gap-2 px-3 py-1.5 text-xs">
                  <Trash2 size={14} /> 移出
                </Button>
              )}
            </div>
            <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap rounded-app bg-slate-50 p-4 text-sm leading-6 text-slate-600 thin-scrollbar">
              {selectedCandidate?.candidate.resume || "暂无候选人"}
            </div>
          </Card>

          <Card className="flex min-h-0 flex-col gap-3 p-4">
            <div>
              <div className="text-sm font-semibold text-ink">当前场次</div>
              <div className="mt-1 text-base font-semibold text-ink">{selectedSession?.title || "未选择场次"}</div>
            </div>
            <div className="grid gap-2 text-sm text-slate-600">
              <div className="rounded-app bg-slate-50 p-3">时间：{selectedSession ? new Date(selectedSession.scheduled_at).toLocaleString() : "-"}</div>
              <div className="rounded-app bg-slate-50 p-3">面试官：{selectedSession?.interviewer || "待定"}</div>
              <div className="rounded-app bg-slate-50 p-3">地点：{selectedSession?.location || "待定"}</div>
              <div className="rounded-app bg-slate-50 p-3">候选人：{detail.length} 人</div>
            </div>
            <div className="rounded-app border border-blue-100 bg-blue-50 p-3 text-sm leading-6 text-slate-600">
              场次结束后进入“面试评价”，按候选人逐个记录评分、结论，再决定是否拟录用或确认入职。
            </div>
            <Button onClick={() => setPage?.("Evaluation")} className="mt-auto w-full gap-2 px-3 py-1.5 text-xs">
              <ClipboardCheck size={15} /> 去面试评价
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
