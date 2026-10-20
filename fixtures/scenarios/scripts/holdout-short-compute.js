// HOL-007: Computation finishes well under wall-clock timeout.
let n = 0;
for (let i = 0; i < 50_000; i++) n += i % 7;
console.log("sum", n);
