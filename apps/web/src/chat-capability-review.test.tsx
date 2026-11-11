import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ChatCapabilityReview } from "./components/ChatCapabilityReview";
import { CapabilityPermissions } from "./components/CapabilityPermissions";
import { api } from "./api/client";
import type { ScriptProposal } from "./types";
import { prepareRequests } from "../../../packages/contracts/src/capabilities";
vi.mock(
  "./api/client",
  () => ({
    api: {
      getManifest: vi.fn(),
      reviewManifest: vi.fn(),
      listScripts: vi.fn(),
      getScript: vi.fn(),
    },
  }),
);
const proposal: ScriptProposal = {
  name: "Composition",
  description: "Demo",
  language: "typescript",
  source: 'host.chat.broadcast("hi");host.world.spawnEntity({});',
  requestedCapabilities: [
    {
      capability: "chat.broadcast",
      required: true,
      reason: "Announce the event",
      constraints: { maxCalls: 1 },
    },
    {
      capability: "world.spawnEntity",
      required: true,
      reason: "Spawn a demonstration zombie",
      constraints: { maxCalls: 3, entityTypes: ["ZOMBIE"] },
    },
  ],
};
const target = { scriptId: "script-1", versionId: "version-1" };
const manifest = () => ({
  schemaVersion: 1 as const,
  id: "manifest-1",
  scriptId: target.scriptId,
  scriptVersionId: target.versionId,
  sourceSha256: "a".repeat(64),
  requested:
    prepareRequests(proposal.source, proposal.requestedCapabilities).requested,
  warnings: [],
  review: null,
});
beforeEach(() => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: manifest(),
    legacy: false,
  });
  vi.mocked(api.reviewManifest).mockResolvedValue({ manifest: manifest() });
});
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const yes = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "Yes, allow Chat broadcast" }),
  );
const no = () =>
  fireEvent.click(
    screen.getByRole("button", { name: "No, deny Spawn entities" }),
  );
it("starts neutral, requires a choice for each capability, and does not approve until confirmed", async () => {
  const save = vi.fn().mockResolvedValue(target);
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved={false}
      saving={false}
      onSave={save}
    />,
  );
  expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(4);
  const confirm = screen.getByRole("button", {
    name: "Save script & confirm choices",
  }) as HTMLButtonElement;
  expect(confirm.disabled).toBe(true);
  yes();
  expect(confirm.disabled).toBe(true);
  no();
  expect(confirm.disabled).toBe(false);
  expect(save).not.toHaveBeenCalled();
  expect(api.reviewManifest).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() =>
    expect(api.reviewManifest).toHaveBeenCalledWith(
      "script-1",
      "version-1",
      "manifest-1",
      ["chat.broadcast"],
    )
  );
  await screen.findByText(/1 approved · 1 denied/);
  expect(save).toHaveBeenCalledOnce();
});
it("compares JSONB request objects semantically despite reordered keys", async () => {
  const m = manifest();
  m.requested = m.requested.map((r) => ({
    constraints: r.constraints,
    reason: r.reason,
    required: r.required,
    capability: r.capability,
  }));
  vi.mocked(api.getManifest).mockResolvedValue({ manifest: m, legacy: false });
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved={false}
      saving={false}
      onSave={vi.fn().mockResolvedValue(target)}
    />,
  );
  yes();
  no();
  fireEvent.click(
    screen.getByRole("button", { name: "Save script & confirm choices" }),
  );
  await waitFor(() => expect(api.reviewManifest).toHaveBeenCalledOnce());
});
it("retries a failed review against the same saved version without creating another script", async () => {
  const save = vi.fn().mockResolvedValue(target);
  vi.mocked(api.reviewManifest).mockRejectedValueOnce(
    new Error("Review temporarily unavailable"),
  );
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved={false}
      saving={false}
      onSave={save}
    />,
  );
  yes();
  no();
  fireEvent.click(
    screen.getByRole("button", { name: "Save script & confirm choices" }),
  );
  await screen.findByRole("alert");
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm permission choices" }),
  );
  await screen.findByText(/1 approved · 1 denied/);
  expect(save).toHaveBeenCalledOnce();
  expect(api.reviewManifest).toHaveBeenCalledTimes(2);
});
it("refuses a saved manifest with different constraints", async () => {
  const m = manifest();
  m.requested[0]!.constraints.maxCalls = 5;
  vi.mocked(api.getManifest).mockResolvedValue({ manifest: m, legacy: false });
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved={false}
      saving={false}
      onSave={vi.fn().mockResolvedValue(target)}
    />,
  );
  yes();
  no();
  fireEvent.click(
    screen.getByRole("button", { name: "Save script & confirm choices" }),
  );
  expect((await screen.findByRole("alert")).textContent).toContain("differ");
  expect(api.reviewManifest).not.toHaveBeenCalled();
});
it("can deny every requested capability explicitly", async () => {
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved={false}
      saving={false}
      onSave={vi.fn().mockResolvedValue(target)}
    />,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "No, deny Chat broadcast" }),
  );
  no();
  fireEvent.click(
    screen.getByRole("button", { name: "Save script & confirm choices" }),
  );
  await waitFor(() =>
    expect(api.reviewManifest).toHaveBeenCalledWith(
      "script-1",
      "version-1",
      "manifest-1",
      [],
    )
  );
});
it("finds the exact historical proposal version when it was already saved", async () => {
  vi.mocked(api.listScripts).mockResolvedValue(
    [{ id: "script-1", sourceMessageId: "m" }] as Awaited<
      ReturnType<typeof api.listScripts>
    >,
  );
  vi.mocked(api.getScript).mockResolvedValue(
    {
      versions: [{
        id: "version-new",
        source: "changed source",
        language: "typescript",
      }, {
        id: "version-1",
        source: proposal.source,
        language: proposal.language,
      }],
    } as Awaited<ReturnType<typeof api.getScript>>,
  );
  const save = vi.fn();
  render(
    <ChatCapabilityReview
      proposal={proposal}
      messageId="m"
      saved
      saving={false}
      onSave={save}
    />,
  );
  yes();
  no();
  fireEvent.click(
    screen.getByRole("button", { name: "Confirm permission choices" }),
  );
  await waitFor(() =>
    expect(api.reviewManifest).toHaveBeenCalledWith(
      "script-1",
      "version-1",
      "manifest-1",
      ["chat.broadcast"],
    )
  );
  expect(save).not.toHaveBeenCalled();
});
it("pure calculation keeps the simple save action without a permission prompt", async () => {
  const pure = {
    ...proposal,
    source: "console.log(42)",
    requestedCapabilities: [],
  };
  const save = vi.fn().mockResolvedValue(undefined);
  render(
    <ChatCapabilityReview
      proposal={pure}
      messageId="m"
      saved={false}
      saving={false}
      onSave={save}
    />,
  );
  expect(screen.queryByRole("group")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Save script as draft" }));
  await screen.findByRole("button", { name: "Saved to scripts" });
  expect(api.reviewManifest).not.toHaveBeenCalled();
});

it("shows a persisted review after returning to chat without preselecting new choices",async()=>{
 const m=manifest();const reviewed={...m,review:{id:"review-1",approvedAt:new Date().toISOString(),approved:[m.requested[0]!],denied:[m.requested[1]!]}};
 vi.mocked(api.getManifest).mockResolvedValue({manifest:reviewed,legacy:false});
 vi.mocked(api.listScripts).mockResolvedValue([{id:"script-1",sourceMessageId:"m"}] as Awaited<ReturnType<typeof api.listScripts>>);
 vi.mocked(api.getScript).mockResolvedValue({versions:[{id:"version-1",source:proposal.source,language:proposal.language}]} as Awaited<ReturnType<typeof api.getScript>>);
 render(<ChatCapabilityReview proposal={proposal} messageId="m" saved saving={false} onSave={vi.fn()}/>);
 expect((await screen.findByText(/Saved review:/)).textContent).toContain("1 approved");
 expect(screen.getAllByRole("button",{pressed:false})).toHaveLength(4);
 expect((screen.getByRole("button",{name:"Confirm permission choices"}) as HTMLButtonElement).disabled).toBe(true);
});
it("unsupported requests cannot be allowed in chat",async()=>{
 const unsupported={...proposal,source:"console.log(42)",requestedCapabilities:[{capability:"paper.executeCommand",required:true,reason:"Unsupported proposal",constraints:{maxCalls:1}}]};
 vi.mocked(api.getManifest).mockResolvedValue({manifest:{...manifest(),requested:prepareRequests(unsupported.source,unsupported.requestedCapabilities).requested},legacy:false});
 render(<ChatCapabilityReview proposal={unsupported} messageId="m" saved={false} saving={false} onSave={vi.fn().mockResolvedValue(target)}/>);
 expect(screen.queryByRole("button",{name:/Yes, allow/})).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Save script & confirm choices"}));
 await waitFor(()=>expect(api.reviewManifest).toHaveBeenCalledWith("script-1","version-1","manifest-1",[]));
});
it("refreshes Workbench permissions after the chat review is committed",async()=>{
 const m=manifest();let reviewed=false;
 const updated={...m,review:{id:"review-1",approvedAt:new Date().toISOString(),approved:[m.requested[0]!],denied:[m.requested[1]!]}};
 vi.mocked(api.getManifest).mockImplementation(async()=>({manifest:reviewed?updated:m,legacy:false}));
 vi.mocked(api.reviewManifest).mockImplementation(async()=>{reviewed=true;return {manifest:updated};});
 render(<><CapabilityPermissions scriptId="script-1" versionId="version-1" dirty={false} running={false}/><ChatCapabilityReview proposal={proposal} messageId="m" saved={false} saving={false} onSave={vi.fn().mockResolvedValue(target)}/></>);
 await screen.findByLabelText("Version permissions");yes();no();fireEvent.click(screen.getByRole("button",{name:"Save script & confirm choices"}));
 await waitFor(()=>expect(screen.getByLabelText("Version permissions").textContent).toContain("1 approved"));
});
