// HOL-006: Output near but below typical truncation threshold (~1 MiB).
// ~200 KiB of digits — should complete without truncation on default 1 MiB limit.
const chunk = "0123456789".repeat(2000); // 20_000 chars
for (let i = 0; i < 10; i++) {
  console.log(chunk);
}
console.log("near-truncation-done");
