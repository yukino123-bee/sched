# Class Schedule & Room Finder

Find where and when a class is held, and which rooms are free at a given time.
React (Vite) frontend + FastAPI backend. No database: data lives in
`backend/data/schedule.json`, is loaded into memory at startup and written back on every change.

## Requirements

- Python 3.10+
- Node.js 18+

## Run the backend (http://localhost:8000)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt            # add: -r requirements-dev.txt to run tests
uvicorn main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

## Run the frontend (http://localhost:5173)

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to `http://localhost:8000`
(see `frontend/vite.config.js`), so start the backend first.

## Run the tests

```bash
cd backend
source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

Covers the free-room logic, overlap detection, and the POST (201 / 409 / 422) and DELETE endpoints.
API tests run against a temporary copy of the data, so your `schedule.json` is untouched.

## API

All times are 24h `HH:MM`; days are `Mon`–`Fri`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/classes?q=&day=&building=&room=` | List classes; all params optional |
| GET | `/api/rooms` | All rooms with building |
| GET | `/api/rooms/free?day=Mon&time=10:30` | Rooms with no class at that day/time, with next class start |
| GET | `/api/rooms/{room}/schedule` | Classes in a room, sorted by day/time |
| POST | `/api/classes` | Add a class. `422` on invalid fields, `409` if it overlaps a class in the same room/day |
| DELETE | `/api/classes/{id}` | Remove a class (`204`, or `404`) |

Example:

```bash
curl -X POST localhost:8000/api/classes -H 'Content-Type: application/json' -d '{
  "course_code": "CS499", "course_name": "Capstone", "instructor": "Dr. Lee",
  "room": "E310", "building": "Engineering Center",
  "days": ["Mon", "Wed"], "start_time": "15:00", "end_time": "16:15"
}'
```

## Deploy: backend on Render, frontend on Vercel

Push this repo to GitHub first. Deploy the backend first, because the frontend needs its URL.

### 1. Backend → Render
1. In Render: **New + → Blueprint**, pick the repo. It reads `render.yaml`
   (root dir `backend`, build `pip install -r requirements.txt`,
   start `uvicorn main:app --host 0.0.0.0 --port $PORT`, health check `/api/health`).
   Or create a **Web Service** manually with those same settings.
2. Note the service URL, e.g. `https://class-schedule-api.onrender.com`.
3. After step 2 below, set the env var **`ALLOWED_ORIGINS`** to your Vercel URL
   (e.g. `https://my-app.vercel.app`, comma-separate several) and redeploy.
   Optional: `ALLOWED_ORIGIN_REGEX=https://.*\.vercel\.app` also allows preview deployments.

### 2. Frontend → Vercel
1. In Vercel: **Add New → Project**, import the repo, set **Root Directory** to `frontend`
   (Vite is auto-detected; see `frontend/vercel.json`).
2. Add the environment variable **`VITE_API_URL`** = your Render URL (no trailing slash).
3. Deploy. Changing `VITE_API_URL` later requires a redeploy, since Vite bakes it in at build time.

### Data persistence on Render
The free tier has an **ephemeral filesystem**: classes added or deleted in production are lost
when the service restarts, redeploys, or spins down after idle (it restarts from the seed data).
The first request after idle can also take ~30–60 s. To keep changes, use a paid plan, attach a
persistent disk (e.g. mounted at `/var/data`) and set `DATA_FILE=/var/data/schedule.json`;
the file is created from the seed data on first start.

### Environment variables
| Where | Name | Purpose |
| --- | --- | --- |
| Render | `ALLOWED_ORIGINS` | Comma-separated frontend origins allowed by CORS |
| Render | `ALLOWED_ORIGIN_REGEX` | Optional regex for extra origins (previews) |
| Render | `DATA_FILE` | Optional path for the live JSON file (persistent disk) |
| Vercel | `VITE_API_URL` | Backend base URL, e.g. `https://class-schedule-api.onrender.com` |

## Notes

- Rooms are stored in `schedule.json` alongside classes, so a room stays listed even if its
  last class is deleted. Adding a class in a new room registers that room automatically.
- Back-to-back classes (one ends 10:00, the next starts 10:00) are allowed.
- Free-room check: a class occupies `[start, end)`, so a room is free at exactly its end time.
- Weekends aren't supported; the "Now" button falls back to Monday on Saturday/Sunday.
- To reset the data, restore `backend/data/schedule.json` from your copy or version control.

## Layout

```
backend/
  main.py            FastAPI app, endpoints, scheduling logic
  models.py          Pydantic models + validation
  requirements.txt   runtime deps (requirements-dev.txt adds pytest/httpx)
  data/schedule.json seed data (10 rooms, 3 buildings, 26 classes)
  tests/             pytest tests
render.yaml          Render blueprint (backend)
frontend/
  vercel.json        Vercel config; .env.example documents VITE_API_URL
  src/api.js         fetch helper
  src/App.jsx        tabs + Add Class modal
  src/components/    FindClass, FreeRooms, RoomSchedule, AddClassForm, Status
  src/styles.css
```
# sched
