// Flood stdout quickly to hit the output byte limit before wall-clock timeout.
const chunk = "x".repeat(4096);
for (let i = 0; i < 400; i++) {
  console.log(chunk);
}
console.log("done");
