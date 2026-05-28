import { useEffect, useState } from "react";
import { Trash2, UploadCloud } from "lucide-react";

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

export function DataImport({ refreshToken, onChanged }: { refreshToken: number; onChanged?: () => void }) {
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [preview, setPreview] = useState<{ file: ImportFile; columns: string[]; mapping: Record<string, string> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImportFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");

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
      setNotice("✓ File deleted successfully");
      window.setTimeout(() => setNotice(""), 2600);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader title="数据导入中心" subtitle="上传 CSV、XLSX、JSON、TXT、DOCX、PDF 和 ZIP 文件，系统会自动识别并映射字段。" />
      <Card className="mb-6">
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void upload(event.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-app border-2 border-dashed border-blue-200 bg-blue-50/60 px-8 py-12 text-center transition hover:border-feishu"
        >
          <UploadCloud className="mb-3 text-feishu" size={32} />
          <span className="font-medium">拖拽文件到这里，或点击上传</span>
          <span className="mt-1 text-sm text-slate-500">支持批量上传</span>
          <input disabled={busy} multiple type="file" className="hidden" onChange={(event) => void upload(event.target.files)} />
        </label>
      </Card>

      <Card>
        <div className="mb-4 text-sm font-semibold">已上传文件</div>
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[9%]" />
              <col className="w-[10%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
              <col className="w-[13%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead className="text-xs text-slate-400">
              <tr>
                <th className="py-3">文件名</th>
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
                  <td className="break-words py-4 pr-3 font-medium">{file.filename}</td>
                  <td>{file.file_format.toUpperCase()}</td>
                  <td>{(file.size_bytes / 1024).toFixed(1)} KB</td>
                  <td>{new Date(file.uploaded_at).toLocaleString()}</td>
                  <td><Badge tone={file.status === "processed" ? "green" : "blue"}>{statusLabels[file.status] ?? file.status}</Badge></td>
                  <td><Badge tone="slate">{dataTypeLabels[file.detected_type] ?? file.detected_type}</Badge></td>
                  <td>
                    <div className="flex justify-end gap-2">
                      <Button onClick={() => void openPreview(file)} className="px-3 py-1.5">字段映射</Button>
                      <button
                        aria-label="删除文件"
                        title="删除文件"
                        onClick={() => setDeleteTarget(file)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-app bg-red-50 text-red-700 transition hover:bg-red-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {notice && (
        <div className="fixed bottom-6 right-6 z-30 rounded-app border border-green-100 bg-white px-4 py-3 text-sm font-medium text-green-700 shadow-lg">
          {notice}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-30 grid place-items-center bg-slate-900/30 p-6">
          <Card className="w-full max-w-md">
            <div className="text-lg font-semibold text-slate-900">⚠ Delete File?</div>
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
                Cancel
              </Button>
              <Button className="bg-red-600 hover:bg-red-700" onClick={() => void confirmDeleteFile()} disabled={deleting}>
                {deleting ? "Deleting..." : "Delete"}
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
              <button onClick={() => setPreview(null)} className="text-slate-500">关闭</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((field) => (
                <label key={field} className="text-sm">
                  <span className="mb-1 block text-slate-500">{fieldLabels[field]}</span>
                  <select
                    value={preview.mapping[field] ?? ""}
                    onChange={(event) => setPreview({ ...preview, mapping: { ...preview.mapping, [field]: event.target.value } })}
                    className="w-full rounded-app border border-blue-100 px-3 py-2"
                  >
                    <option value="">未映射</option>
                    {preview.columns.map((column) => <option key={column}>{column}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <Button className="bg-slate-200 text-slate-700 hover:bg-slate-300" onClick={() => setPreview(null)}>取消</Button>
              <Button onClick={() => void saveMapping()}>保存映射</Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
