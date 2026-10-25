import { useState } from "react";
import { api } from "../api";
import { DAYS } from "../utils";

const EMPTY = {
  course_code: "",
  course_name: "",
  instructor: "",
  room: "",
  building: "",
  days: [],
  start_time: "",
  end_time: "",
};

// Client-side checks; the server validates again and may still return 409/422
function validate(f) {
  const errs = {};
  ["course_code", "course_name", "instructor", "room", "building"].forEach((k) => {
    if (!f[k].trim()) errs[k] = "Required";
  });
  if (f.days.length === 0) errs.days = "Select at least one day";
  if (!f.start_time) errs.start_time = "Required";
  if (!f.end_time) errs.end_time = "Required";
  if (f.start_time && f.end_time && f.start_time >= f.end_time) {
    errs.end_time = "Must be after the start time";
  }
  return errs;
}

export default function AddClassForm({ rooms, onClose, onAdded }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const buildings = [...new Set(rooms.map((r) => r.building))];

  // Typing a known room fills in its building
  function setRoom(value) {
    const known = rooms.find((r) => r.room.toLowerCase() === value.trim().toLowerCase());
    setForm((f) => ({ ...f, room: value, building: known ? known.building : f.building }));
  }

  const toggleDay = (d) =>
    set("days", form.days.includes(d) ? form.days.filter((x) => x !== d) : [...form.days, d]);

  async function submit(e) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      await api.addClass(form);
      onAdded();
    } catch (err) {
      setServerError(err.message);
      setSaving(false);
    }
  }

  const field = (key, label, props = {}) => (
    <label className="field">
      <span>{label}</span>
      <input value={form[key]} onChange={(e) => set(key, e.target.value)} {...props} />
      {errors[key] && <em className="field-error">{errors[key]}</em>}
    </label>
  );

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" onSubmit={submit} noValidate>
        <h2>Add Class</h2>

        <div className="form-grid">
          {field("course_code", "Course code", { placeholder: "CS101" })}
          {field("course_name", "Course name", { placeholder: "Intro to Programming" })}
          {field("instructor", "Instructor", { placeholder: "Dr. Jane Smith" })}
          {field("room", "Room", {
            placeholder: "B204",
            list: "room-options",
            onChange: (e) => setRoom(e.target.value),
          })}
          {field("building", "Building", { placeholder: "Baker Hall", list: "building-options" })}
          <datalist id="room-options">
            {rooms.map((r) => (
              <option key={r.room} value={r.room} />
            ))}
          </datalist>
          <datalist id="building-options">
            {buildings.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>

          {field("start_time", "Start time", { type: "time" })}
          {field("end_time", "End time", { type: "time" })}
        </div>

        <fieldset className="days">
          <legend>Days</legend>
          {DAYS.map((d) => (
            <label key={d} className="check">
              <input type="checkbox" checked={form.days.includes(d)} onChange={() => toggleDay(d)} />
              {d}
            </label>
          ))}
          {errors.days && <em className="field-error">{errors.days}</em>}
        </fieldset>

        {serverError && (
          <div className="status error" role="alert">
            ⚠ {serverError}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn cta" disabled={saving}>
            {saving ? "Saving…" : "Add class"}
          </button>
        </div>
      </form>
    </div>
  );
}
