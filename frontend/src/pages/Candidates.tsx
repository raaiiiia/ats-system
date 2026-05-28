import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ExternalLink, FileText, PlusCircle, Route, X } from "lucide-react";

import { api } from "../api";
import { Badge, Button, Card, PageHeader } from "../components/UI";
import type {
  Candidate,
  CandidateDetail,
  CandidateParsedData,
  CandidateProfile,
  ResumeScoreConfig,
  ResumeScoreWeights,
} from "../types";

const stageLabels: Record<string, string> = {
  Resume: "简历筛选",
  Interview1: "一面",
  Interview2: "二面",
  Offer: "Offer",
  Rejected: "已拒绝",
};

const stages = Object.keys(stageLabels);
const cellClass = "px-3 py-4 align-middle leading-5 text-slate-700";
const wrapClass = "whitespace-normal break-words";
const tableMinWidth = 1440;
const scoreKeys: Array<keyof ResumeScoreWeights> = ["text_match", "skills", "experience", "education"];
const defaultWeights: ResumeScoreWeights = { text_match: 45, skills: 25, experience: 20, education: 10 };
const inlineRolePattern = /\s*(?:申请岗位|应聘岗位|目标岗位|岗位|职位|Applied Role|Role|Position|Job Title)\s*[:：]\s*(.+)$/i;

function parsed(candidate: Candidate): CandidateParsedData & Record<string, unknown> {
  return (candidate.parsed_data || {}) as CandidateParsedData & Record<string, unknown>;
}

function profile(candidate: Candidate): CandidateProfile {
  const data = parsed(candidate);
  return candidate.profile || data.profile || {
    name: data.name || candidate.name,
    contact: data.contact || { email: candidate.email, phone: candidate.phone },
    education: typeof data.education === "string" ? [data.education] : data.education,
    experience: candidate.experience ? [candidate.experience] : [],
    skills: data.skills || candidate.skills,
    projects: data.projects || [],
    summary: data.summary || "",
  };
}

function display(value?: string | number | null) {
  if (value === undefined || value === null || value === "" || value === "Unknown" || value === "N/A") return "-";
  return String(value);
}

function meaningful(value: unknown) {
  const text = String(value ?? "").trim();
  return text && !["unknown", "n/a", "nan", "none", "null", "-"].includes(text.toLowerCase()) ? text : "";
}

function stripInlineRole(value?: string | null) {
  return String(value || "").replace(inlineRolePattern, "").trim();
}

function extractInlineRole(value?: string | null) {
  const match = String(value || "").match(inlineRolePattern);
  return match?.[1]?.trim() || "";
}

function candidateName(candidate: Candidate) {
  return display(stripInlineRole(profile(candidate).name || parsed(candidate).name || candidate.name));
}

function candidateRole(candidate: Candidate) {
  const data = parsed(candidate);
  const role =
    meaningful(candidate.role) ||
    meaningful(profile(candidate).role) ||
    meaningful(data.role) ||
    extractInlineRole(profile(candidate).name || data.name || candidate.name);
  return display(role);
}

function candidateEducation(candidate: Candidate) {
  const data = parsed(candidate);
  const education = profile(candidate).education;
  if (Array.isArray(education) && education.length) return display(education.join(" / "));
  if (typeof data.education === "string") return display(data.education);
  if (Array.isArray(data.education) && data.education.length) return display(data.education.join(" / "));
  return display(candidate.education);
}

function candidateSkills(candidate: Candidate) {
  const data = parsed(candidate);
  const profileSkills = profile(candidate).skills;
  if (Array.isArray(profileSkills) && profileSkills.length) return profileSkills;
  if (Array.isArray(data.skills) && data.skills.length) return data.skills;
  return candidate.skills || [];
}

function contactLines(candidate: Candidate) {
  const contact = profile(candidate).contact || parsed(candidate).contact || {};
  const lines = [
    display(contact.email || candidate.email),
    display(contact.phone || candidate.phone),
    contact.linkedin ? "LinkedIn" : "",
    contact.github ? "GitHub" : "",
    contact.website ? "Website" : "",
  ];
  return lines.filter((line) => line && line !== "-");
}

function validExperienceLine(value: unknown) {
  const text = meaningful(value);
  if (!text || text.toLowerCase() === "0 years") return "";
  const years = text.match(/(\d{2,4})\s*(?:years?|年)/i);
  if (years && Number(years[1]) > 50) return "";
  const months = text.match(/(\d{3,4})\s*(?:months?|个月|月)/i);
  if (months && Number(months[1]) > 600) return "";
  return text;
}

function candidateExperience(candidate: Candidate) {
  const data = parsed(candidate);
  const prof = profile(candidate);
  const items = Array.isArray(prof.experience)
    ? prof.experience.map(validExperienceLine).filter(Boolean)
    : [];
  if (items.length) return items;
  const duration = validExperienceLine(prof.experienceDuration) || validExperienceLine(data.experienceDuration);
  if (duration) return [duration];
  const years = Number(data.experienceYears ?? data.experience_years ?? 0);
  if (years > 0 && years <= 50) return [`${years} years`];
  const fallback = validExperienceLine(candidate.experience);
  if (fallback) return [fallback];
  return ["无"];
}

function originalResume(candidate: Candidate) {
  return candidate.originalResume || parsed(candidate).originalResume || candidate.resume || "";
}

function attachmentIsPdf(detail: CandidateDetail | null) {
  return Boolean(detail?.isPdf || detail?.resumeFile?.toLowerCase().endsWith(".pdf"));
}

export function Candidates({ refreshToken, setPage: navigate }: { refreshToken: number; setPage?: (page: string) => void }) {
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<Candidate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [config, setConfig] = useState<ResumeScoreConfig | null>(null);
  const [draftWeights, setDraftWeights] = useState<ResumeScoreWeights>(defaultWeights);
  const [showConfig, setShowConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resumeOpen, setResumeOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const params = useMemo(() => {
    const next = new URLSearchParams({ page: String(page), page_size: "20" });
    if (search) next.set("q", search);
    if (status) next.set("stage", status);
    return next;
  }, [page, search, status]);

  async function load() {
    const data = await api.candidates(params);
    setItems(data.items);
    setTotal(data.total);
  }

  async function loadConfig() {
    const data = await api.scoreConfig();
    setConfig(data);
    setDraftWeights(data.weights);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [params, refreshToken]);

  useEffect(() => {
    void loadConfig();
  }, []);

  function exportRows() {
    const rows = items.map((candidate) => ({
      name: candidateName(candidate),
      role: candidateRole(candidate),
      contact: contactLines(candidate).join(" / "),
      education: candidateEducation(candidate),
      skills: candidateSkills(candidate).join("; "),
      resume_score: candidate.fit_score,
      tags: candidate.tags.join("; "),
      status: stageLabels[candidate.pipeline_status] ?? candidate.pipeline_status,
    }));
    const csv = [
      Object.keys(rows[0] ?? {}).join(","),
      ...rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "candidates.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function editTags(candidate: Candidate) {
    const value = window.prompt("请输入标签，多个标签用英文逗号分隔", candidate.tags.join(", "));
    if (value === null) return;
    await api.updateTags(candidate.id, value.split(",").map((tag) => tag.trim()).filter(Boolean));
    await load();
  }

  async function updateStatus(candidate: Candidate, pipeline_status: string) {
    await api.updateStatus(candidate.id, pipeline_status);
    await load();
  }

  async function saveScoreConfig() {
    setSavingConfig(true);
    try {
      const next = await api.updateScoreConfig(draftWeights);
      setConfig(next);
      setDraftWeights(next.weights);
      setShowConfig(false);
      await load();
    } finally {
      setSavingConfig(false);
    }
  }

  function updateWeight(key: keyof ResumeScoreWeights, value: string) {
    setDraftWeights((current) => ({ ...current, [key]: Number(value) || 0 }));
  }

  function syncCandidateScroll(source: "top" | "table") {
    const top = topScrollRef.current;
    const table = tableScrollRef.current;
    if (!top || !table) return;
    if (source === "top" && table.scrollLeft !== top.scrollLeft) {
      table.scrollLeft = top.scrollLeft;
    }
    if (source === "table" && top.scrollLeft !== table.scrollLeft) {
      top.scrollLeft = table.scrollLeft;
    }
  }

  async function openDetail(candidate: Candidate) {
    setDetailLoading(true);
    setResumeOpen(false);
    setPdfOpen(false);
    try {
      setDetail(await api.candidateDetail(candidate.id));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setDetail(null);
    setResumeOpen(false);
    setPdfOpen(false);
  }

  async function addNote() {
    if (!detail) return;
    const note = window.prompt("请输入备注");
    if (!note?.trim()) return;
    setDetail(await api.addCandidateNote(detail.candidate.id, note.trim()));
  }

  function downloadResume() {
    if (!detail) return;
    if (detail.resumeFileUrl) {
      window.open(detail.resumeFileUrl, "_blank");
      return;
    }
    const blob = new Blob([originalResume(detail.candidate)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${candidateName(detail.candidate)}-resume.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const drawerCandidate = detail?.candidate;
  const drawerProfile = drawerCandidate ? profile(drawerCandidate) : {};
  const drawerParsed = drawerCandidate ? parsed(drawerCandidate) : {};
  const drawerContact = drawerProfile.contact || drawerParsed.contact || {};
  const drawerSkills = drawerCandidate ? candidateSkills(drawerCandidate) : [];
  const notes = Array.isArray(drawerParsed.notes) ? drawerParsed.notes : [];
  const projects = Array.isArray(drawerProfile.projects) && drawerProfile.projects.length ? drawerProfile.projects : drawerParsed.projects || [];
  const experience = drawerCandidate ? candidateExperience(drawerCandidate) : ["无"];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <PageHeader title="候选人数据库" subtitle="数据清洗后仅展示姓名、岗位、联系方式、学历、技能、简历分数、标签和状态。" />
        <Button onClick={() => setShowConfig(true)}>评分配比</Button>
      </div>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="搜索姓名、邮箱、岗位、简历全文..."
            className="min-w-72 flex-1 rounded-app border border-blue-100 px-3 py-2"
          />
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-app border border-blue-100 px-3 py-2"
          >
            <option value="">全部状态</option>
            {stages.map((value) => (
              <option key={value} value={value}>{stageLabels[value]}</option>
            ))}
          </select>
          <Button onClick={exportRows}>导出 CSV</Button>
        </div>
      </Card>

      <Card>
        <div ref={topScrollRef} onScroll={() => syncCandidateScroll("top")} className="mb-2 overflow-x-auto rounded-app border border-blue-50 bg-slate-50/80">
          <div style={{ width: tableMinWidth, height: 1 }} />
        </div>
        <div ref={tableScrollRef} onScroll={() => syncCandidateScroll("table")} className="overflow-x-hidden">
          <table className="table-fixed text-left text-sm" style={{ minWidth: tableMinWidth }}>
            <colgroup>
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[15%]" />
              <col className="w-[14%]" />
              <col className="w-[17%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[5%]" />
            </colgroup>
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="px-3 py-3">姓名</th>
                <th className="px-3 py-3">应聘岗位</th>
                <th className="px-3 py-3">联系方式</th>
                <th className="px-3 py-3">学历</th>
                <th className="px-3 py-3">技能</th>
                <th className="px-3 py-3">简历分数</th>
                <th className="px-3 py-3">标签</th>
                <th className="px-3 py-3">状态</th>
                <th className="px-3 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((candidate) => (
                <tr key={candidate.id} className="border-t border-blue-50">
                  <td className={`${cellClass} ${wrapClass} font-medium text-slate-900`}>{candidateName(candidate)}</td>
                  <td className={`${cellClass} ${wrapClass}`}>{candidateRole(candidate)}</td>
                  <td className={`${cellClass} whitespace-pre-line break-all`}>{contactLines(candidate).join("\n") || "-"}</td>
                  <td className={`${cellClass} ${wrapClass}`}>{candidateEducation(candidate)}</td>
                  <td className={cellClass}>
                    <div className="flex flex-wrap gap-1.5">
                      {(candidateSkills(candidate).length ? candidateSkills(candidate) : ["-"]).slice(0, 10).map((skill) => (
                        <Badge key={skill} tone="slate">{skill}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className={cellClass}><Badge tone={candidate.fit_score >= 80 ? "green" : "blue"}>{Number(candidate.fit_score || 0).toFixed(1)}</Badge></td>
                  <td className={`${cellClass} ${wrapClass}`}>
                    <button onClick={() => void editTags(candidate)} className="text-left text-feishu">{candidate.tags.join(", ") || "+ 标签"}</button>
                  </td>
                  <td className={cellClass}>
                    <select value={candidate.pipeline_status} onChange={(event) => void updateStatus(candidate, event.target.value)} className="w-full rounded-app border border-blue-100 px-2 py-1.5 text-sm">
                      {stages.map((stage) => (
                        <option key={stage} value={stage}>{stageLabels[stage]}</option>
                      ))}
                    </select>
                  </td>
                  <td className={cellClass}>
                    <button onClick={() => void openDetail(candidate)} className="resume-btn rounded-app bg-feishu px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
                      查看简历
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
          <span>共 {total} 条</span>
          <div className="flex gap-2">
            <Button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="px-3 py-1.5">上一页</Button>
            <Button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="px-3 py-1.5">下一页</Button>
          </div>
        </div>
      </Card>

      {showConfig && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <Card className="w-full max-w-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">简历分数配比</h2>
                <p className="mt-1 text-sm text-slate-500">保存后会按新配比重新计算候选人库中的简历分数。</p>
              </div>
              <button onClick={() => setShowConfig(false)} className="rounded-app px-2 py-1 text-slate-500 hover:bg-slate-100">关闭</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {scoreKeys.map((key) => {
                const logic = config?.logic.find((item) => item.key === key);
                return (
                  <label key={key} className="rounded-app border border-blue-100 p-3">
                    <span className="block text-sm font-medium text-slate-700">{logic?.label ?? key}</span>
                    <input type="number" min="0" max="100" step="1" value={draftWeights[key]} onChange={(event) => updateWeight(key, event.target.value)} className="mt-2 w-full rounded-app border border-blue-100 px-3 py-2" />
                    <span className="mt-2 block text-xs leading-5 text-slate-500">{logic?.description}</span>
                  </label>
                );
              })}
            </div>
            <div className="mt-4 rounded-app bg-slate-50 p-3 text-sm leading-6 text-slate-600">
              简历评分依据采用“岗位匹配度”评估框架，核心包括技能匹配、经验相关性、教育背景、关键词覆盖和职业稳定性。系统会将候选人简历中的技能、项目、工作经历与岗位描述进行语义和关键词比对，识别硬技能、行业经验、职能经验及成果表达。高分代表候选人与岗位核心能力要求高度一致，且具备可验证的项目或工作成果；低分通常表示关键技能缺失、经验年限不足、岗位方向偏差或简历信息不完整。评分并非单纯关键词计数，而是综合能力强度、上下文相关性和岗位权重配置，用于辅助筛选，不替代人工判断。
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button onClick={() => setShowConfig(false)} className="bg-slate-200 text-slate-700 hover:bg-slate-300">取消</Button>
              <Button onClick={() => void saveScoreConfig()} disabled={savingConfig}>{savingConfig ? "保存中..." : "保存并重算"}</Button>
            </div>
          </Card>
        </div>
      )}

      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={closeDetail}>
          <aside
            className="absolute right-0 top-0 h-full w-full max-w-[520px] translate-x-0 overflow-y-auto bg-white shadow-2xl transition-all duration-300 ease-out"
            onClick={(event) => event.stopPropagation()}
          >
            {detailLoading && !detail ? (
              <div className="p-8 text-sm text-slate-500">Candidate Detail 加载中...</div>
            ) : drawerCandidate ? (
              <div className="space-y-6 p-6">
                <div className="flex items-start justify-between gap-3 border-b border-blue-50 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">Candidate Detail</p>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">{candidateName(drawerCandidate)}</h2>
                    <p className="text-sm text-slate-500">{candidateRole(drawerCandidate)}</p>
                  </div>
                  <button onClick={closeDetail} className="rounded-app p-2 text-slate-500 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => navigate?.("ATS Pipeline")} className="inline-flex items-center gap-2"><Route size={15} />Move Pipeline</Button>
                  <Button onClick={() => navigate?.("Interviews")} className="inline-flex items-center gap-2"><ExternalLink size={15} />Schedule Interview</Button>
                  <Button onClick={() => void addNote()} className="inline-flex items-center gap-2"><PlusCircle size={15} />Add Note</Button>
                  <Button onClick={downloadResume} className="inline-flex items-center gap-2"><Download size={15} />Download Resume</Button>
                </div>

                <section className="flex items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-blue-50 text-lg font-semibold text-feishu">
                    {candidateName(drawerCandidate).slice(0, 1)}
                  </div>
                  <div className="min-w-0 text-sm leading-6">
                    <div>状态：{stageLabels[drawerCandidate.pipeline_status] ?? drawerCandidate.pipeline_status}</div>
                    <div>Fit Score: {Number(drawerCandidate.fit_score || 0).toFixed(1)}</div>
                    <div className="flex flex-wrap gap-1 pt-1">{drawerCandidate.tags.map((tag) => <Badge key={tag} tone="blue">{tag}</Badge>)}</div>
                  </div>
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-2 font-semibold">联系方式</h3>
                  <div className="space-y-1 break-all text-sm text-slate-600">
                    <div>{display(drawerContact.email || drawerCandidate.email)}</div>
                    <div>{display(drawerContact.phone || drawerCandidate.phone)}</div>
                    <div>{display(drawerContact.linkedin)}</div>
                    <div>{display(drawerContact.website || drawerContact.github)}</div>
                  </div>
                </section>

                <section className="grid grid-cols-2 gap-4 border-t border-blue-50 pt-4 text-sm">
                  <div>
                    <h3 className="mb-2 font-semibold">教育背景</h3>
                    <p className="break-words text-slate-600">{candidateEducation(drawerCandidate)}</p>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold">工作经验</h3>
                    <div className="space-y-1 text-slate-600">{experience.map((line) => <p key={line}>{line}</p>)}</div>
                  </div>
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-2 font-semibold">技能</h3>
                  <div className="flex flex-wrap gap-1.5">{(drawerSkills.length ? drawerSkills : ["-"]).map((skill) => <Badge key={skill} tone="slate">{skill}</Badge>)}</div>
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-2 font-semibold">项目经历</h3>
                  <div className="space-y-1 text-sm text-slate-600">{(projects.length ? projects : ["-"]).map((project) => <p key={project}>{project}</p>)}</div>
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Original Resume</h3>
                    <button onClick={() => setResumeOpen((value) => !value)} className="text-sm text-feishu">{resumeOpen ? "收起" : "展开"}</button>
                  </div>
                  {resumeOpen && <pre className="mt-3 max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded-app bg-slate-50 p-3 text-xs leading-5 text-slate-700">{originalResume(drawerCandidate) || "No resume text"}</pre>}
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-2 font-semibold">Resume Attachment</h3>
                  {detail?.resumeFile ? (
                    <>
                      <button disabled={!attachmentIsPdf(detail)} onClick={() => setPdfOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-app border border-blue-100 px-3 py-2 text-sm text-feishu disabled:text-slate-400">
                        <FileText size={15} /> Preview PDF
                      </button>
                      {pdfOpen && detail.resumeFileUrl && attachmentIsPdf(detail) && <iframe src={detail.resumeFileUrl} className="mt-3 h-80 w-full rounded-app border border-blue-100" title="Resume PDF" />}
                    </>
                  ) : (
                    <p className="text-sm text-slate-500">No attachment</p>
                  )}
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-3 font-semibold">招聘时间线</h3>
                  <div className="space-y-2 text-sm text-slate-600">
                    {(detail?.timeline.length ? detail.timeline : drawerCandidate.history || []).map((item, index) => (
                      <div key={`${item.stage}-${index}`} className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-feishu" />
                        <span>{stageLabels[item.stage] ?? item.stage}</span>
                        <span className="text-slate-400">{item.result}</span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="border-t border-blue-50 pt-4">
                  <h3 className="mb-3 font-semibold">面试记录</h3>
                  <div className="space-y-3 text-sm text-slate-600">
                    {detail?.interviews.length ? detail.interviews.map((interview) => (
                      <div key={interview.id} className="rounded-app border border-blue-100 p-3">
                        <div className="font-medium text-slate-800">{interview.title}</div>
                        <div>Communication: {display(interview.communication)}</div>
                        <div>Technical: {display(interview.technical)}</div>
                        <div>Comments: {display(interview.notes)}</div>
                      </div>
                    )) : <p>-</p>}
                    {notes.map((note) => <p key={`${note.date}-${note.text}`} className="rounded-app bg-slate-50 p-2">Note: {note.text}</p>)}
                  </div>
                </section>
              </div>
            ) : null}
          </aside>
        </div>
      )}
    </>
  );
}
