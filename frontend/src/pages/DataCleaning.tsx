import { useEffect, useState } from "react";

import { api } from "../api";
import type { ImportFile } from "../types";
import { Badge, Button, Card, PageHeader } from "../components/UI";

const statusLabels: Record<string, string> = { uploaded: "已上传", processed: "已处理", failed: "失败" };
const dataTypeLabels: Record<string, string> = {
  resume_data: "简历数据",
  recruitment_data: "招聘数据",
  candidate_data: "候选人数据",
  job_data: "岗位数据",
  unknown_data: "未知数据"
};

export function DataCleaning({ onProcessed }: { onProcessed: () => void }) {
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api.files().then(setFiles);
  useEffect(() => void load(), []);

  async function clean(fileId: string) {
    setBusyId(fileId);
    try {
      await api.clean(fileId);
      await load();
      onProcessed();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="数据清洗中心" subtitle="对导入数据执行缺失值处理、去重、文本标准化、联系方式提取和简历解析。" />
      <div className="grid gap-4">
        {files.map((file) => {
          const summary = file.clean_summary ?? {};
          return (
            <Card key={file.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold">{file.filename}</div>
                  <div className="mt-2 flex gap-2">
                    <Badge tone="slate">{dataTypeLabels[file.detected_type] ?? file.detected_type}</Badge>
                    <Badge tone={file.status === "processed" ? "green" : "blue"}>{statusLabels[file.status] ?? file.status}</Badge>
                  </div>
                </div>
                <Button disabled={busyId === file.id} onClick={() => void clean(file.id)}>
                  {busyId === file.id ? "处理中..." : "运行 ETL"}
                </Button>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-4">
                <Metric label="原始数据量" value={summary.raw_rows ?? file.row_count ?? 0} />
                <Metric label="删除重复" value={summary.removed_duplicates ?? 0} />
                <Metric label="删除空值" value={summary.removed_empty ?? 0} />
                <Metric label="最终数据" value={summary.final_rows ?? 0} />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number | string | string[] }) {
  return (
    <div className="rounded-app bg-blue-50 p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-feishu">{Array.isArray(value) ? value.length : value}</div>
    </div>
  );
}
