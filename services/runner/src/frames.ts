/**
 * Split trusted sandbox stdout framing from untrusted script stdout.
 * Frames are emitted by the trusted entrypoint after Deno exits.
 */

export interface SplitStdoutResult {
  scriptStdout: string;
  auditJsonl: string;
  runtimeVersionText: string;
}

export function splitFramedStdout(
  stdout: string,
  marker: string,
): SplitStdoutResult {
  const auditBegin = `${marker}:AUDIT_BEGIN`;
  const auditEnd = `${marker}:AUDIT_END`;
  const runtimeBegin = `${marker}:RUNTIME_BEGIN`;
  const runtimeEnd = `${marker}:RUNTIME_END`;

  const auditStart = stdout.indexOf(auditBegin);
  if (auditStart === -1) {
    return { scriptStdout: stdout, auditJsonl: "", runtimeVersionText: "" };
  }

  const scriptStdout = stdout.slice(0, auditStart);
  const afterAuditBegin = stdout.slice(auditStart + auditBegin.length);
  // Drop leading newline after begin marker
  const auditBodyStart = afterAuditBegin.startsWith("\n")
    ? afterAuditBegin.slice(1)
    : afterAuditBegin;
  const auditEndIdx = auditBodyStart.indexOf(auditEnd);
  let auditJsonl = "";
  let rest = auditBodyStart;
  if (auditEndIdx !== -1) {
    auditJsonl = auditBodyStart.slice(0, auditEndIdx);
    rest = auditBodyStart.slice(auditEndIdx + auditEnd.length);
  }

  let runtimeVersionText = "";
  const rtBeginIdx = rest.indexOf(runtimeBegin);
  if (rtBeginIdx !== -1) {
    let rtBody = rest.slice(rtBeginIdx + runtimeBegin.length);
    if (rtBody.startsWith("\n")) rtBody = rtBody.slice(1);
    const rtEndIdx = rtBody.indexOf(runtimeEnd);
    runtimeVersionText = rtEndIdx === -1 ? rtBody : rtBody.slice(0, rtEndIdx);
  }

  return {
    scriptStdout,
    auditJsonl,
    runtimeVersionText: runtimeVersionText.trim(),
  };
}

export function newFrameMarker(): string {
  // Unpredictable to untrusted scripts without env permission.
  return `poc-${crypto.randomUUID().replaceAll("-", "")}`;
}
