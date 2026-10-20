import { host } from "host";

// Exceed per-execution chat.broadcast budget (default 5).
for (let i = 0; i < 6; i++) {
  try {
    const r = await host.chat.broadcast(`budget probe ${i}`);
    console.log(JSON.stringify(r));
  } catch (err) {
    console.log(`call ${i} error: ${err}`);
  }
}
