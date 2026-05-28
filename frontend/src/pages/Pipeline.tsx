import { useEffect, useState } from "react";

import { api } from "../api";
import type { PipelineColumn } from "../types";
import { Badge, Button, Card, PageHeader } from "../components/UI";

const stageLabels: Record<string, string> = {
  Resume: "简历筛选",
  Interview1: "一面",
  Interview2: "二面",
  Offer: "Offer",
  Rejected: "已拒绝",
};

const levelLabels: Record<string, string> = {
  Entry: "入门",
  Junior: "初级",
  Mid: "中级",
  Senior: "高级",
  Unknown: "未知",
};

const labelStage = (stage: string) => stageLabels[stage] ?? stage;
const labelLevel = (level: string) => levelLabels[level] ?? level;

export function Pipeline() {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [stageName, setStageName] = useState("");

  const load = () => api.pipeline().then(setColumns);
  useEffect(() => void load(), []);

  async function addStage() {
    if (!stageName.trim()) return;
    await api.addStage(stageName.trim());
    setStageName("");
    await load();
  }

  async function dropCandidate(candidateId: string, stage: string) {
    if (!candidateId) return;
    await api.moveCandidate(candidateId, stage);
    await load();
  }

  return (
    <>
      <PageHeader title="招聘流程看板" subtitle="通过拖拽管理候选人在简历筛选、面试、Offer 和拒绝阶段之间的流转。" />
      <Card className="mb-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={stageName}
            onChange={(event) => setStageName(event.target.value)}
            placeholder="新增面试轮次，例如 Interview3"
            className="min-w-0 flex-1 rounded-app border border-blue-100 px-3 py-2"
          />
          <Button onClick={() => void addStage()}>新增阶段</Button>
        </div>
      </Card>
      <div className="grid auto-cols-[280px] grid-flow-col gap-4 overflow-x-auto pb-4">
        {columns.map((column) => (
          <Card
            key={column.id}
            className="min-h-[560px]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => void dropCandidate(event.dataTransfer.getData("candidate-id"), column.name)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0 break-words font-semibold">{labelStage(column.name)}</div>
              <Badge tone="slate">{column.candidates.length}</Badge>
            </div>
            <div className="space-y-3">
              {column.candidates.map((candidate) => (
                <div
                  key={candidate.id}
                  draggable
                  onDragStart={(event) => event.dataTransfer.setData("candidate-id", candidate.id)}
                  className="cursor-grab rounded-app border border-blue-100 bg-blue-50/60 p-4 active:cursor-grabbing"
                >
                  <div className="break-words font-medium">{candidate.name}</div>
                  <div className="mt-1 break-words text-sm text-slate-500">{candidate.role || "未识别岗位"}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge>{labelLevel(candidate.level)}</Badge>
                    {candidate.email && <span className="break-all text-xs text-slate-500">{candidate.email}</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
