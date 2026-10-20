// Experiment: in-scope read succeeds; outside-scope read fails but remains auditable.
const allowed = await Deno.readTextFile("/fixtures/allowed.txt");
console.log(allowed);
try {
  await Deno.readTextFile("/etc/hosts");
} catch {
  console.log("outside scope denied");
}
