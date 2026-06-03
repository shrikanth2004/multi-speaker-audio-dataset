# Multi-Audio Dataset Platform — Live Meeting Recorder

Google Meet–style voice meetings with WebRTC. The host downloads one combined audio file locally — nothing is stored on the server.

## Deploy (GitHub + Vercel)

See **[DEPLOY.md](DEPLOY.md)** for step-by-step hosting (Vercel frontend + Render API for WebSockets).

## Quick start

```powershell
cd backend
python main.py
```

Or from the project root: `.\run.ps1`

Open [http://localhost:8000](http://localhost:8000), sign in (email + name), create a room, start the meeting, then **End meeting** → **Download recording**.

## Optional `.env`

```env
MEETING_BASE_URL=http://localhost:8000
CORS_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
```

Defaults work without a `.env` file.

## Stack

- **Frontend:** HTML, CSS, JavaScript (WebRTC + WebSocket)
- **Backend:** FastAPI (in-memory meeting rooms, demo login)

Meeting rooms exist in server memory only and are cleared when the server restarts.
