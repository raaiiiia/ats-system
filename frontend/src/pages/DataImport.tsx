import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileSpreadsheet, Trash2, UploadCloud } from "lucide-react";

import { api } from "../api";
import type { ImportFile } from "../types";
import { Badge, Button, Card, PageHeader } from "../components/UI";

const fields = ["role", "resume", "job_description", "decision", "reason", "name", "email", "phone", "skills", "education", "experience"];
const fieldLabels: Record<string, string> = {
  role: "应聘岗位",
  resume: "简历全文",
  job_description: "岗位描述",
  decision: "决策结果",
  reason: "原因",
  name: "姓名",
  email: "邮箱",
  phone: "电话",
  skills: "技能",
  education: "学历",
  experience: "经验"
};
const statusLabels: Record<string, string> = { uploaded: "已上传", processed: "已处理", failed: "失败" };
const dataTypeLabels: Record<string, string> = {
  resume_data: "简历数据",
  recruitment_data: "招聘数据",
  candidate_data: "候选人数据",
  job_data: "岗位数据",
  unknown_data: "未知数据"
};

function formatSize(size: number) {
  return `${(size / 1024).toFixed(1)} KB`;
}

function Metric({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="rounded-app bg-blue-50/70 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className="mt-1 text-base font-semibold text-ink">{value ?? "-"}</div>
    </div>
  );
}

export function DataImport({ refreshToken, onChanged }: { refreshToken: number; onChanged?: () => void }) {
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [preview, setPreview] = useState<{ file: ImportFile; columns: string[]; mapping: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ImportFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

  const processedCount = useMemo(() => files.filter((file) => file.status === "processed").length, [files]);

  const load = () => api.files().then(setFiles);

  useEffect(() => void load(), [refreshToken]);

  async function upload(uploadFiles: FileList | null) {
    if (!uploadFiles?.length) return;
    setBusy(true);
    try {
      await api.upload(Array.from(uploadFiles));
      await load();
      onChanged?.();
    } finally {
      setBusy(false);
    }
  }

  async function clean(fileId: string) {
    setBusyId(fileId);
    try {
      await api.clean(fileId);
      await load();
      onChanged?.();
    } finally {
      setBusyId("");
    }
  }

  async function openPreview(file: ImportFile) {
    const data = await api.preview(file.id);
    setPreview({ file, columns: data.columns, mapping: data.mapping });
  }

  async function saveMapping() {
    if (!preview) return;
    await api.updateMapping(preview.file.id, preview.mapping);
    await load();
    onChanged?.();
    setPreview(null);
  }

  async function confirmDeleteFile() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteImportFile(deleteTarget.id);
      await load();
      onChanged?.();
      setNotice("文件已删除");
      window.setTimeout(() => setNotice(""), 2600);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="数据导入与清洗" subtitle="上传原始文件、确认字段映射，并在同一工作台完成 ETL 清洗。" />

      <div className="grid min-h-[calc(100vh-150px)] gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.75fr)]">
        <div className="flex min-h-0 flex-col gap-4">
          <Card className="p-4">
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                void upload(event.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-app border-2 border-dashed border-blue-200 bg-blue-50/60 px-6 py-8 text-center transition hover:border-feishu"
            >
              <UploadCloud className="mb-2 text-feishu" size={28} />
              <span className="text-sm font-semibold text-ink">拖拽文件到这里，或点击上传</span>
              <span className="mt-1 text-xs text-slate-500">支持 CSV、XLSX、JSON、TXT、DOCX、PDF 和 ZIP，支持批量上传</span>
              <input disabled={busy} multiple type="file" className="hidden" onChange={(event) => void upload(event.target.files)} />
            </label>
          </Card>

          <Card className="flex min-h-[420px] flex-1 flex-col p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold">已上传文件</div>
              <Badge tone="slate">{files.length} 个文件</Badge>
            </div>
            <div className="min-h-0 flex-1 overflow-x-auto thin-scrollbar">
              <table className="w-full min-w-[920px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[30%]" />
                  <col className="w-[9%]" />
                  <col className="w-[10%]" />
                  <col className="w-[18%]" />
                  <col className="w-[11%]" />
                  <col className="w-[12%]" />
                  <col className="w-[10%]" />
                </colgroup>
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="py-2">文件名</th>
                    <th>格式</th>
                    <th>大小</th>
                    <th>上传时间</th>
                    <th>状态</th>
                    <th>数据类型</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-t border-blue-50 align-middle">
                      <td className="break-words py-3 pr-3 font-medium">{file.filename}</td>
                      <td>{file.file_format.toUpperCase()}</td>
                      <td>{formatSize(file.size_bytes)}</td>
                      <td>{new Date(file.uploaded_at).toLocaleString()}</td>
                      <td>
                        <Badge tone={file.status === "processed" ? "green" : "blue"}>{statusLabels[file.status] ?? file.status}</Badge>
                      </td>
                      <td>
                        <Badge tone="slate">{dataTypeLabels[file.detected_type] ?? file.detected_type}</Badge>
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <Button onClick={() => void openPreview(file)} className="px-3 py-1.5 text-xs">
                            字段映射
                          </Button>
                          <button
                            aria-label="删除文件"
                            title="删除文件"
                            onClick={() => setDeleteTarget(file)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-app bg-red-50 text-red-700 transition hover:bg-red-100"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!files.length && (
                <div className="grid h-full min-h-[300px] place-items-center rounded-app border border-dashed border-blue-100 bg-slate-50/70 text-sm text-slate-500">
                  上传文件后会在这里显示字段映射和处理状态
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="flex min-h-[520px] flex-col p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">数据清洗</div>
              <div className="mt-1 text-xs text-slate-500">对已上传文件执行去重、空值过滤和候选人结构化入库。</div>
            </div>
            <Badge tone="green">{processedCount}/{files.length} 已处理</Badge>
          </div>

          {!files.length ? (
            <div className="grid flex-1 place-items-center rounded-app border border-dashed border-blue-100 bg-blue-50/40 p-6 text-center">
              <div>
                <FileSpreadsheet className="mx-auto mb-3 text-slate-400" size={30} />
                <div className="text-sm font-medium text-ink">等待导入文件</div>
                <div className="mt-1 text-xs text-slate-500">清洗板块会保持完整区域，导入后直接出现可处理文件。</div>
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 thin-scrollbar">
              {files.map((file) => (
                <div key={file.id} className="rounded-app border border-blue-100 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{file.filename}</div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>{file.file_format.toUpperCase()}</span>
                        <span>{formatSize(file.size_bytes)}</span>
                      </div>
                    </div>
                    <Badge tone={file.status === "processed" ? "green" : "blue"}>
                      {file.status === "processed" && <CheckCircle2 size={12} />}
                      {statusLabels[file.status] ?? file.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Metric label="原始行" value={file.clean_summary?.raw_rows as number | undefined} />
                    <Metric label="去重" value={file.clean_summary?.removed_duplicates as number | undefined} />
                    <Metric label="空值" value={file.clean_summary?.removed_empty as number | undefined} />
                    <Metric label="有效行" value={file.clean_summary?.final_rows as number | undefined} />
                  </div>

                  <Button onClick={() => void clean(file.id)} disabled={busyId === file.id} className="mt-3 w-full py-1.5 text-xs">
                    {busyId === file.id ? "清洗中..." : file.status === "processed" ? "重新运行 ETL" : "运行 ETL"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {notice && <div className="fixed bottom-6 right-6 z-30 rounded-app border border-green-100 bg-white px-4 py-3 text-sm font-medium text-green-700 shadow-lg">{notice}</div>}

      {deleteTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/30 p-6">
          <Card className="w-full max-w-md">
            <div className="text-lg font-semibold text-slate-900">删除文件？</div>
            <div className="mt-3 rounded-app bg-slate-50 p-3 text-sm text-slate-700">
              <div className="font-medium">文件：{deleteTarget.filename}</div>
              <div className="mt-3 text-slate-500">同时删除：</div>
              <ul className="mt-2 space-y-1 text-slate-700">
                <li>原始文件</li>
                <li>处理结果</li>
                <li>缓存数据</li>
              </ul>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button className="bg-slate-200 text-slate-700 hover:bg-slate-300" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                取消
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => void confirmDeleteFile()} disabled={deleting}>
                {deleting ? "删除中..." : "删除"}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-20 grid place-items-center bg-slate-900/30 p-6">
          <Card className="w-full max-w-3xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="font-semibold">字段映射</div>
                <div className="text-sm text-slate-500">{preview.file.filename}</div>
              </div>
              <button onClick={() => setPreview(null)} className="text-slate-500">
                关闭
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {fields.map((field) => (
                <label key={field} className="text-sm">
                  <span className="mb-1 block text-slate-500">{fieldLabels[field]}</span>
                  <select
                    value={preview.mapping[field] ?? ""}
                    onChange={(event) => setPreview({ ...preview, mapping: { ...preview.mapping, [field]: event.target.value } })}
                    className="w-full rounded-app border border-blue-100 px-3 py-2"
                  >
                    <option value="">未映射</option>
                    {preview.columns.map((column) => (
                      <option key={column}>{column}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button className="bg-slate-200 text-slate-700 hover:bg-slate-300" onClick={() => setPreview(null)}>
                取消
              </Button>
              <Button onClick={() => void saveMapping()}>保存映射</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
