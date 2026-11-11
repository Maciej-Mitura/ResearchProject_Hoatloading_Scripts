export function StatusBadge({
  connected,
  label,
}: {
  connected: boolean;
  label: string;
}) {
  return <Badge label={label} tone={connected ? "success" : "neutral"} />;
}

export function Badge({
  label,
  tone,
}: {
  label: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const name = label.toLowerCase();
  const semantic =
    tone ??
    (["completed", "complete", "observed"].includes(name)
      ? "success"
      : ["failed", "blocked", "high"].includes(name)
        ? "danger"
        : ["review", "partial", "terminated"].includes(name)
          ? "warning"
          : ["running", "analysing", "inferred"].includes(name)
            ? "info"
            : "neutral");
  const symbol =
    semantic === "success"
      ? "✓"
      : semantic === "danger"
        ? "×"
        : semantic === "warning"
          ? "!"
          : semantic === "info"
            ? "•"
            : "–";
  return (
    <span className={`badge badge-${semantic}`}>
      <span aria-hidden="true">{symbol}</span>
      {label.replaceAll("_", " ")}
    </span>
  );
}
