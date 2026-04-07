# Installation Guide

## Prerequisites

- **Node.js** 18+ (for frontend build)
- **Python** 3.9+ (for backend)
- **Hermes Agent** already installed and running

---

## 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
pip install -r requirements.txt
```

### Start the Backend

```bash
./start.sh
```

Or manually:

```bash
uvicorn main:app --reload --port 23689
```

The backend serves:
- API at `http://localhost:23689/api`
- Frontend at `http://localhost:23689`

---

## 2. Frontend Setup

```bash
cd frontend
npm install
npm run build
```

This generates the static assets in `dist/`, which FastAPI serves at `/`.

For development with hot reload:

```bash
npm run dev
```

---

## 3. Network Access

By default, the server binds to `0.0.0.0:23689` and is accessible from:

| Address Type | URL Example |
|-------------|-------------|
| Localhost | `http://localhost:23689` |
| LAN | `http://192.168.x.x:23689` |
| External IP | `http://YOUR_EXTERNAL_IP:23689` |

The Dashboard shows active network addresses in the **NETWORK ACCESS** card.

---

## 4. Configuration

**No configuration needed** — CyberUI automatically reads all settings from your Hermes installation (`~/.hermes/`). API keys, tokens, provider endpoints, and model configuration are picked up from Hermes' existing config files and environment.

The Settings page in the UI shows the active model, provider, and endpoint detected from `~/.hermes/config.yaml`. You do not need to create a `.env` file or set any environment variables manually.

---

## 5. Troubleshooting

### Frontend build fails

```bash
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

### Backend won't start

Check that port 23689 is free:

```bash
lsof -i :23689
```

### CSS/styling issues

The cyberpunk CSS requires a modern browser. Make sure Tailwind JIT is not purging custom classes — the `cyber.css` file is imported in `main.tsx`, not only in `index.html`.

---

## 6. Update

Pull latest changes and rebuild:

```bash
cd backend && ./stop.sh && git pull && ./start.sh
cd frontend && git pull && npm install && npm run build
```
