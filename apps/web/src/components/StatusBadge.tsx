export function StatusBadge({
  connected,
  label,
}: {
  connected: boolean;
  label: string;
}) {
  return (
    <span className="header-meta" style={{ gap: "0.4rem" }}>
      <span className={`status-dot ${connected ? "ok" : "warn"}`} aria-hidden />
      <span>{label}</span>
    </span>
  );
}
