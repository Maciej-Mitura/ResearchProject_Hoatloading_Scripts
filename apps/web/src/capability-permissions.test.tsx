import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { CapabilityPermissions } from "./components/CapabilityPermissions";
import { api } from "./api/client";
import type { CapabilityManifest } from "../../../packages/contracts/src/capabilities";
vi.mock(
  "./api/client",
  () => ({ api: { getManifest: vi.fn(), reviewManifest: vi.fn() } }),
);
const manifest: CapabilityManifest = {
  schemaVersion: 1,
  id: "m1",
  scriptId: "s1",
  scriptVersionId: "v1",
  sourceSha256: "a".repeat(64),
  warnings: [],
  review: null,
  requested: [{
    capability: "chat.broadcast",
    required: true,
    reason: "Announce",
    constraints: { maxCalls: 1 },
  }, {
    capability: "world.spawnEntity",
    required: true,
    reason: "Demo",
    constraints: { maxCalls: 3, entityTypes: ["ZOMBIE"] },
  }],
};
beforeEach(() => {
  vi.mocked(api.getManifest).mockResolvedValue({
    manifest: structuredClone(manifest),
    legacy: false,
  });
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
describe("capability review", () => {
  it("opens with every option unchecked; partial approval submits only the chosen ID", async () => {
    vi.mocked(api.reviewManifest).mockResolvedValue({
      manifest: {
        ...manifest,
        review: {
          id: "r",
          approvedAt: new Date().toISOString(),
          approved: [manifest.requested[0]!],
          denied: [manifest.requested[1]!],
        },
      },
    });
    render(
      <CapabilityPermissions
        scriptId="s1"
        versionId="v1"
        dirty={false}
        running={false}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Review permissions" }),
    );
    const boxes = screen.getAllByRole("checkbox") as HTMLInputElement[];
    expect(boxes.every((b) => !b.checked)).toBe(true);
    fireEvent.click(boxes[0]!);
    fireEvent.click(
      screen.getByRole("button", { name: "Approve selected permissions" }),
    );
    await waitFor(() =>
      expect(api.reviewManifest).toHaveBeenCalledWith("s1", "v1", "m1", [
        "chat.broadcast",
      ])
    );
    await screen.findByText(/still references capabilities you denied/);
  });
  it("requires fresh unchecked review after reopening", async () => {
    render(
      <CapabilityPermissions
        scriptId="s1"
        versionId="v1"
        dirty={false}
        running={false}
      />,
    );
    const button = await screen.findByRole("button", {
      name: "Review permissions",
    });
    fireEvent.click(button);
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(button);
    expect((screen.getAllByRole("checkbox")[0] as HTMLInputElement).checked)
      .toBe(false);
  });
  it("marks changed source as requiring save and review", async () => {
    render(
      <CapabilityPermissions
        scriptId="s1"
        versionId="v1"
        dirty
        running={false}
      />,
    );
    expect(
      (await screen.findByRole("button", {
        name: "Review permissions",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByText(/Save this version before reviewing/)).toBeTruthy();
  });
  it("historical versions retain their legacy profile without forced review", async () => {
    vi.mocked(api.getManifest).mockResolvedValue({
      manifest: null,
      legacy: true,
    });
    render(
      <CapabilityPermissions
        scriptId="s1"
        versionId="old"
        dirty={false}
        running={false}
      />,
    );
    await screen.findByText("Fixed profiles");
    expect(screen.queryByRole("button", { name: "Review permissions" }))
      .toBeNull();
  });
  it("unsupported requests cannot be selected", async () => {
    vi.mocked(api.getManifest).mockResolvedValue({
      manifest: {
        ...manifest,
        requested: [{
          capability: "paper.executeCommand",
          required: true,
          reason: "Unsupported request",
          constraints: { maxCalls: 1 },
        }],
      },
      legacy: false,
    });
    render(
      <CapabilityPermissions
        scriptId="s1"
        versionId="v1"
        dirty={false}
        running={false}
      />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "Review permissions" }),
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
