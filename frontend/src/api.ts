import type {
  CandidateDetail,
  CandidatePage,
  DashboardStats,
  ImportDebugItem,
  ImportFile,
  Interview,
  PipelineColumn,
  ResumeScoreConfig,
  ResumeScoreWeights
} from "./types";

const jsonHeaders = { "Content-Type": "application/json" };
const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");

function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(url), init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  upload(files: File[]) {
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    return request<ImportFile[]>("/api/imports/upload", { method: "POST", body: form });
  },
  files() {
    return request<ImportFile[]>("/api/imports/files");
  },
  importDebug() {
    return request<ImportDebugItem[]>("/api/imports/debug");
  },
  preview(fileId: string) {
    return request<{ columns: string[]; rows: Record<string, unknown>[]; mapping: Record<string, string>; detectedType: string }>(`/api/imports/${fileId}/preview`);
  },
  updateMapping(fileId: string, field_mapping: Record<string, string>) {
    return request<ImportFile>(`/api/imports/${fileId}/mapping`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ field_mapping }) });
  },
  clean(fileId: string) {
    return request<ImportFile>(`/api/imports/${fileId}/clean`, { method: "POST" });
  },
  deleteImportFile(fileId: string) {
    return request(`/api/files/${fileId}`, { method: "DELETE" });
  },
  candidates(params: URLSearchParams) {
    return request<CandidatePage>(`/api/candidates?${params.toString()}`);
  },
  candidateDetail(candidateId: string) {
    return request<CandidateDetail>(`/api/candidates/${candidateId}/detail`);
  },
  addCandidateNote(candidateId: string, note: string) {
    return request<CandidateDetail>(`/api/candidates/${candidateId}/note`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ note }) });
  },
  updateTags(candidateId: string, tags: string[]) {
    return request(`/api/candidates/${candidateId}/tags`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ tags }) });
  },
  updateStatus(candidateId: string, pipeline_status: string) {
    return request(`/api/candidates/${candidateId}/status`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ pipeline_status }) });
  },
  scoreConfig() {
    return request<ResumeScoreConfig>("/api/candidates/score-config");
  },
  updateScoreConfig(weights: ResumeScoreWeights) {
    return request<ResumeScoreConfig>("/api/candidates/score-config", { method: "PUT", headers: jsonHeaders, body: JSON.stringify({ weights }) });
  },
  pipeline() {
    return request<PipelineColumn[]>("/api/pipeline");
  },
  addStage(name: string) {
    return request("/api/pipeline/stages", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ name }) });
  },
  moveCandidate(candidate_id: string, stage: string) {
    return request("/api/pipeline/move", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ candidate_id, stage, result: "Moved by recruiter" }) });
  },
  interviews() {
    return request<Interview[]>("/api/interviews");
  },
  createInterview(payload: { title: string; scheduled_at: string; location: string; interviewer: string }) {
    return request<Interview>("/api/interviews", { method: "POST", headers: jsonHeaders, body: JSON.stringify(payload) });
  },
  interviewDetail(id: string) {
    return request<{ interview: Interview; candidates: Array<{ candidate: import("./types").Candidate; score: Record<string, unknown> }> }>(`/api/interviews/${id}`);
  },
  addCandidateToInterview(interviewId: string, candidateId: string) {
    return request(`/api/interviews/${interviewId}/candidates/${candidateId}`, { method: "POST" });
  },
  removeCandidateFromInterview(interviewId: string, candidateId: string) {
    return request(`/api/interviews/${interviewId}/candidates/${candidateId}`, { method: "DELETE" });
  },
  scoreCandidate(interviewId: string, candidateId: string, payload: Record<string, unknown>) {
    return request(`/api/interviews/${interviewId}/candidates/${candidateId}/score`, { method: "PUT", headers: jsonHeaders, body: JSON.stringify(payload) });
  },
  stats() {
    return request<DashboardStats>("/api/dashboard/stats");
  },
  charts() {
    return request<Record<string, unknown>>("/api/dashboard/charts");
  },
  generateCharts() {
    return request<Record<string, unknown>>("/api/dashboard/generate", { method: "POST" });
  }
};
