const cmd = new Deno.Command("echo", { args: ["hello"] });
const out = await cmd.output();
console.log(new TextDecoder().decode(out.stdout));
