// HOL-002: Caught ENV access under none (variant of caught filesystem read).
try {
  console.log(Deno.env.get("HOME"));
} catch (err) {
  console.log("caught-env", String(err).slice(0, 80));
}
console.log("done");
