import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import type { Candidate, Interview } from "../types";
import { Badge, Button, Card, PageHeader } from "../components/UI";

const scoreFields = [
  ["communication", "沟通表达"],
  ["technical", "专业能力"],
  ["leadership", "领导力"],
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
type DetailCandidate = { candidate: Candidate; score: ScoreDraft & { average_score?: number } };

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

export function Interviews() {
  const [sessions, setSessions] = useState<Interview[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<DetailCandidate[]>([]);
  const [candidatePool, setCandidatePool] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [scoreDraft, setScoreDraft] = useState<ScoreDraft>(emptyScore);
  const [savingScore, setSavingScore] = useState(false);
  const [form, setForm] = useState({ title: "", scheduled_at: "", location: "", interviewer: "" });

  const selectedCandidate = useMemo(() => detail.find((item) => item.candidate.id === selectedCandidateId), [detail, selectedCandidateId]);
  const average = scoreFields.reduce((sum, [key]) => sum + Number(scoreDraft[key] ?? 0), 0) / scoreFields.length;

  async function loadSessions() {
    const data = await api.interviews();
    setSessions(data);
    if (!selectedId && data[0]) setSelectedId(data[0].id);
  }

  async function loadDetail(id: string, preferredCandidateId?: string) {
    const data = await api.interviewDetail(id);
    const candidates = data.candidates as DetailCandidate[];
    setDetail(candidates);
    const nextSelected = preferredCandidateId && candidates.some((item) => item.candidate.id === preferredCandidateId)
      ? preferredCandidateId
      : candidates[0]?.candidate.id ?? "";
    setSelectedCandidateId(nextSelected);
    const nextScore = candidates.find((item) => item.candidate.id === nextSelected)?.score;
    setScoreDraft(normalizeScore(nextScore));
  }

  useEffect(() => void loadSessions(), []);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId, selectedCandidateId);
  }, [selectedId]);

  useEffect(() => {
    const params = new URLSearchParams({ page: "1", page_size: "100" });
    void api.candidates(params).then((data) => setCandidatePool(data.items));
  }, []);

  useEffect(() => {
    setScoreDraft(normalizeScore(selectedCandidate?.score));
  }, [selectedCandidateId]);

  async function createSession() {
    if (!form.title || !form.scheduled_at) return;
    const session = await api.createInterview(form);
    setForm({ title: "", scheduled_at: "", location: "", interviewer: "" });
    await loadSessions();
    setSelectedId(session.id);
  }

  async function addCandidate(candidateId: string) {
    if (!selectedId || !candidateId) return;
    await api.addCandidateToInterview(selectedId, candidateId);
    await loadDetail(selectedId, candidateId);
  }

  async function removeCandidate(candidateId: string) {
    if (!selectedId) return;
    await api.removeCandidateFromInterview(selectedId, candidateId);
    await loadDetail(selectedId);
  }

  async function saveScore() {
    if (!selectedId || !selectedCandidate) return;
    setSavingScore(true);
    try {
      const score = await api.scoreCandidate(selectedId, selectedCandidate.candidate.id, scoreDraft) as DetailCandidate["score"];
      setDetail((items) => items.map((item) => item.candidate.id === selectedCandidate.candidate.id ? { ...item, score } : item));
      setScoreDraft(normalizeScore(score));
    } finally {
      setSavingScore(false);
    }
  }

  function updateDraft(key: keyof ScoreDraft, value: string) {
    setScoreDraft((current) => ({ ...current, [key]: key === "notes" || key === "result" ? value : Math.max(0, Math.min(10, Number(value) || 0)) }));
  }

  return (
    <>
      <PageHeader title="面试中心" subtitle="创建面试场次，将候选人加入具体场次，并使用填写制记录面试表现。" />
      <div className="mb-5 grid grid-cols-[360px_1fr] gap-5">
        <Card>
          <div className="mb-4 font-semibold">新增面试场次</div>
          <div className="space-y-3">
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="场次名称" className="w-full rounded-app border border-blue-100 px-3 py-2" />
            <input value={form.scheduled_at} onChange={(event) => setForm({ ...form, scheduled_at: event.target.value })} type="datetime-local" className="w-full rounded-app border border-blue-100 px-3 py-2" />
            <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="地点" className="w-full rounded-app border border-blue-100 px-3 py-2" />
            <input value={form.interviewer} onChange={(event) => setForm({ ...form, interviewer: event.target.value })} placeholder="面试官" className="w-full rounded-app border border-blue-100 px-3 py-2" />
            <Button onClick={() => void createSession()}>创建场次</Button>
          </div>
        </Card>
        <Card>
          <div className="mb-4 font-semibold">面试场次</div>
          <div className="grid grid-cols-3 gap-3">
            {sessions.map((session) => (
              <button key={session.id} onClick={() => setSelectedId(session.id)} className={`rounded-app border p-4 text-left ${selectedId === session.id ? "border-feishu bg-blue-50" : "border-blue-100"}`}>
                <div className="font-medium">{session.title}</div>
                <div className="mt-1 text-sm text-slate-500">{new Date(session.scheduled_at).toLocaleString()}</div>
                <div className="mt-1 text-sm text-slate-500">{session.location || "-"} / {session.interviewer || "-"}</div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {!selectedId ? (
        <Card className="grid h-72 place-items-center text-slate-500">请选择一个面试场次</Card>
      ) : (
        <div className="grid grid-cols-[300px_1fr_360px] gap-5">
          <Card>
            <div className="mb-3 font-semibold">候选人列表</div>
            <select onChange={(event) => void addCandidate(event.target.value)} value="" className="mb-3 w-full rounded-app border border-blue-100 px-3 py-2">
              <option value="">从候选人池加入场次</option>
              {candidatePool.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} / {candidate.role}</option>)}
            </select>
            <div className="space-y-2">
              {detail.map(({ candidate, score }) => (
                <button key={candidate.id} onClick={() => setSelectedCandidateId(candidate.id)} className={`w-full rounded-app p-3 text-left ${selectedCandidateId === candidate.id ? "bg-feishu text-white" : "bg-blue-50"}`}>
                  <div className="font-medium">{candidate.name}</div>
                  <div className="text-sm opacity-80">{candidate.role}</div>
                  <div className="mt-2 text-xs opacity-80">面试分数：{Number(score.average_score ?? 0).toFixed(1)}</div>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex items-center justify-between">
              <div className="font-semibold">面试评分</div>
              <Badge tone="green">当前均分 {average.toFixed(1)}</Badge>
            </div>
            {selectedCandidate ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {scoreFields.map(([key, label]) => (
                    <label key={key} className="block rounded-app border border-blue-100 p-3">
                      <span className="mb-2 block text-sm text-slate-600">{label}</span>
                      <input type="number" min="0" max="10" step="0.5" value={scoreDraft[key]} onChange={(event) => updateDraft(key, event.target.value)} className="w-full rounded-app border border-blue-100 px-3 py-2 text-lg font-semibold" />
                    </label>
                  ))}
                </div>
                <div className="flex gap-3">
                  {Object.entries(resultLabels).map(([value, label]) => (
                    <Button key={value} onClick={() => updateDraft("result", value)} className={scoreDraft.result === value ? "" : "bg-slate-200 text-slate-700 hover:bg-slate-300"}>{label}</Button>
                  ))}
                </div>
                <textarea value={scoreDraft.notes} onChange={(event) => updateDraft("notes", event.target.value)} placeholder="面试备注" className="h-28 w-full resize-none rounded-app border border-blue-100 px-3 py-2 text-sm" />
                <div className="flex gap-3">
                  <Button onClick={() => void saveScore()} disabled={savingScore}>{savingScore ? "保存中..." : "保存评分"}</Button>
                  <Button className="bg-red-50 text-red-700 hover:bg-red-100" onClick={() => void removeCandidate(selectedCandidate.candidate.id)}>移除候选人</Button>
                </div>
              </div>
            ) : (
              <div className="grid h-64 place-items-center text-slate-500">暂无候选人</div>
            )}
          </Card>

          <Card>
            <div className="mb-3 font-semibold">原始简历</div>
            <div className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-app bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              {selectedCandidate?.candidate.resume || "暂无候选人"}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
