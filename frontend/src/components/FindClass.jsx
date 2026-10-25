import { useState } from "react";
import { api } from "../api";
import { useAsync, useDebounce } from "../hooks";
import { DAYS, fmtRange } from "../utils";
import { Status } from "./Status";

export default function FindClass({ rooms, version, onChanged }) {
  const [q, setQ] = useState("");
  const [day, setDay] = useState("");
  const [building, setBuilding] = useState("");
  const [deleteError, setDeleteError] = useState(null);

  const debouncedQ = useDebounce(q, 300);
  const buildings = [...new Set(rooms.map((r) => r.building))].sort();

  const { data, loading, error } = useAsync(
    () => api.classes({ q: debouncedQ.trim(), day, building }),
    [debouncedQ, day, building, version]
  );

  async function remove(c) {
    if (!window.confirm(`Delete ${c.course_code} (${c.course_name})?`)) return;
    setDeleteError(null);
    try {
      await api.deleteClass(c.id);
      onChanged();
    } catch (e) {
      setDeleteError(e.message);
    }
  }

  return (
    <section>
      <div className="filters">
        <input
          type="search"
          placeholder="Search course code, name or instructor…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search classes"
        />
        <select value={day} onChange={(e) => setDay(e.target.value)} aria-label="Day">
          <option value="">Any day</option>
          {DAYS.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
        <select value={building} onChange={(e) => setBuilding(e.target.value)} aria-label="Building">
          <option value="">Any building</option>
          {buildings.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </div>

      {deleteError && <Status error={deleteError} />}
      <Status
        loading={loading && !data}
        error={error}
        empty={data && data.length === 0 && "No classes match your search."}
        action={
          (q || day || building) && (
            <button
              className="btn"
              onClick={() => {
                setQ("");
                setDay("");
                setBuilding("");
              }}
            >
              Clear filters
            </button>
          )
        }
      />

      {data && data.length > 0 && (
        <div className={loading ? "table-wrap dim" : "table-wrap"}>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Instructor</th>
                <th>Room</th>
                <th>Days</th>
                <th>Time</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td data-label="Course">
                    <div className="code">{c.course_code}</div>
                    <div className="muted">{c.course_name}</div>
                  </td>
                  <td data-label="Instructor">{c.instructor}</td>
                  <td data-label="Room">
                    <span className="badge">{c.room}</span>
                    <div className="muted">{c.building}</div>
                  </td>
                  <td data-label="Days">
                    <div className="chips">
                      {c.days.map((d) => (
                        <span key={d} className="chip">{d}</span>
                      ))}
                    </div>
                  </td>
                  <td data-label="Time" className="time">{fmtRange(c.start_time, c.end_time)}</td>
                  <td className="actions">
                    <button
                      className="btn danger small"
                      onClick={() => remove(c)}
                      aria-label={`Delete ${c.course_code}`}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
