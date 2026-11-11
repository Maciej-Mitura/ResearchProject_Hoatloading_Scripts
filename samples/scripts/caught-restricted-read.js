// Profile: none. A caught denial can still leave permission observations.
try {
  await Deno.readTextFile("/etc/hosts");
} catch {
  console.log("Read was blocked, but the script continued");
}
