// Only the allowed demo env var — no HOME probe (that is SCN-008).
console.log(Deno.env.get("SANDBOX_DEMO_VALUE"));
