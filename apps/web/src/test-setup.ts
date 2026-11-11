import { afterEach, beforeEach, vi } from "vitest";
import { api } from "./api/client";
// JSDOM has no layout engine. Supply only the missing geometry APIs used by CM6.
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => new DOMRect();
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    Object.assign([], { item: () => null }) as unknown as DOMRectList;
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {};
}
// Existing tests describe historical fixed-profile versions unless they opt into
// an explicit manifest fixture. Never make network requests during component tests.
beforeEach(() => {
  if (!vi.isMockFunction(api.executionPeriod)) {
    vi.spyOn(api, "executionPeriod").mockResolvedValue({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
      summary: {
        completed: 0,
        failed: 0,
        terminated: 0,
        averageDurationMs: null,
        completeEvidence: 0,
      },
    });
  }
  if (!vi.isMockFunction(api.getManifest)) {
    vi.spyOn(api, "getManifest").mockResolvedValue({
      manifest: null,
      legacy: true,
    });
  }
});
afterEach(() => vi.restoreAllMocks());
