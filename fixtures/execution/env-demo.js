// Experiment: env-demo profile grants only SANDBOX_DEMO_VALUE.
console.log(Deno.env.get("SANDBOX_DEMO_VALUE"));
try {
  console.log(Deno.env.get("HOME"));
} catch {
  console.log("HOME unavailable");
}
