import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { DAYS, fmt12, fmtRange, toMinutes } from "../utils";
import { Status } from "./Status";

const HOUR_PX = 72; // height of one hour; tall enough for a 50-min class to show 3 lines

// Stable hue per course code; CSS turns it into light/dark-mode colours
function colour(code) {
  let h = 0;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return { "--h": h };
}

export default function RoomSchedule({ rooms, version }) {
  const [room, setRoom] = useState(rooms[0]?.room || "");

  const { data, loading, error } = useAsync(
    () => (room ? api.roomSchedule(room) : Promise.resolve([])),
    [room, version]
  );

  // Group rooms by building for the dropdown
  const byBuilding = {};
  rooms.forEach((r) => (byBuilding[r.building] ||= []).push(r.room));

  return (
    <section>
      <div className="filters compact">
        <select value={room} onChange={(e) => setRoom(e.target.value)} aria-label="Room">
          {Object.entries(byBuilding).map(([b, list]) => (
            <optgroup key={b} label={b}>
              {list.map((r) => (
                <option key={r}>{r}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <span className="muted">{rooms.find((r) => r.room === room)?.building}</span>
      </div>

      <Status loading={loading && !data} error={error} />
      {data && (
        <div className={loading ? "dim" : ""}>
          {data.length === 0 && <Status empty={`No classes in ${room}.`} />}
          <WeekGrid classes={data} />
        </div>
      )}
    </section>
  );
}

function WeekGrid({ classes }) {
  // Visible range fits the classes (at least 4 hours); empty rooms show 8:00-17:00
  let startHour = 8;
  let endHour = 17;
  if (classes.length) {
    startHour = Math.min(...classes.map((c) => Math.floor(toMinutes(c.start_time) / 60)));
    endHour = Math.max(...classes.map((c) => Math.ceil(toMinutes(c.end_time) / 60)), startHour + 4);
  }
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const px = (minutes) => ((minutes - startHour * 60) / 60) * HOUR_PX;

  return (
    <div className="week-wrap">
      <div className="week" style={{ "--hour": `${HOUR_PX}px` }}>
        <div className="week-corner" />
        {DAYS.map((d) => (
          <div key={d} className="week-head">
            {d}
          </div>
        ))}

        <div className="time-col">
          {hours.map((h) => (
            <div key={h} className="time-label">
              {fmt12(`${h}:00`)}
            </div>
          ))}
        </div>

        {DAYS.map((d) => (
          <div key={d} className="day-col" style={{ height: hours.length * HOUR_PX }}>
            {classes
              .filter((c) => c.days.includes(d))
              .map((c) => {
                const start = toMinutes(c.start_time);
                const end = toMinutes(c.end_time);
                return (
                  <div
                    key={c.id}
                    className="block"
                    style={{ top: px(start), height: px(end) - px(start) - 2, ...colour(c.course_code) }}
                    title={`${c.course_code} ${c.course_name}\n${c.instructor}\n${fmtRange(c.start_time, c.end_time)}`}
                  >
                    <strong>{c.course_code}</strong>
                    <span>{fmtRange(c.start_time, c.end_time)}</span>
                    <span>{c.instructor}</span>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}
