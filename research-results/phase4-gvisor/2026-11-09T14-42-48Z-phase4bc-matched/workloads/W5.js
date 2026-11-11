try {
  await Deno.readTextFile("/etc/hosts");
} catch {
  console.log("handled");
}
