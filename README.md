# YouTube Summariser & Analyser

A RAG application that summarises and analyses YouTube videos using Gemini AI.

**Stack:** React (Vite) · Express/TypeScript · Postgres + pgvector · Gemini API

---

## Deployment: Render (API) + Neon (Postgres) + Vercel (frontend)

### 1 — Neon Postgres (database)

1. Create a free account at [neon.tech](https://neon.tech)
2. Create a new **Project** → you get a default database called `neondb`
3. In the project dashboard, click **Connect** and copy the **connection string**
   - It looks like: `postgres://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`
4. Enable the `pgvector` extension — open the **SQL Editor** in Neon and run:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   ```
5. Run the schema migration locally (or from the Neon SQL Editor using the contents of `server/src/db/schema.sql`):
   ```bash
   cd server
   cp .env.example .env
   # Fill in DATABASE_URL with the Neon connection string
   npm run migrate
   ```

---

### 2 — Render (Express API)

1. Create a free account at [render.com](https://render.com)
2. New → **Web Service** → connect your GitHub repository
3. Configure:
   - **Root Directory:** `server`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | Your Neon connection string (with `?sslmode=require`) |
   | `YOUTUBE_API_KEY` | From [Google Cloud Console](https://console.cloud.google.com) |
   | `GEMINI_API_KEY` | From [Google AI Studio](https://aistudio.google.com) |
   | `ANTHROPIC_API_KEY` | Optional — leave blank if unused |
   | `LLM_PROVIDER` | `gemini` |
   | `NODE_ENV` | `production` |
   | `DATABASE_SSL` | `true` |

5. Deploy. Render will build and start your API at `https://yt-summarizer-api.onrender.com` (URL varies).

> **Free tier note:** Render's free web services spin down after 15 minutes of inactivity. The first request after a cold start takes ~30s. Upgrade to the $7/month Starter plan to keep the instance warm.

---

### 3 — Vercel (React frontend)

1. Create a free account at [vercel.com](https://vercel.com)
2. New Project → Import your GitHub repository
3. Configure:
   - **Root Directory:** `client`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:

   | Key | Value |
   |-----|-------|
   | `VITE_API_BASE_URL` | Your Render service URL, e.g. `https://yt-summarizer-api.onrender.com` |

5. Deploy. Vercel gives you a `*.vercel.app` URL instantly.

---

## Local development

### Prerequisites
- Node.js ≥ 20
- A Postgres instance with `pgvector` (use Neon free tier or Docker: `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 pgvector/pgvector:pg16`)

### Setup

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure server environment
cd ../server
cp .env.example .env
# Edit .env — fill in DATABASE_URL, YOUTUBE_API_KEY, GEMINI_API_KEY

# 3. Run database migration
npm run migrate

# 4. Start the API server (http://localhost:3000)
npm run dev

# 5. In a second terminal, start the React dev server (http://localhost:5173)
cd ../client
npm run dev
# Vite proxies /api → localhost:3000 automatically
```

---

## Environment variables reference

### Server (`server/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Full Postgres connection string |
| `YOUTUBE_API_KEY` | ✅ | YouTube Data API v3 key |
| `GEMINI_API_KEY` | ✅ | Google Gemini API key |
| `ANTHROPIC_API_KEY` | ☐ | Anthropic key (provider stub, not wired at MVP) |
| `LLM_PROVIDER` | ✅ | `gemini` (default) |
| `NODE_ENV` | ✅ | `development` or `production` |
| `DATABASE_SSL` | ✅ | `true` for Neon/cloud Postgres; `false` for local no-SSL |
| `PORT` | ☐ | Defaults to `3000` |

### Client (`client/.env`)

| Variable | Required | Description |
|---|---|---|
| `VITE_API_BASE_URL` | ☐ | API base URL; empty = use Vite proxy (local dev) |

---

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/videos` | Submit a YouTube URL |
| `GET` | `/api/v1/videos/:id` | Poll video processing status |
| `GET` | `/api/v1/videos/:id/similar` | Get similar videos |
| `POST` | `/api/v1/videos/:id/messages` | Ask a question (SSE stream) |
| `GET` | `/api/v1/videos/:id/conversations/:cid/messages` | Load conversation history |
| `GET` | `/health` | Health check |
