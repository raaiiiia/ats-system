import { lazy, Suspense, useState } from "react";

import { Shell } from "./components/Shell";

const Candidates = lazy(() => import("./pages/Candidates").then((module) => ({ default: module.Candidates })));
const Dashboard = lazy(() => import("./pages/Dashboard").then((module) => ({ default: module.Dashboard })));
const DataCleaning = lazy(() => import("./pages/DataCleaning").then((module) => ({ default: module.DataCleaning })));
const DataImport = lazy(() => import("./pages/DataImport").then((module) => ({ default: module.DataImport })));
const Interviews = lazy(() => import("./pages/Interviews").then((module) => ({ default: module.Interviews })));
const Pipeline = lazy(() => import("./pages/Pipeline").then((module) => ({ default: module.Pipeline })));
const Settings = lazy(() => import("./pages/Settings").then((module) => ({ default: module.Settings })));

export default function App() {
  const [page, setPage] = useState(() => localStorage.getItem("ats-page") || "Dashboard");
  const [refreshToken, setRefreshToken] = useState(0);

  function navigate(next: string) {
    localStorage.setItem("ats-page", next);
    setPage(next);
  }

  return (
    <Shell page={page} setPage={navigate}>
      <Suspense fallback={<div className="rounded-app bg-white p-8 shadow-soft">工作区加载中...</div>}>
        {page === "Dashboard" && <Dashboard refreshToken={refreshToken} />}
        {page === "Data Import" && <DataImport refreshToken={refreshToken} onChanged={() => setRefreshToken((x) => x + 1)} />}
        {page === "Data Cleaning" && <DataCleaning onProcessed={() => setRefreshToken((x) => x + 1)} />}
        {page === "Candidates" && <Candidates refreshToken={refreshToken} setPage={navigate} />}
        {page === "ATS Pipeline" && <Pipeline />}
        {page === "Interviews" && <Interviews />}
        {page === "Settings" && <Settings />}
      </Suspense>
    </Shell>
  );
}
