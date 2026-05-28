import { BarChart3, BriefcaseBusiness, Database, FileUp, KanbanSquare, Mail, Settings, Sparkles, UsersRound } from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

const items = [
  ["Dashboard", "仪表盘", BarChart3],
  ["Data Import", "数据导入", FileUp],
  ["Data Cleaning", "数据清洗", Sparkles],
  ["Candidates", "候选人库", Database],
  ["ATS Pipeline", "招聘流程", KanbanSquare],
  ["Interviews", "面试中心", UsersRound],
  ["Settings", "设置", Settings],
] as const;

export function Shell({ page, setPage, children }: { page: string; setPage: (page: string) => void; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="sticky top-0 z-40 border-b border-blue-100 bg-white px-4 py-4 shadow-soft lg:fixed lg:left-0 lg:top-0 lg:h-full lg:w-64 lg:border-b-0 lg:border-r lg:py-5">
        <div className="mb-4 flex items-center gap-3 px-2 lg:mb-8">
          <div className="grid h-10 w-10 place-items-center rounded-app bg-feishu text-white">
            <BriefcaseBusiness size={20} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold">智能招聘平台</div>
            <div className="text-xs text-slate-500">AI Recruitment ATS</div>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
          {items.map(([pageKey, label, Icon]) => (
            <button
              key={pageKey}
              onClick={() => setPage(pageKey)}
              className={`flex shrink-0 items-center gap-3 rounded-app px-3 py-3 text-left text-sm transition lg:w-full ${
                page === pageKey ? "bg-feishu text-white shadow-soft" : "text-slate-600 hover:bg-blue-50 hover:text-feishu"
              }`}
            >
              <Icon size={18} />
              <span className="whitespace-nowrap">{label}</span>
            </button>
          ))}
        </nav>
        <a
          href="mailto:raaiiiia1@gmail.com"
          className="mt-4 flex items-center gap-3 rounded-app border border-blue-100 px-3 py-3 text-sm text-slate-600 transition hover:bg-blue-50 hover:text-feishu lg:absolute lg:bottom-5 lg:left-4 lg:right-4"
        >
          <Mail size={18} />
          <span className="break-all">raaiiiia1@gmail.com</span>
        </a>
      </aside>
      <main className="min-h-screen p-4 lg:ml-64 lg:p-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} key={page}>
          {children}
        </motion.div>
      </main>
    </div>
  );
}
