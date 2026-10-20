// Experiment: scoped read of baked-in /fixtures/allowed.txt
const value = await Deno.readTextFile("/fixtures/allowed.txt");
console.log(value);
