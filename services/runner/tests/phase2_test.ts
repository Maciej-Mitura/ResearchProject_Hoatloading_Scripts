import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Admission, CapacityError, admission } from "../src/admission.ts";
import { deadline } from "../../../packages/contracts/src/deadline.ts";
import { executeSandbox, type SandboxDependencies } from "../src/docker.ts";

Deno.test("capacity bounds starts, rejects overflow and releases on all outcomes", async () => {
  const a = new Admission(2); let release!: () => void;
  const pending = new Promise<void>((r) => release = r);
  const first = a.run("a", () => pending); const second = a.run("b", () => pending);
  assertEquals(a.snapshot().active, 2);
  await assertRejects(() => a.run("c", async () => {}), CapacityError);
  release(); await Promise.all([first, second]);
  for (const message of ["script_failure", "timeout", "docker_failure", "gateway_failure"]) {
    await assertRejects(() => a.run(message, async () => { throw new Error(message); }));
    assertEquals(a.snapshot().active, 0);
  }
  await a.run("next", async () => {});
});
Deno.test("deadline terminates a stalled dependency wait", async () => {
  await assertRejects(() => deadline(5, "docker_operation_timeout", () => new Promise(() => {})), Error, "docker_operation_timeout");
});

function fixture(failure: string) {
  const calls: string[] = [];
  const output = (text: string, success = true) => ({ code: success ? 0 : 1, success, signal: null, stdout: new TextEncoder().encode(text), stderr: new Uint8Array() });
  const stream = () => new ReadableStream<Uint8Array>({ start(c) { c.close(); } });
  const dependencies: SandboxDependencies = {
    createSession: async () => { calls.push("session"); if (failure === "session") throw new Error("injected"); return { token: "private-test-token", expiresAt: "", capabilities: ["chat.broadcast"] }; },
    revokeSession: async () => { calls.push("revoke"); if (failure === "revoke") throw new Error("injected"); return []; },
    command: async (args) => {
      calls.push(args[0]); if (failure === "create_stall" && args[0] === "create") return await new Promise<never>(()=>{}); if (failure === "create" && args[0] === "create") throw new Error("injected");
      if (failure === "cleanup" && (args[0] === "rm" || args[0] === "inspect" && args.length === 2)) throw new Error("injected cleanup failure");
      return output(args.includes("{{.State.Running}}") ? "true" : "false");
    },
    spawn: () => {
      calls.push("start"); if (failure === "start") throw new Error("injected");
      return { stdin: new WritableStream({ write() { if (failure === "source") throw new Error("injected"); } }), stdout: stream(), stderr: stream(),
        status: failure === "timeout" ? new Promise(() => {}) : failure === "wait" ? Promise.reject(new Error("injected")) : Promise.resolve({ code: 0, success: true, signal: null }),
        kill() { calls.push("kill"); },
      } as unknown as Deno.ChildProcess;
    }, timeoutMs: 5,
  };
  return { calls, dependencies };
}
for (const failure of ["session", "create_stall", "create", "source", "start", "wait", "timeout", "audit", "revoke", "cleanup"]) {
  Deno.test(`failure matrix: ${failure}`, async () => {
    const { calls, dependencies } = fixture(failure);
    const a = new Admission(1);
    const result = await a.run("test", () => executeSandbox({ executionId: "test", language: "javascript", source: "", permissionProfile: "host-chat" }, dependencies));
    const evidencePath = Deno.env.get("PHASE2_EVIDENCE_PATH");
    if (evidencePath) {
      Deno.mkdirSync(evidencePath, { recursive: true });
      Deno.writeTextFileSync(`${evidencePath}/${failure}.json`, JSON.stringify({ stage: failure, calls, result, admission: a.snapshot() }, null, 2));
    }
    assertEquals(a.snapshot().active, 0);
    if (failure !== "session") { assertEquals(calls.includes("revoke"), true); assertEquals(calls.includes("rm"), true); }
    assertEquals(result.auditCollection.status === "complete", false);
    if (failure === "timeout") assertEquals(result.timedOut, true);
    else if (failure === "cleanup") { assertEquals(result.cleanupErrors.includes("container_removal_unconfirmed"), true); assertEquals(admission.blocked, true); admission.blocked = false; }
    else if (failure === "revoke") { assertEquals(result.exitCode, 0); assertEquals(result.cleanupErrors.length, 1); }
    else if (failure !== "audit") assertEquals(Boolean(result.error), true);
    if (failure === "create_stall") { assertEquals(result.failureCategory,"docker_operation_timeout"); assertEquals(admission.blocked,true); admission.blocked=false; }
  });
}
