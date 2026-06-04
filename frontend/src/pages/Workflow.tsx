import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Download,
  GraduationCap,
  Mail,
  Phone,
  Search,
  Settings,
  UploadCloud,
  UsersRound,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../api";
import { Badge, Button, Card } from "../components/UI";
import type { Candidate, CandidateDetail, CandidateParsedData, DashboardStats, PipelineColumn } from "../types";

type Stage = "Resume" | "Interview1" | "Interview2" | "Offer" | "Rejected";

const stageOrder: Stage[] = ["Resume", "Interview1", "Interview2", "Offer", "Rejected"];
const stageLabels: Record<Stage, string> = {
  Resume: "简历进入",
  Interview1: "进入一面",
  Interview2: "进入复面",
  Offer: "待发 Offer",
  Rejected: "不合适",
};
const levelLabels: Record<string, string> = { high: "高匹配", medium: "可跟进", low: "待确认" };

function meaningful(value?: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.filter(Boolean).join("、");
  const text = String(value).trim();
  if (!text || ["nan", "none", "null", "undefined"].includes(text.toLowerCase())) return "";
  return text;
}

function parsed(candidate?: Candidate): CandidateParsedData {
  return (candidate?.parsed_data || {}) as CandidateParsedData;
}

function stripRolePrefix(value: string) {
  return value.replace(/\s*(?:申请岗位|应聘岗位|目标岗位|岗位|职位|Applied Role|Role|Position|Job Title)\s*[:：]\s*/gi, "").trim();
}

function candidateName(candidate?: Candidate) {
  const data = parsed(candidate);
  return meaningful(candidate?.profile?.name) || meaningful(data.name) || meaningful(candidate?.name) || "未命名候选人";
}

function candidateRole(candidate?: Candidate) {
  const data = parsed(candidate);
  return stripRolePrefix(meaningful(candidate?.profile?.role) || meaningful(data.role) || meaningful(candidate?.role)) || "岗位待定";
}

function candidateEducation(candidate?: Candidate) {
  const data = parsed(candidate);
  return meaningful(candidate?.profile?.education) || meaningful(data.education) || meaningful(candidate?.education) || "学历待补充";
}

function candidateExperience(candidate?: Candidate) {
  const data = parsed(candidate);
  return meaningful(candidate?.profile?.experience) || meaningful(data.experienceDuration) || meaningful(candidate?.experience) || "经历待补充";
}

function candidateSkills(candidate?: Candidate) {
  const data = parsed(candidate);
  const skills = candidate?.profile?.skills || data.skills || candidate?.skills || [];
  if (Array.isArray(skills)) return skills.map(String).filter(Boolean);
  return meaningful(skills)
    .split(/[、,，;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function contact(candidate?: Candidate) {
  const data = parsed(candidate);
  return {
    email: meaningful(candidate?.profile?.contact?.email) || meaningful(data.contact?.email) || meaningful(candidate?.email),
    phone: meaningful(candidate?.profile?.contact?.phone) || meaningful(data.contact?.phone) || meaningful(candidate?.phone),
  };
}

function normalizeStage(stage?: string): Stage {
  return stageOrder.includes(stage as Stage) ? (stage as Stage) : "Resume";
}

function scoreColor(score?: number) {
  if ((score || 0) >= 80) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if ((score || 0) >= 60) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

function levelText(level?: string) {
  return levelLabels[level || ""] || "未分级";
}

export function Workflow({ setPage }: { setPage?: (page: string) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<Stage | "All">("All");
  const [loading, setLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.id === selectedCandidateId) || detail?.candidate || null,
    [candidates, detail, selectedCandidateId],
  );
  const selectedStage = normalizeStage(selectedCandidate?.pipeline_status);

  const stageCounts = useMemo(() => {
    const counts = Object.fromEntries(stageOrder.map((stage) => [stage, 0])) as Record<Stage, number>;
    columns.forEach((column) => {
      counts[normalizeStage(column.name)] += column.candidates?.length || 0;
    });
    if (!columns.length) candidates.forEach((candidate) => (counts[normalizeStage(candidate.pipeline_status)] += 1));
    return counts;
  }, [columns, candidates]);

  const filteredCandidates = useMemo(() => {
    const key = query.trim().toLowerCase();
    return candidates
      .filter((candidate) => {
        if (stageFilter !== "All" && normalizeStage(candidate.pipeline_status) !== stageFilter) return false;
        if (!key) return true;
        return [candidateName(candidate), candidateRole(candidate), candidateEducation(candidate), contact(candidate).email, contact(candidate).phone, candidateSkills(candidate).join(" ")]
          .join(" ")
          .toLowerCase()
          .includes(key);
      })
      .sort((a, b) => (b.fit_score || 0) - (a.fit_score || 0));
  }, [candidates, query, stageFilter]);

  async function loadWorkspace(nextCandidateId = selectedCandidateId) {
    setLoading(true);
    setWorkspaceError("");
    try {
      const params = new URLSearchParams({ page: "1", page_size: "100" });
      const [statsData, pipelineData, candidateData] = await Promise.all([api.stats(), api.pipeline(), api.candidates(params)]);
      setStats(statsData);
      setColumns(pipelineData);
      setCandidates(candidateData.items);
      setSelectedCandidateId(nextCandidateId || candidateData.items[0]?.id || null);
    } catch (error) {
      setWorkspaceError(error instanceof Error ? error.message : "工作台数据加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedCandidateId) {
      setDetail(null);
      return;
    }
    api.candidateDetail(selectedCandidateId).then(setDetail).catch(() => setDetail(null));
  }, [selectedCandidateId]);

  async function updateStage(stage: Stage) {
    if (!selectedCandidate) return;
    setSaving(true);
    try {
      await api.updateStatus(selectedCandidate.id, stage);
      await loadWorkspace(selectedCandidate.id);
      setDetail(await api.candidateDetail(selectedCandidate.id));
    } finally {
      setSaving(false);
    }
  }

  function exportCsv() {
    const rows = filteredCandidates.map((candidate) => ({
      name: candidateName(candidate),
      role: candidateRole(candidate),
      stage: stageLabels[normalizeStage(candidate.pipeline_status)],
      score: candidate.fit_score ?? 0,
      level: levelText(candidate.level),
      email: contact(candidate).email,
      phone: contact(candidate).phone,
      skills: candidateSkills(candidate).join("、"),
    }));
    const headers = ["name", "role", "stage", "score", "level", "email", "phone", "skills"];
    const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => `"${String(row[key as keyof typeof row] || "").replace(/"/g, '""')}"`).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "screening-workflow.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  const selectedContact = contact(selectedCandidate || undefined);
  const selectedSkills = candidateSkills(selectedCandidate || undefined);
  const activePipeline = stageCounts.Resume + stageCounts.Interview1 + stageCounts.Interview2;

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 border-b border-blue-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-feishu">
            <BriefcaseBusiness size={15} />
            screening workflow
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink">招聘工作台</h1>
          <p className="text-sm text-slate-500">只处理简历进入、候选人筛选和推进面试；面试评分与录用确认在后续分页完成。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => setPage?.("Data Import")} className="gap-2">
            <UploadCloud size={16} /> 导入简历
          </Button>
          <Button variant="secondary" onClick={exportCsv} className="gap-2">
            <Download size={16} /> 导出筛选表
          </Button>
          <Button variant="secondary" onClick={() => setPage?.("Settings")} className="gap-2">
            <Settings size={16} /> 设置
          </Button>
        </div>
      </section>

      {workspaceError && (
        <div className="flex flex-col gap-3 rounded-app border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>后端服务暂时不可用，当前只显示工作台框架。请启动 API 后重试。</span>
          <Button variant="secondary" onClick={() => void loadWorkspace()} className="justify-center">
            重试
          </Button>
        </div>
      )}

      <section className="grid gap-3 md:grid-cols-4">
        {[
          { label: "候选人", value: stats?.candidates ?? candidates.length, icon: UsersRound },
          { label: "简历池", value: stageCounts.Resume, icon: BriefcaseBusiness },
          { label: "进入面试", value: stageCounts.Interview1 + stageCounts.Interview2, icon: CheckCircle2 },
          { label: "不合适", value: stageCounts.Rejected, icon: XCircle },
        ].map((item) => (
          <div key={item.label} className="flex items-center justify-between rounded-app border border-blue-100 bg-white px-4 py-3 shadow-soft">
            <div>
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="text-2xl font-semibold text-ink">{item.value}</div>
            </div>
            <item.icon className="text-feishu" size={20} />
          </div>
        ))}
      </section>

      <section className="grid gap-3 xl:grid-cols-[310px_minmax(0,1fr)_320px]">
        <Card className="space-y-3 p-3">
          <div className="flex items-center gap-2 rounded-app border border-blue-100 px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="姓名、岗位、技能、联系方式" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <div className="flex gap-1 overflow-x-auto">
            <button onClick={() => setStageFilter("All")} className={`shrink-0 rounded-app px-2.5 py-1.5 text-xs ${stageFilter === "All" ? "bg-feishu text-white" : "bg-slate-100 text-slate-600"}`}>
              全部 {candidates.length}
            </button>
            {stageOrder.map((stage) => (
              <button
                key={stage}
                onClick={() => setStageFilter(stage)}
                className={`shrink-0 rounded-app px-2.5 py-1.5 text-xs ${stageFilter === stage ? "bg-feishu text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {stageLabels[stage]} {stageCounts[stage]}
              </button>
            ))}
          </div>
          <div className="max-h-[640px] space-y-2 overflow-auto pr-1">
            {filteredCandidates.map((candidate) => {
              const active = candidate.id === selectedCandidateId;
              return (
                <button
                  key={candidate.id}
                  onClick={() => setSelectedCandidateId(candidate.id)}
                  className={`w-full rounded-app border p-3 text-left transition ${active ? "border-feishu bg-blue-50" : "border-blue-100 bg-white hover:border-feishu"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{candidateName(candidate)}</div>
                      <div className="truncate text-xs text-slate-500">{candidateRole(candidate)}</div>
                    </div>
                    <span className={`shrink-0 rounded-app border px-2 py-1 text-xs font-semibold ${scoreColor(candidate.fit_score)}`}>{candidate.fit_score ?? 0}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge>{stageLabels[normalizeStage(candidate.pipeline_status)]}</Badge>
                    <Badge>{levelText(candidate.level)}</Badge>
                  </div>
                </button>
              );
            })}
            {!filteredCandidates.length && <div className="rounded-app bg-slate-50 p-4 text-sm text-slate-500">{loading ? "加载中..." : "暂无候选人"}</div>}
          </div>
        </Card>

        <div className="space-y-3">
          <Card className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-ink">{candidateName(selectedCandidate || undefined)}</div>
                <div className="mt-1 text-sm text-slate-500">{candidateRole(selectedCandidate || undefined)}</div>
              </div>
              <div className={`rounded-app border px-3 py-2 text-center ${scoreColor(selectedCandidate?.fit_score)}`}>
                <div className="text-xs">匹配分</div>
                <div className="text-xl font-semibold">{selectedCandidate?.fit_score ?? 0}</div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-app bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Mail size={14} /> 邮箱
                </div>
                <div className="mt-1 break-all text-sm font-medium text-ink">{selectedContact.email || "待补充"}</div>
              </div>
              <div className="rounded-app bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Phone size={14} /> 电话
                </div>
                <div className="mt-1 text-sm font-medium text-ink">{selectedContact.phone || "待补充"}</div>
              </div>
              <div className="rounded-app bg-slate-50 p-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <GraduationCap size={14} /> 背景
                </div>
                <div className="mt-1 line-clamp-2 text-sm font-medium text-ink">{candidateEducation(selectedCandidate || undefined)}</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {stageOrder.map((stage) => (
                <button
                  key={stage}
                  disabled={!selectedCandidate || saving}
                  onClick={() => void updateStage(stage)}
                  className={`rounded-app px-3 py-2 text-xs font-medium transition ${selectedStage === stage ? "bg-feishu text-white" : "bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-feishu"}`}
                >
                  {stageLabels[stage]}
                </button>
              ))}
            </div>
          </Card>

          <Card className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-ink">筛选摘要</div>
                <p className="mt-1 text-sm leading-6 text-slate-600">{meaningful(parsed(selectedCandidate || undefined).summary) || candidateExperience(selectedCandidate || undefined)}</p>
              </div>
              <div>
                <div className="text-sm font-semibold text-ink">技能标签</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selectedSkills.slice(0, 14).map((skill) => (
                    <Badge key={skill}>{skill}</Badge>
                  ))}
                  {!selectedSkills.length && <span className="text-sm text-slate-500">暂无技能标签</span>}
                </div>
              </div>
              <details className="rounded-app border border-blue-100 p-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-600">查看原始简历</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-600">
                  {selectedCandidate?.originalResume || selectedCandidate?.resume || "暂无原始简历"}
                </pre>
              </details>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-ink">流转记录</div>
              {(detail?.timeline || selectedCandidate?.history || []).slice(0, 6).map((item, index) => (
                <div key={`${item.stage}-${index}`} className="rounded-app bg-slate-50 p-2 text-xs">
                  <div className="font-medium text-ink">{item.stage}</div>
                  <div className="text-slate-500">{item.result || "已更新"} · {item.date ? new Date(item.date).toLocaleDateString() : ""}</div>
                </div>
              ))}
              {!(detail?.timeline || selectedCandidate?.history || []).length && <div className="rounded-app bg-slate-50 p-3 text-xs text-slate-500">暂无流转记录</div>}
            </div>
          </Card>
        </div>

        <Card className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-ink">下一步动作</div>
            <div className="text-xs text-slate-500">这里不做面试评分，只把候选人推进到正确阶段。</div>
          </div>

          <div className="grid gap-2">
            {[
              { stage: "Resume" as Stage, title: "保留在简历池", desc: "资料待补齐或暂缓推进" },
              { stage: "Interview1" as Stage, title: "推进一面", desc: "初筛通过，进入首轮面试安排" },
              { stage: "Interview2" as Stage, title: "推进复面", desc: "一面通过，等待复试安排" },
              { stage: "Rejected" as Stage, title: "标记不合适", desc: "停止推进并保留记录" },
            ].map((item) => (
              <button
                key={item.stage}
                disabled={!selectedCandidate || saving}
                onClick={() => void updateStage(item.stage)}
                className={`rounded-app border p-3 text-left transition ${
                  selectedStage === item.stage ? "border-feishu bg-blue-50 text-feishu" : "border-blue-100 bg-white hover:border-feishu"
                }`}
              >
                <div className="text-sm font-semibold">{item.title}</div>
                <div className="mt-1 text-xs text-slate-500">{item.desc}</div>
              </button>
            ))}
          </div>

          <div className="rounded-app bg-slate-50 p-3 text-xs leading-5 text-slate-600">
            当前筛选漏斗中共有 <span className="font-semibold text-ink">{activePipeline}</span> 人。面试评分、面试结论、拟录用和入职确认已移动到“面试评价”分页。
          </div>

          <Button onClick={() => setPage?.("Interviews")} className="w-full gap-2" disabled={!selectedCandidate}>
            去安排面试场次 <ArrowRight size={16} />
          </Button>
        </Card>
      </section>
    </div>
  );
}
