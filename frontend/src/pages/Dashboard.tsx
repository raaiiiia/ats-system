import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";

import { api } from "../api";
import { Button, Card, PageHeader } from "../components/UI";
import type { DashboardStats } from "../types";

type DashboardCharts = {
  generated?: boolean;
  funnel?: Array<{ name: string; value: number }>;
  levels?: Array<{ name: string; value: number }>;
  heatmap?: { levels: string[]; skills: string[]; data: number[][]; max: number };
  skillNetwork?: { nodes: Array<{ name: string; value: number; symbolSize?: number }>; links: Array<{ source: string; target: string; value: number }> };
};

const stageLabels: Record<string, string> = { Resume: "简历筛选", Interview1: "一面", Interview2: "二面", Offer: "Offer", Rejected: "已拒绝" };
const levelLabels: Record<string, string> = { Entry: "入门", Junior: "初级", Mid: "中级", Senior: "高级", Unknown: "未知" };

export function Dashboard({ refreshToken }: { refreshToken: number }) {
  const [stats, setStats] = useState<DashboardStats>({ candidates: 0, pendingInterviews: 0, offers: 0, upcomingSessions: 0 });
  const [charts, setCharts] = useState<DashboardCharts>({ generated: false });

  useEffect(() => {
    void api.stats().then(setStats);
    void api.charts().then((data) => setCharts(data as DashboardCharts));
  }, [refreshToken]);

  return (
    <>
      <PageHeader title="仪表盘" subtitle="展示招聘运营核心指标；图表在点击生成后计算并缓存。" />
      <div className="mb-6 grid grid-cols-4 gap-5">
        <Stat label="候选人" value={stats.candidates} />
        <Stat label="待面试" value={stats.pendingInterviews} />
        <Stat label="Offer" value={stats.offers} />
        <Stat label="即将开始场次" value={stats.upcomingSessions} />
      </div>
      {!charts.generated ? (
        <Card className="grid h-96 place-items-center text-center">
          <div>
            <div className="text-lg font-semibold">可视化尚未生成</div>
            <div className="mt-2 text-sm text-slate-500">为避免页面加载时执行高成本计算，图表会在需要时手动生成。</div>
            <Button className="mt-5" onClick={() => void api.generateCharts().then((data) => setCharts(data as DashboardCharts))}>生成图表</Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-5">
          <Card><ReactECharts option={funnelOption(charts.funnel ?? [])} style={{ height: 320 }} /></Card>
          <Card><ReactECharts option={levelOption(charts.levels ?? [])} style={{ height: 320 }} /></Card>
          <Card><ReactECharts option={heatOption(charts.heatmap)} style={{ height: 360 }} /></Card>
          <Card><ReactECharts option={networkOption(charts.skillNetwork)} style={{ height: 360 }} /></Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <Card><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-3xl font-semibold">{value}</div></Card>;
}

function funnelOption(data: Array<{ name: string; value: number }>) {
  return {
    title: { text: "招聘漏斗" },
    tooltip: { trigger: "item" },
    series: [{ type: "funnel", sort: "none", data: data.map((item) => ({ ...item, name: stageLabels[item.name] ?? item.name })) }]
  };
}

function levelOption(data: Array<{ name: string; value: number }>) {
  return {
    title: { text: "候选人等级分布" },
    tooltip: { trigger: "item" },
    series: [{ type: "pie", radius: ["40%", "70%"], data: data.map((item) => ({ ...item, name: levelLabels[item.name] ?? item.name })) }]
  };
}

function heatOption(heatmap?: DashboardCharts["heatmap"]) {
  return {
    title: { text: "技能热力图" },
    tooltip: {},
    grid: { top: 70, left: 90, right: 20, bottom: 80 },
    xAxis: { type: "category", data: heatmap?.skills ?? [], axisLabel: { rotate: 45 } },
    yAxis: { type: "category", data: (heatmap?.levels ?? []).map((level) => levelLabels[level] ?? level) },
    visualMap: { min: 0, max: heatmap?.max ?? 1, calculable: true, orient: "horizontal", left: "center", bottom: 10 },
    series: [{ type: "heatmap", data: heatmap?.data ?? [], label: { show: true } }]
  };
}

function networkOption(network?: DashboardCharts["skillNetwork"]) {
  return {
    title: { text: "技能网络图" },
    tooltip: {},
    series: [{
      type: "graph",
      layout: "force",
      roam: true,
      data: network?.nodes ?? [],
      links: network?.links ?? [],
      edgeSymbol: ["none", "none"],
      force: { repulsion: 140, edgeLength: [40, 120] },
      lineStyle: { opacity: 0.45, width: 1.5 },
      emphasis: { focus: "adjacency" }
    }]
  };
}
