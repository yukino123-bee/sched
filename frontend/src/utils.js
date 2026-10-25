export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

// "13:05" -> "1:05 PM"
export function fmt12(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const fmtRange = (start, end) => `${fmt12(start)} – ${fmt12(end)}`;

export const toMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

// Current weekday (Mon-Fri; weekends fall back to Mon) and time as "HH:MM"
export function now() {
  const d = new Date();
  const day = DAYS[d.getDay() - 1] || "Mon";
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return { day, time };
}
