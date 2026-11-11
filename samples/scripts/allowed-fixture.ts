// Profile: read-fixture. Only the baked-in fixture directory is granted.
console.log(await Deno.readTextFile("/fixtures/allowed.txt"));
