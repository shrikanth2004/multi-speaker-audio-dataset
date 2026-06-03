# Deploy to GitHub + Vercel (+ Render for API)

This app has a **static frontend** and a **Python API with WebSockets**. Vercel is ideal for the frontend; the API should run on [Render](https://render.com) (free tier) because Vercel serverless does not support long-lived WebSocket meetings.

---

## Part 1 — Push to GitHub

### 1. Initialize git (if you have not already)

```powershell
cd "C:\Users\HP\OneDrive\Desktop\multu-audio dataset"
git init
git add .
git commit -m "Initial commit: Live Meeting Recorder"
```

`.gitignore` already excludes `.venv/`, `.env`, audio files, and other large folders.

### 2. Create a GitHub repository

1. Go to [https://github.com/new](https://github.com/new)
2. Name it (e.g. `multu-audio-meeting`)
3. Do **not** add a README if you already have one locally
4. Click **Create repository**

### 3. Push your code

```powershell
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

---

## Part 2 — Deploy the API on Render (required for live meetings)

### 1. Create a Render account

Sign up at [https://render.com](https://render.com) and connect your GitHub account.

### 2. New Web Service

1. **Dashboard** → **New +** → **Web Service**
2. Connect the same GitHub repo
3. Settings:
   - **Name:** `multu-audio-api`
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### 3. Environment variables (Render → Environment)

| Key | Example |
|-----|---------|
| `MEETING_BASE_URL` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `CORS_ORIGINS` | `https://your-app.vercel.app,http://localhost:8000` |

4. Click **Create Web Service** and wait until it is **Live**.
5. Copy your Render URL, e.g. `https://multu-audio-api.onrender.com`

---

## Part 3 — Deploy the frontend on Vercel

### 1. Import the repo

1. Go to [https://vercel.com](https://vercel.com) and sign in with GitHub
2. **Add New…** → **Project**
3. Import your repository

### 2. Project settings

| Setting | Value |
|---------|--------|
| Framework Preset | **Other** |
| Root Directory | `.` (repo root) |
| Build Command | *(leave empty)* |
| Output Directory | `frontend` |

Vercel reads `vercel.json` in the repo root.

### 3. Connect API via rewrites

Edit `vercel.json` in your repo and replace `YOUR-BACKEND-URL` with your Render hostname (no `https://`):

```json
"destination": "https://multu-audio-api.onrender.com/api/:path*"
```

and

```json
"destination": "https://multu-audio-api.onrender.com/ws/:path*"
```

Commit and push — Vercel will redeploy automatically.

### 4. Deploy

Click **Deploy**. Your site will be at `https://your-project.vercel.app`.

### 5. Update Render `MEETING_BASE_URL`

In Render environment variables, set:

```
MEETING_BASE_URL=https://your-project.vercel.app
```

Redeploy Render if needed.

---

## Part 4 — Verify

1. Open your Vercel URL
2. Sign in (email + name)
3. Create a meeting room and join from another browser
4. If API calls fail, check:
   - Render service is running
   - `vercel.json` rewrites use the correct Render URL
   - `CORS_ORIGINS` on Render includes your Vercel domain

Health check (via rewrite): `https://your-project.vercel.app/api/health`  
Should return `{"status":"ok"}`.

---

## Alternative: everything on Render (simpler, one URL)

Skip Vercel and deploy only on Render:

- **Root Directory:** `backend`
- **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `MEETING_BASE_URL` to your Render URL

The backend already serves the `frontend/` folder. One URL for UI + API + WebSockets.

---

## What not to commit

Already in `.gitignore`:

- `backend/.venv/`
- `.env` files
- `data/` and `*.webm` recordings
- `.vercel/` folder

Never commit secrets or large audio files.
