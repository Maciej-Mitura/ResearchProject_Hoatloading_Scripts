// HOL-008: Caught denied subprocess attempt under none.
try {
  const cmd = new Deno.Command("echo", { args: ["holdout"] });
  const out = await cmd.output();
  console.log("unexpected-ok", out.code);
} catch (err) {
  console.log("caught-run", String(err).slice(0, 100));
}
console.log("done");
