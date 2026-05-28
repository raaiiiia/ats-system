# AI Recruitment Intelligence Platform

Enterprise ATS and interview management system with automated data import, ETL, resume parsing, candidate database, Kanban pipeline, interview scoring, and cached dashboard visualizations.

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
