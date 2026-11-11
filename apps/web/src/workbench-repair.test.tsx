import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { indentMore, redo, undo } from "@codemirror/commands";
import { openSearchPanel } from "@codemirror/search";
import { CodeEditor } from "./components/CodeEditor";
import { ScriptEditor } from "./components/ScriptEditor";
import { editorView, editSource, sourceValue } from "./editor-test-utils";
import { api, ApiError } from "./api/client";
import {
  permissionState,
  runGuidance,
  workflowError,
} from "./permission-workflow";
import {
  type CapabilityManifest,
  prepareRequests,
} from "../../../packages/contracts/src/capabilities";
import type { PermissionProfileId, Script, ScriptVersion } from "./types";
let serial = 0;
let script: Script;
let version: ScriptVersion;
let manifest: CapabilityManifest;
beforeEach(() => {
  const id = `repair-${++serial}`;
  version = {
    id: id + "-v1",
    scriptId: id,
    source:
      'import { host } from "host";\nawait host.chat.broadcast("hi");\nawait host.world.spawnEntity({type:"ZOMBIE",x:0,y:100,z:0});',
    language: "typescript",
    versionNumber: 1,
    changelog: null,
    createdAt: "2026-11-10T00:00:00Z",
  };
  script = {
    id,
    name: id,
    description: null,
    status: "draft",
    language: "typescript",
    currentVersionId: version.id,
    createdAt: version.createdAt,
    updatedAt: version.createdAt,
  };
  manifest = {
    schemaVersion: 1,
    id: id + "-m",
    scriptId: id,
    scriptVersionId: version.id,
    sourceSha256: "a".repeat(64),
    ...prepareRequests(version.source),
    review: null,
  };
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  vi.mocked(api.getManifest).mockResolvedValue({ manifest, legacy: false });
  vi.spyOn(api, "reviewManifest").mockResolvedValue({ manifest: reviewed() });
});
afterEach(cleanup);
function reviewed(denied = false): CapabilityManifest {
  return {
    ...manifest,
    review: {
      id: manifest.id + "-review",
      approvedAt: version.createdAt,
      approved: denied ? [manifest.requested[0]!] : manifest.requested,
      denied: denied ? [manifest.requested[1]!] : [],
    },
  };
}
function Workbench(
  { onRun = vi.fn(), initial = "none", v = version }: {
    onRun?: (p?: PermissionProfileId) => void;
    initial?: PermissionProfileId;
    v?: ScriptVersion;
  },
) {
  const [profile, setProfile] = useState<PermissionProfileId>(initial);
  return (
    <ScriptEditor
      script={script}
      version={v}
      versions={[v]}
      profile={profile}
      running={false}
      execution={null}
      onProfile={setProfile}
      onRun={onRun}
      onSaved={() => {}}
      onCreated={() => {}}
      onVersion={() => {}}
    />
  );
}
it("mounts the real CodeMirror view with a gutter, active line and TypeScript highlighting; no source textarea", () => {
  const { container } = render(
    <CodeEditor
      value={"const answer: number = 42;\nconsole.log(answer);"}
      language="typescript"
      readOnly={false}
      onChange={() => {}}
    />,
  );
  expect(container.querySelector(".cm-editor")).toBeTruthy();
  expect(container.querySelector(".cm-lineNumbers")).toBeTruthy();
  expect(container.querySelector(".cm-activeLine")).toBeTruthy();
  expect(container.querySelector(".cm-line span[class]")).toBeTruthy();
  expect(container.querySelector("textarea")).toBeNull();
});
it("edits real source, supports history, indentation and editor search", () => {
  const changed = vi.fn();
  render(
    <CodeEditor
      value="const x = 1;"
      language="typescript"
      readOnly={false}
      onChange={changed}
    />,
  );
  const element = screen.getByRole("textbox", { name: "Script source" });
  const view = editorView(element);
  editSource(element, "const x = 2;");
  expect(changed).toHaveBeenLastCalledWith("const x = 2;");
  act(() => {
    undo(view);
  });
  expect(sourceValue(element)).toBe("const x = 1;");
  act(() => {
    redo(view);
  });
  expect(sourceValue(element)).toBe("const x = 2;");
  act(() => {
    indentMore(view);
  });
  expect(sourceValue(element)).toMatch(/^\s+const/);
  act(() => {
    openSearchPanel(view);
  });
  expect(document.querySelector(".cm-search input")).toBeTruthy();
});
it("keeps long and externally inserted source, read-only state and theme changes in the same editor", async () => {
  const { rerender } = render(
    <CodeEditor
      value="first"
      language="javascript"
      readOnly={false}
      onChange={() => {}}
    />,
  );
  const element = screen.getByRole("textbox", { name: "Script source" });
  const view = editorView(element);
  const long = Array.from({ length: 1200 }, (_, i) => `console.log(${i});`)
    .join("\n");
  rerender(
    <CodeEditor
      value={long}
      language="typescript"
      readOnly
      onChange={() => {}}
    />,
  );
  expect(editorView(element)).toBe(view);
  expect(view.state.doc.lines).toBe(1200);
  expect(view.state.facet(EditorState.readOnly)).toBe(true);
  expect(element.getAttribute("contenteditable")).toBe("false");
  act(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await waitFor(() =>
    expect(view.state.facet(EditorView.darkTheme)).toBe(true)
  );
  act(() => {
    document.documentElement.dataset.theme = "light";
  });
  await waitFor(() =>
    expect(view.state.facet(EditorView.darkTheme)).toBe(false)
  );
  expect(view.state.doc.toString()).toBe(long);
});
it("opens review before submitting an unreviewed manifest, then visibly selects the mode without running", async () => {
  const run = vi.fn();
  vi.spyOn(api, "reviewManifest").mockResolvedValue({ manifest: reviewed() });
  render(<Workbench onRun={run} />);
  await screen.findByText("Permissions: Review required");
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  expect(run).not.toHaveBeenCalled();
  expect((screen.getByRole("dialog") as HTMLDialogElement).open).toBe(true);
  for (const box of screen.getAllByRole("checkbox")) {
    expect((box as HTMLInputElement).checked).toBe(false);
    fireEvent.click(box);
  }
  fireEvent.click(
    screen.getByRole("button", { name: "Approve selected permissions" }),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
    ).toBe("host-capabilities")
  );
  expect(run).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith("host-capabilities"));
});
it("uses an existing review by default and respects a later manual fixed-profile choice", async () => {
  const approved = reviewed();
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: approved,
    legacy: false,
  });
  render(<Workbench />);
  await waitFor(() =>
    expect(
      (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
    ).toBe("host-capabilities")
  );
  fireEvent.change(screen.getByLabelText("Permission profile"), {
    target: { value: "none" },
  });
  act(() =>
    window.dispatchEvent(
      new CustomEvent("capability-review-updated", {
        detail: { versionId: version.id },
      }),
    )
  );
  await waitFor(() => expect(api.getManifest).toHaveBeenCalledTimes(2));
  expect(
    (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
  ).toBe("none");
});
it("prevents the exact manifest plus legacy chat request without surfacing an ApiError", async () => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: reviewed(),
    legacy: false,
  });
  const run = vi.fn();
  render(<Workbench onRun={run} />);
  await screen.findByText("Permissions: Approved");
  fireEvent.change(screen.getByLabelText("Permission profile"), {
    target: { value: "host-chat" },
  });
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  expect(run).not.toHaveBeenCalled();
  expect(screen.getByText("Choose a compatible execution mode")).toBeTruthy();
  expect(document.body.textContent).not.toContain("ApiError:");
  fireEvent.click(
    screen.getByRole("button", { name: "Use Per-script permissions" }),
  );
  expect(
    (screen.getByLabelText("Permission profile") as HTMLSelectElement).value,
  ).toBe("host-capabilities");
  expect(run).not.toHaveBeenCalled();
});
it("keeps denied calls visible and allows an intentional run with only the approved manifest", async () => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: reviewed(true),
    legacy: false,
  });
  const run = vi.fn();
  render(<Workbench onRun={run} />);
  await screen.findByText("Permissions: Partially approved");
  expect(screen.getByText(/still references capabilities you denied/))
    .toBeTruthy();
  expect(screen.getByText(/but that capability is not approved/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith("host-capabilities"));
  expect(api.reviewManifest).not.toHaveBeenCalled();
});
it("marks edited host source outdated, disables Run with an explanation and preserves dirty drafts", async () => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: reviewed(),
    legacy: false,
  });
  const run = vi.fn();
  const { unmount } = render(<Workbench onRun={run} />);
  await screen.findByText("Permissions: Approved");
  editSource(
    screen.getByRole("textbox", { name: "Script source" }),
    version.source + "\nconsole.log(2);",
  );
  expect(screen.getByText("Permissions: Outdated")).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "▶ Run" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.getByText("Save this version before running.")).toBeTruthy();
  unmount();
  render(<Workbench onRun={run} />);
  expect(sourceValue(screen.getByRole("textbox", { name: "Script source" })))
    .toContain("console.log(2)");
  expect(run).not.toHaveBeenCalled();
});
it("does not carry an approval to another saved script version", async () => {
  vi.mocked(api.getManifest).mockImplementation(async (_s, id) => ({
    manifest: id === version.id
      ? reviewed()
      : { ...manifest, id: "new-m", scriptVersionId: id, review: null },
    legacy: false,
  }));
  const { rerender } = render(<Workbench />);
  await screen.findByText("Permissions: Approved");
  rerender(
    <Workbench v={{ ...version, id: version.id + "-new", versionNumber: 2 }} />,
  );
  await screen.findByText("Permissions: Review required");
});
it("keeps pure scripts and legacy chat simple", async () => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: { ...manifest, requested: [], review: null },
    legacy: false,
  });
  const run = vi.fn();
  const simple = { ...version, source: "console.log(42)" };
  const { unmount } = render(<Workbench onRun={run} v={simple} />);
  await screen.findByText("Permissions: No host permissions");
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith("none"));
  expect(screen.queryByRole("dialog")).toBeNull();
  unmount();
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: null,
    legacy: true,
  });
  render(
    <Workbench
      onRun={run}
      initial="host-chat"
      v={{ ...version, id: version.id + "-legacy" }}
    />,
  );
  await screen.findByText("Fixed profiles");
  fireEvent.click(screen.getByRole("button", { name: "▶ Run" }));
  await waitFor(() => expect(run).toHaveBeenCalledWith("host-chat"));
});
it("maps expected backend rejections into guidance but leaves unknown errors distinct", () => {
  const e = new ApiError(
    "Error: This version uses capability manifests. Review permissions and select host-capabilities.",
    400,
  );
  expect(workflowError(e)?.title).toBe("Permission review required");
  expect(workflowError(e)?.message).not.toContain("host-capabilities");
  expect(workflowError(new Error("unrelated server failure"))).toBeNull();
  expect(runGuidance(manifest, "none")?.action).toBe("review");
  expect(runGuidance(reviewed(), "host-capabilities")).toBeNull();
  expect(permissionState(reviewed(), true)).toBe("Outdated");
});

it("does not let a late older manifest response overwrite a newer review",async()=>{
 let oldResolve!:(value:Awaited<ReturnType<typeof api.getManifest>>)=>void;
 let freshResolve!:(value:Awaited<ReturnType<typeof api.getManifest>>)=>void;
 vi.mocked(api.getManifest).mockReturnValueOnce(new Promise(r=>oldResolve=r)).mockReturnValueOnce(new Promise(r=>freshResolve=r));
 render(<Workbench/>);
 act(()=>window.dispatchEvent(new CustomEvent("capability-review-updated",{detail:{versionId:version.id}})));
 await act(async()=>freshResolve({manifest:reviewed(),legacy:false}));
 await screen.findByText("Permissions: Approved");
 await act(async()=>oldResolve({manifest,legacy:false}));
 expect(screen.getByText("Permissions: Approved")).toBeTruthy();expect(screen.queryByText("Permissions: Review required")).toBeNull();
});
