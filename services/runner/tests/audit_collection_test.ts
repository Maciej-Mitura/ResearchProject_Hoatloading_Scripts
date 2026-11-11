import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { splitFramedStdout } from "../src/frames.ts";
import { parsePermissionAuditJsonl } from "../src/permissions.ts";
import { collectAuditStatus } from "../src/audit-collection.ts";

function collect(
  text: string,
  flags: {
    timedOut?: boolean;
    outputTruncated?: boolean;
    infrastructureFailure?: boolean;
  } = {},
) {
  const frames = splitFramedStdout(text, "marker");
  const audit = parsePermissionAuditJsonl(frames.auditJsonl);
  return {
    audit,
    collection: collectAuditStatus({
      frame: frames.auditFrame,
      timedOut: false,
      outputTruncated: false,
      auditTruncated: audit.truncated,
      malformedCount: audit.malformedCount,
      ...flags,
    }),
  };
}
const frame = (body: string) =>
  `hello\nmarker:AUDIT_BEGIN\n${body}\nmarker:AUDIT_END\nmarker:RUNTIME_BEGIN\ndeno 2.9.7\nmarker:RUNTIME_END\n`;
Deno.test("harmless run has positively complete empty collection", () => {
  const r = collect(frame(""));
  assertEquals(r.audit.events.length, 0);
  assertEquals(r.collection.status, "complete");
});
Deno.test("caught read observation is retained with complete collection", () => {
  const r = collect(frame('{"permission":"read","value":"/etc/hosts"}'));
  assertEquals(r.audit.events[0].target, "/etc/hosts");
  assertEquals(r.collection.status, "complete");
});
Deno.test("timeout, capture loss and infrastructure failure never claim complete", () => {
  assertEquals(
    collect("", { timedOut: true }).collection.status,
    "unavailable",
  );
  assertEquals(
    collect(frame(""), { timedOut: true }).collection.status,
    "partial",
  );
  assertEquals(
    collect(frame(""), { outputTruncated: true }).collection.status,
    "partial",
  );
  assertEquals(
    collect("large output", { outputTruncated: true }).collection.status,
    "unavailable",
  );
  assertEquals(
    collect("", { infrastructureFailure: true }).collection.status,
    "unavailable",
  );
});
Deno.test("missing/malformed frames, duplicate frames and malformed JSON are explicit", () => {
  assertEquals(collect("hello").collection.reasons, ["missing_audit_frame"]);
  assertEquals(collect("marker:AUDIT_BEGIN\n{}").collection.status, "partial");
  assertEquals(collect(frame("") + frame("")).collection.status, "partial");
  assertEquals(collect(frame("{bad-json}")).collection.reasons, [
    "malformed_audit_records",
  ]);
});
