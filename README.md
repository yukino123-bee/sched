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
pip install -r requirements.txt
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
  data/schedule.json seed data (10 rooms, 3 buildings, 26 classes)
  tests/             pytest tests
frontend/
  src/api.js         fetch helper
  src/App.jsx        tabs + Add Class modal
  src/components/    FindClass, FreeRooms, RoomSchedule, AddClassForm, Status
  src/styles.css
```
# sched
