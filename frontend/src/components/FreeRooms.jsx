import { useState } from "react";
import { api } from "../api";
import { useAsync } from "../hooks";
import { DAYS, fmt12, now } from "../utils";
import { Status } from "./Status";

export default function FreeRooms({ version }) {
  const [{ day, time }, setWhen] = useState(now); // defaults to the current day/time

  const { data, loading, error } = useAsync(
    () => (time ? api.freeRooms(day, time) : Promise.resolve(null)),
    [day, time, version]
  );

  // Group rooms by building (API already sorts by building then room)
  const groups = {};
  (data || []).forEach((r) => (groups[r.building] ||= []).push(r));

  return (
    <section>
      <div className="filters">
        <select value={day} onChange={(e) => setWhen((w) => ({ ...w, day: e.target.value }))} aria-label="Day">
          {DAYS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <input
          type="time"
          value={time}
          onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))}
          aria-label="Time"
        />
        <button className="btn" onClick={() => setWhen(now())}>
          Now
        </button>
      </div>

      {!time && <Status empty="Pick a time to see free rooms." />}
      <Status
        loading={loading && !data}
        error={error}
        empty={data && data.length === 0 && `No rooms are free on ${day} at ${fmt12(time)}.`}
      />

      {data && data.length > 0 && (
        <div className={loading ? "dim" : ""}>
          <p className="summary">
            <strong>{data.length} free</strong> on {day} at {fmt12(time)}
          </p>
          {Object.entries(groups).map(([building, list]) => (
            <div key={building} className="group">
              <h2>
                {building} <span>{list.length}</span>
              </h2>
              <div className="cards">
                {list.map((r) => (
                  <div key={r.room} className="card">
                    <div className="card-title">
                      <span className="dot" aria-hidden="true" />
                      {r.room}
                    </div>
                    <div className="muted">
                      {r.next_class_start
                        ? `Free until ${fmt12(r.next_class_start)} (${r.next_course})`
                        : "Free for the rest of the day"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
