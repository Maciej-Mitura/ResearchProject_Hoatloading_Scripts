import type { Execution, SecurityEvent } from "../types";
import { downloadJson } from "./CapabilityPermissions";
const explanations: Record<string, string> = {
  CAPABILITY_NOT_APPROVED:
    "This capability was not approved for this script version.",
  CAPABILITY_QUOTA_EXCEEDED: "This run reached its approved call limit.",
  CAPABILITY_ARGUMENT_NOT_ALLOWED:
    "The arguments exceed the approved or registered constraints.",
  CAPABILITY_NOT_SUPPORTED: "This project does not expose that capability.",
  CAPABILITY_EXECUTION_MISMATCH:
    "The credential belongs to a different execution.",
  CAPABILITY_PLAYER_OFFLINE: "The target player is offline.",
  CAPABILITY_LOCATION_NOT_ALLOWED:
    "The location is outside the configured demo area.",
  CAPABILITY_CHUNK_NOT_LOADED: "The target chunk is not loaded.",
  CAPABILITY_HOST_UNAVAILABLE: "The host could not confirm this request.",
};
export function ExecutionCapabilities(
  { execution, events }: { execution: Execution; events: SecurityEvent[] },
) {
  const a = execution.result?.manifest?.capabilityAuthority;
  if (!a) return null;
  const calls = events.filter((e) =>
    e.executionId === execution.id &&
    (e.eventType.startsWith("host_api.") ||
      e.eventType === "host.command.result")
  );
  return (
    <section
      className="capability-summary"
      aria-label="Execution capability usage"
    >
      <h3>Capability usage</h3>
      <p>
        Paper results record confirmed host effects separately from process completion.
      </p>
      <p>
        {a.requested.length} requested · {a.review?.approved.length ?? 0}{" "}
        approved · {a.review?.denied.length ?? 0} denied
      </p>
      <button
        className="btn btn-small"
        onClick={() =>
          downloadJson({
            extension: "post-research-capability-manifests",
            executionId: execution.id,
            manifest: a,
            actualCalls: calls,
          }, `execution-capabilities-${execution.id}.json`)}
      >
        Export capability evidence JSON
      </button>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Approval</th>
              <th>Requested calls</th>
              <th>Allowed</th>
              <th>Denied</th>
              <th>Paper results</th>
            </tr>
          </thead>
          <tbody>
            {[
              ...new Set([
                ...a.requested.map((r) => r.capability),
                ...calls.map((e) => String(e.metadata?.capability ?? "")),
              ]),
            ].filter(Boolean).map((id) => {
              const es = calls.filter((e) => e.metadata?.capability === id);
              return (
                <tr key={id}>
                  <td>
                    <code>{id}</code>
                  </td>
                  <td>
                    {a.review?.approved.some((r) => r.capability === id)
                      ? "Approved"
                      : "Not approved"}
                  </td>
                  <td>
                    {es.filter((e) => e.eventType === "host_api.requested")
                      .length}
                  </td>
                  <td>
                    {es.filter((e) => e.eventType === "host_api.allowed")
                      .length}
                  </td>
                  <td>
                    {es.filter((e) => e.eventType === "host_api.denied").length}
                  </td>
                  <td>
                    {es.filter((e) =>
                      e.eventType === "host.command.result" &&
                      e.metadata?.success === true
                    ).length} successful / {es.filter((e) =>
                      e.eventType === "host.command.result" &&
                      e.metadata?.success === false
                    ).length} failed
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {calls.filter((e) =>
        e.eventType === "host_api.denied" || e.metadata?.success === false
      ).map((e) => {
        const code = String(
          e.metadata?.reason ?? e.metadata?.resultMessage ?? "",
        );
        return (
          <p key={e.id}>
            <strong>{String(e.metadata?.capability ?? "Capability")}</strong>:
            {" "}
            {explanations[code] ??
              "The host capability request could not complete."}{" "}
            <small>{new Date(e.createdAt).toLocaleString()} · {code}</small>
          </p>
        );
      })}
    </section>
  );
}
