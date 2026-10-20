// HOL-003: Allowed fixture read then unrelated denied ENV access (caught).
const text = await Deno.readTextFile("/fixtures/allowed.txt");
console.log("fixture", text.trim());
try {
  console.log("env", Deno.env.get("HOME"));
} catch (err) {
  console.log("env-denied", String(err).slice(0, 60));
}
console.log("done");
