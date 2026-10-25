import { useState } from "react";
import { api } from "./api";
import { useAsync } from "./hooks";
import FindClass from "./components/FindClass";
import FreeRooms from "./components/FreeRooms";
import RoomSchedule from "./components/RoomSchedule";
import AddClassForm from "./components/AddClassForm";
import { Status } from "./components/Status";

const TABS = [
  { id: "find", label: "Find a Class" },
  { id: "free", label: "Free Rooms" },
  { id: "room", label: "Room Schedule" },
];

export default function App() {
  const [tab, setTab] = useState("find");
  const [showForm, setShowForm] = useState(false);
  // Bumped after any add/delete so the active tab and room list reload
  const [version, setVersion] = useState(0);
  const changed = () => setVersion((v) => v + 1);

  const rooms = useAsync(() => api.rooms(), [version]);

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true">
            {/* calendar icon */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
          </div>
          <div>
            <h1>Class Schedule &amp; Room Finder</h1>
            <p>Find any class, and any free room, in seconds</p>
          </div>
        </div>
        <button className="btn cta" onClick={() => setShowForm(true)}>
          + Add Class
        </button>
      </header>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            aria-current={tab === t.id ? "page" : undefined}
            className={tab === t.id ? "tab active" : "tab"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {rooms.error ? (
          <Status error={rooms.error} />
        ) : !rooms.data ? (
          <Status loading />
        ) : (
          <>
            {tab === "find" && <FindClass rooms={rooms.data} version={version} onChanged={changed} />}
            {tab === "free" && <FreeRooms version={version} />}
            {tab === "room" && <RoomSchedule rooms={rooms.data} version={version} />}
          </>
        )}
      </main>

      {showForm && rooms.data && (
        <AddClassForm
          rooms={rooms.data}
          onClose={() => setShowForm(false)}
          onAdded={() => {
            setShowForm(false);
            changed();
          }}
        />
      )}
    </div>
  );
}
