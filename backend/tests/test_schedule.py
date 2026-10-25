import json

import pytest
from fastapi.testclient import TestClient

import main
from main import find_conflict, free_rooms, times_overlap

ROOMS = [
    {"room": "B101", "building": "Baker Hall"},
    {"room": "B204", "building": "Baker Hall"},
    {"room": "E105", "building": "Engineering Center"},
]


def make_class(id, room, days, start, end, code="TST100"):
    return {"id": id, "course_code": code, "course_name": "Test", "instructor": "Dr. T",
            "room": room, "building": "Baker Hall", "days": days,
            "start_time": start, "end_time": end}


CLASSES = [
    make_class(1, "B101", ["Mon", "Wed"], "09:00", "10:00", "AAA101"),
    make_class(2, "B101", ["Mon"], "13:00", "14:00", "BBB202"),
    make_class(3, "B204", ["Tue"], "09:00", "10:00", "CCC303"),
]


# ---------- free-room logic ----------

def by_room(result):
    return {r["room"]: r for r in result}


def test_room_in_use_is_not_free():
    result = by_room(free_rooms(ROOMS, CLASSES, "Mon", "09:30"))
    assert "B101" not in result
    assert {"B204", "E105"} <= set(result)


def test_start_inclusive_end_exclusive():
    assert "B101" not in by_room(free_rooms(ROOMS, CLASSES, "Mon", "09:00"))  # starts now
    assert "B101" in by_room(free_rooms(ROOMS, CLASSES, "Mon", "10:00"))      # just ended


def test_other_days_do_not_block():
    # B204 is only used on Tuesday
    assert "B204" in by_room(free_rooms(ROOMS, CLASSES, "Mon", "09:30"))
    assert "B204" not in by_room(free_rooms(ROOMS, CLASSES, "Tue", "09:30"))


def test_next_class_start():
    result = by_room(free_rooms(ROOMS, CLASSES, "Mon", "10:30"))
    assert result["B101"]["next_class_start"] == "13:00"
    assert result["B101"]["next_course"] == "BBB202"
    assert result["E105"]["next_class_start"] is None  # never used


def test_no_next_class_after_last_one():
    result = by_room(free_rooms(ROOMS, CLASSES, "Mon", "15:00"))
    assert result["B101"]["next_class_start"] is None


# ---------- overlap detection ----------

def test_times_overlap():
    assert times_overlap("09:00", "10:00", "09:30", "10:30")
    assert times_overlap("09:00", "12:00", "10:00", "11:00")  # containment
    assert not times_overlap("09:00", "10:00", "10:00", "11:00")  # back-to-back is fine


def test_find_conflict_same_room_and_day():
    hit = find_conflict(CLASSES, "B101", ["Wed"], "09:30", "10:30")
    assert hit is not None
    other, day = hit
    assert other["id"] == 1 and day == "Wed"


def test_find_conflict_ignores_other_room_day_or_time():
    assert find_conflict(CLASSES, "B204", ["Mon"], "09:00", "10:00") is None  # different day
    assert find_conflict(CLASSES, "E105", ["Mon"], "09:00", "10:00") is None  # different room
    assert find_conflict(CLASSES, "B101", ["Mon"], "10:00", "11:00") is None  # adjacent
    assert find_conflict(CLASSES, "b101", ["Mon"], "09:15", "09:45") is not None  # case-insensitive


# ---------- API: POST validation / 409 ----------

@pytest.fixture
def client(tmp_path, monkeypatch):
    path = tmp_path / "schedule.json"
    path.write_text(json.dumps({"rooms": ROOMS, "classes": CLASSES}))
    monkeypatch.setattr(main, "DATA_FILE", path)
    with TestClient(main.app) as c:  # context manager runs startup (loads the file)
        yield c


NEW = {"course_code": "new100", "course_name": "New Course", "instructor": "Dr. N",
       "room": "B204", "building": "Baker Hall", "days": ["Mon"],
       "start_time": "09:00", "end_time": "10:00"}


def test_post_creates_and_persists(client):
    r = client.post("/api/classes", json=NEW)
    assert r.status_code == 201
    assert r.json()["id"] == 4 and r.json()["course_code"] == "NEW100"
    saved = json.loads(main.DATA_FILE.read_text())
    assert len(saved["classes"]) == 4


def test_post_overlap_returns_409(client):
    r = client.post("/api/classes", json={**NEW, "room": "B101", "start_time": "09:30",
                                           "end_time": "10:30"})
    assert r.status_code == 409
    assert "AAA101" in r.json()["detail"]


def test_post_rejects_bad_times(client):
    assert client.post("/api/classes", json={**NEW, "start_time": "11:00",
                                              "end_time": "10:00"}).status_code == 422
    assert client.post("/api/classes", json={**NEW, "start_time": "9am"}).status_code == 422


def test_delete(client):
    assert client.delete("/api/classes/1").status_code == 204
    assert client.delete("/api/classes/1").status_code == 404


def test_free_endpoint(client):
    r = client.get("/api/rooms/free", params={"day": "Mon", "time": "09:30"})
    assert r.status_code == 200
    assert "B101" not in [x["room"] for x in r.json()]
