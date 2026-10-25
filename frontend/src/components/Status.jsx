// Shared loading / error / empty indicators. `action` is an optional button for empty states.
export function Status({ loading, error, empty, action }) {
  if (error) return <div className="status error" role="alert">⚠ {error}</div>;
  if (loading) return <div className="status" role="status">Loading…</div>;
  if (empty) {
    return (
      <div className="empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span>{empty}</span>
        {action}
      </div>
    );
  }
  return null;
}
