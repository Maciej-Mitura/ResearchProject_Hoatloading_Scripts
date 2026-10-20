// HOL-009: Multiple different permission accesses in one completed execution.
try {
  await Deno.readTextFile("/etc/hosts");
} catch (e1) {
  console.log("read-denied", String(e1).slice(0, 40));
}
try {
  Deno.env.get("PATH");
} catch (e2) {
  console.log("env-denied", String(e2).slice(0, 40));
}
console.log("multi-done");
