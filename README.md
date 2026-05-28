# AI Recruitment Intelligence Platform

Enterprise ATS and interview management system with automated data import, ETL, resume parsing, candidate database, Kanban pipeline, interview scoring, and cached dashboard visualizations.

## Live Demo

Visit the deployed site:

https://collarai.vercel.app

## 功能介绍

该平台是一个端到端的智能招聘 ATS，覆盖从简历/数据导入、数据清洗、候选人解析、岗位匹配评分、招聘流程推进，到面试安排和可视化分析的完整流程。

### 1. 数据导入中心

- 支持批量上传候选人数据文件，适配 CSV、XLSX、XLS、JSON、TXT、DOCX、PDF 和 ZIP 等格式。
- 上传后可预览字段和样例行，系统会自动识别数据类型并推断字段映射。
- 可手动调整字段映射，将岗位、简历、岗位描述、录用决策、原因、姓名、邮箱、电话、技能、学历、经历等列映射到系统字段。
- 支持删除上传文件，并保留导入状态、文件大小、行数和清洗摘要。

### 2. 数据清洗与候选人生成

- 对上传文件执行一键清洗，将原始文件转换为标准候选人记录。
- 自动规范化文本，提取联系方式，识别简历正文、岗位信息、岗位描述和历史决策信息。
- 生成清洗结果摘要，标记已上传、已处理或失败状态，便于追踪导入质量。
- 支持内置示例数据 `resume_dataset.csv`，可直接导入体验完整流程。

### 3. 简历解析与候选人画像

- 从简历文本中解析姓名、目标岗位、邮箱、电话、学历、技能、项目经历、工作经历、经验年限和经验时长。
- 保留原始简历内容，同时生成结构化 `parsed_data`，方便候选人详情页展示和后续评分。
- 对解析结果进行缓存，减少重复解析，提高大量候选人场景下的响应速度。

### 4. 智能岗位匹配评分

- 根据简历内容和岗位描述计算候选人与岗位的匹配度。
- 评分由岗位文本匹配、技能匹配、经验年限和学历背景四部分组成。
- 默认权重为文本匹配 45%、技能 25%、经验 20%、学历 10%，并支持在候选人库中调整权重后批量重新评分。
- 技能评分会识别岗位描述中的必需技能，展示命中技能、缺失技能和评分依据。
- 根据综合分数和经验年限自动划分 Entry、Junior、Mid、Senior 等候选人级别。

### 5. 候选人库管理

- 支持候选人分页浏览、关键词搜索、按招聘阶段筛选。
- 候选人列表展示岗位、联系方式、学历、技能、经验、匹配分数、级别、标签和当前流程阶段。
- 支持查看候选人详情，包括结构化画像、评分拆解、项目/经历、备注和原始简历。
- 支持编辑标签、更新流程状态、添加备注、下载简历文本。
- 支持候选人数据导出，后端提供 CSV 和 Excel 导出接口，前端也支持导出当前列表数据。

### 6. ATS 招聘流程看板

- 以看板方式展示候选人在不同招聘阶段的分布。
- 内置简历筛选、一面、二面、Offer、已拒绝等阶段。
- 支持新增自定义阶段，并通过拖拽候选人完成阶段流转。
- 每次候选人移动会写入状态和历史记录，方便追踪招聘进度。

### 7. 面试中心

- 支持创建面试场次，记录面试标题、时间、地点和面试官。
- 可从候选人池中添加或移除面试候选人。
- 支持按沟通能力、技术能力、领导力、问题解决能力、文化匹配度进行评分。
- 自动计算平均分，并记录通过、拒绝或待定结果及面试备注。

### 8. 数据仪表盘与分析

- 首页统计候选人总数、待处理面试、Offer 数量和即将开始的面试。
- 支持按需生成并缓存图表，减少重复计算。
- 可视化内容包括招聘漏斗、候选人级别分布、岗位/技能热力图和技能关系网络。
- 帮助招聘团队从整体上观察候选人质量、流程转化和技能供给情况。

### 9. 设置与调试

- 提供导入调试视图，用于检查文件导入、字段映射、解析结果和候选人生成情况。
- 便于定位数据格式不匹配、字段缺失或解析异常等问题。

### 10. 后端与部署能力

- 后端基于 FastAPI 提供 REST API，覆盖导入、候选人、流程、面试和仪表盘模块。
- 使用 PostgreSQL 存储业务数据，Redis 缓存解析结果和仪表盘图表。
- 支持通过 `VITE_API_BASE_URL` 配置前端访问的后端地址，通过 `CORS_ORIGINS` 配置允许访问的前端域名。
- 支持前后端分离部署，前端可部署到 Vercel 或 GitHub Pages，后端可部署到支持 Python/FastAPI 的平台。

## Stack

- Frontend: React, TypeScript, TailwindCSS, ECharts, Framer Motion
- Backend: FastAPI, SQLAlchemy, PostgreSQL, Redis
- AI/NLP: sentence-transformers, scikit-learn, spaCy-compatible parsing hooks
- Storage: local `backend/storage` for development, persistent disk or object storage for production

## Project Structure

```text
frontend/    React TypeScript application
backend/     FastAPI service and local file storage
database/    PostgreSQL schema bootstrap
API/         API collection and OpenAPI notes
```

## Quick Start

### 1. Database and Redis

Create a PostgreSQL database and Redis instance. For local development:

```bash
docker compose up -d
```

Or run services manually:

```bash
createdb ats_platform
redis-server
psql ats_platform < database/init.sql
```

The API also creates tables on startup.

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set `DATABASE_URL` and `REDIS_URL` in `backend/.env`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5174`.

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). In short, deploy the frontend and backend separately:

- Frontend reads the backend origin from `VITE_API_BASE_URL`.
- Backend accepts frontend domains from comma-separated `CORS_ORIGINS`.
- Production should use managed PostgreSQL, managed Redis, and persistent upload storage.

## Existing Dataset

The repository includes `resume_dataset.csv` at the root. Upload it in Data Import Center. The backend maps these columns automatically:

- `Role` -> Role
- `Resume` -> Resume
- `Decision` -> Decision
- `Reason_for_decision` -> Reason
- `Job_Description` -> Job Description

## Performance Notes

- Resume parsing is cached in Redis and persisted in `candidate.parsed_data`.
- Candidates are paginated server-side.
- Frontend search is debounced.
- Candidate table uses virtualized rows for large pages.
- Dashboard charts are generated only on demand and cached.
- File text extraction is done once per import and stored as local metadata.
