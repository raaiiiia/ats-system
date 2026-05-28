# Deployment Guide

This project is split into a Vite frontend and a FastAPI backend. Deploy them as separate services.

## Recommended Topology

- Frontend: Vercel, Netlify, or Cloudflare Pages
- Backend: Render, Railway, Fly.io, or any container host
- Database: managed PostgreSQL
- Cache: managed Redis
- Upload storage: persistent disk for demos, object storage for production

The current backend stores uploaded files on disk through `STORAGE_DIR`. On production platforms with ephemeral filesystems, use a persistent disk or replace local storage with S3/R2/Supabase Storage before handling important files.

## Frontend Environment

Set this variable in the frontend hosting platform:

```env
VITE_API_BASE_URL=https://your-backend.example.com
```

Leave it empty only when the frontend and backend are served from the same origin with `/api` routed to the backend.

For local development, the Vite dev server proxies `/api` to:

```env
VITE_DEV_API_PROXY=http://127.0.0.1:8000
```

## Backend Environment

Set these variables on the backend service:

```env
APP_NAME=AI Recruitment Intelligence Platform
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DB_NAME
REDIS_URL=redis://USER:PASSWORD@HOST:6379/0
STORAGE_DIR=storage
FRONTEND_ORIGIN=https://your-frontend.example.com
CORS_ORIGINS=https://your-frontend.example.com,https://preview-frontend.example.com
```

`CORS_ORIGINS` accepts a comma-separated list of allowed frontend origins.

## Local Production Check

Backend:

```bash
cd backend
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm run build
npm run preview
```

## Container Backend

Build and run the FastAPI service:

```bash
cd backend
docker build -t ats-backend .
docker run --env-file .env -p 8000:8000 ats-backend
```

## Deployment Order

1. Create PostgreSQL and Redis.
2. Deploy the backend with the backend environment variables.
3. Verify `https://your-backend.example.com/api/health`.
4. Deploy the frontend with `VITE_API_BASE_URL` pointing to the backend origin.
5. Add the final frontend URL to backend `CORS_ORIGINS`.
