"""Class Schedule & Room Finder API.

All data lives in data/schedule.json, is loaded into memory at startup and
written back after every change.
"""
import json
import os
import shutil
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware

from models import DAYS, TIME_RE, ClassIn, ClassOut, Day, FreeRoom, Room

SEED_FILE = Path(__file__).parent / "data" / "schedule.json"
# Set DATA_FILE to keep the live data elsewhere (e.g. a mounted disk on Render).
# If that file doesn't exist yet, it's created from the bundled seed data.
DATA_FILE = Path(os.environ.get("DATA_FILE", SEED_FILE))

# In-memory state: {"rooms": [{room, building}], "classes": [{id, ...}]}
store: dict = {"rooms": [], "classes": []}
lock = threading.Lock()


# ---------- persistence ----------

def load_data() -> None:
    if not DATA_FILE.exists():
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SEED_FILE, DATA_FILE)
    with open(DATA_FILE, encoding="utf-8") as f:
        raw = json.load(f)
    store["rooms"] = raw["rooms"]
    store["classes"] = raw["classes"]


def save_data() -> None:
    # Write to a temp file then swap, so a crash can't leave a half-written file
    tmp = DATA_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(store, f, indent=2)
    os.replace(tmp, DATA_FILE)


# ---------- pure scheduling logic (unit-tested) ----------

def to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def times_overlap(a_start: str, a_end: str, b_start: str, b_end: str) -> bool:
    """Half-open intervals: back-to-back classes (10:00-11:00, 11:00-12:00) don't overlap."""
    return to_minutes(a_start) < to_minutes(b_end) and to_minutes(b_start) < to_minutes(a_end)


def find_conflict(classes: list[dict], room: str, days: list[str],
                  start: str, end: str) -> Optional[tuple[dict, str]]:
    """Return (existing_class, day) for the first class in `room` that overlaps, else None."""
    for c in classes:
        if c["room"].upper() != room.upper():
            continue
        if not times_overlap(start, end, c["start_time"], c["end_time"]):
            continue
        for day in days:
            if day in c["days"]:
                return c, day
    return None


def free_rooms(rooms: list[dict], classes: list[dict], day: str, time: str) -> list[dict]:
    """Rooms with no class running at day/time, plus when their next class starts."""
    now = to_minutes(time)
    result = []
    for r in rooms:
        todays = [c for c in classes
                  if c["room"].upper() == r["room"].upper() and day in c["days"]]
        # A class is running from its start (inclusive) until its end (exclusive)
        if any(to_minutes(c["start_time"]) <= now < to_minutes(c["end_time"]) for c in todays):
            continue
        upcoming = sorted((c for c in todays if to_minutes(c["start_time"]) > now),
                          key=lambda c: to_minutes(c["start_time"]))
        nxt = upcoming[0] if upcoming else None
        result.append({
            "room": r["room"],
            "building": r["building"],
            "next_class_start": nxt["start_time"] if nxt else None,
            "next_course": nxt["course_code"] if nxt else None,
        })
    return sorted(result, key=lambda r: (r["building"], r["room"]))


def schedule_sort_key(c: dict):
    return DAYS.index(c["days"][0]), c["start_time"]


# ---------- app ----------

@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_data()
    yield


app = FastAPI(title="Class Schedule & Room Finder", lifespan=lifespan)
# Allowed browser origins: comma-separated ALLOWED_ORIGINS env var (your Vercel URL in production).
# Optional ALLOWED_ORIGIN_REGEX also lets you allow e.g. Vercel preview deployments.
origins = [o.strip().rstrip("/") for o in os.environ.get(
    "ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.environ.get("ALLOWED_ORIGIN_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root():
    return {"service": "Class Schedule & Room Finder API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health():
    """Used by Render's health check."""
    return {"status": "ok"}


@app.get("/api/classes", response_model=list[ClassOut])
def list_classes(
    q: Optional[str] = Query(None, description="Search course code, name or instructor"),
    day: Optional[Day] = None,
    building: Optional[str] = None,
    room: Optional[str] = None,
):
    results = store["classes"]
    if q and q.strip():
        needle = q.strip().lower()
        results = [c for c in results
                   if needle in f'{c["course_code"]} {c["course_name"]} {c["instructor"]}'.lower()]
    if day:
        results = [c for c in results if day in c["days"]]
    if building:
        results = [c for c in results if c["building"].lower() == building.lower()]
    if room:
        results = [c for c in results if c["room"].lower() == room.lower()]
    return sorted(results, key=lambda c: (c["course_code"], c["start_time"]))


@app.get("/api/rooms", response_model=list[Room])
def list_rooms():
    return sorted(store["rooms"], key=lambda r: (r["building"], r["room"]))


@app.get("/api/rooms/free", response_model=list[FreeRoom])
def get_free_rooms(day: Day, time: str = Query(..., pattern=TIME_RE)):
    return free_rooms(store["rooms"], store["classes"], day, time)


@app.get("/api/rooms/{room}/schedule", response_model=list[ClassOut])
def room_schedule(room: str):
    if not any(r["room"].lower() == room.lower() for r in store["rooms"]):
        raise HTTPException(404, f"Room {room} not found")
    in_room = [c for c in store["classes"] if c["room"].lower() == room.lower()]
    return sorted(in_room, key=schedule_sort_key)


@app.post("/api/classes", response_model=ClassOut, status_code=201)
def add_class(body: ClassIn):
    data = body.model_dump()
    with lock:
        known = next((r for r in store["rooms"] if r["room"] == data["room"]), None)
        if known and known["building"].lower() != data["building"].lower():
            raise HTTPException(
                422, f'Room {data["room"]} is in {known["building"]}, not {data["building"]}')

        hit = find_conflict(store["classes"], data["room"], data["days"],
                            data["start_time"], data["end_time"])
        if hit:
            other, day = hit
            raise HTTPException(
                409,
                f'Room {data["room"]} is already booked on {day} by {other["course_code"]} '
                f'({other["start_time"]}-{other["end_time"]}), which overlaps '
                f'{data["start_time"]}-{data["end_time"]}.')

        if known:
            data["building"] = known["building"]  # keep canonical spelling
        else:
            store["rooms"].append({"room": data["room"], "building": data["building"]})
        data["id"] = max((c["id"] for c in store["classes"]), default=0) + 1
        store["classes"].append(data)
        save_data()
    return data


@app.delete("/api/classes/{class_id}", status_code=204)
def delete_class(class_id: int):
    with lock:
        match = next((c for c in store["classes"] if c["id"] == class_id), None)
        if not match:
            raise HTTPException(404, f"Class {class_id} not found")
        store["classes"].remove(match)
        save_data()
    return Response(status_code=204)
