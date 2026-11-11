import { parseProject } from "./script-project.ts";
// Trusted pre-execution process. Never import or execute a generated module here.
const input = await new Response(Deno.stdin.readable).text();
if (new TextEncoder().encode(input).length > 4 * 1024 * 1024) {
  throw new Error("Project envelope too large");
}
const project = parseProject(JSON.parse(input));
await Deno.mkdir("/workspace/project", { recursive: true });
for (const file of project.files) {
  const path = "/workspace/project/" + file.path;
  await Deno.mkdir(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  await Deno.writeTextFile(path, file.content, { createNew: true });
}
console.log("/workspace/project/" + project.entrypoint);
