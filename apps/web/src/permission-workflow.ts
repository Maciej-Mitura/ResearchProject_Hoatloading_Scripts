import type { CapabilityManifest } from "../../../packages/contracts/src/capabilities";
import type { PermissionProfileId } from "./types";
export type PermissionLoad = {
  manifest: CapabilityManifest | null;
  loaded: boolean;
  error?: string;
  reason?: "loaded" | "reviewed" | "external-review";
};
export type RunGuidance = {
  title: string;
  message: string;
  action: "review" | "mode";
  profile?: PermissionProfileId;
};
export const PROFILE_LABELS: Record<PermissionProfileId, string> = {
  none: "No permissions",
  "read-fixture": "Read test fixture",
  "env-demo": "Demo environment",
  "host-chat": "Chat broadcast (fixed)",
  "host-capabilities": "Per-script permissions",
};
export const PER_SCRIPT_LABEL = "Per-script permissions";
export const PER_SCRIPT_DESCRIPTION =
  "Uses only the host capabilities explicitly approved for this script version. Permissions are enforced by the Host Gateway and do not automatically carry over to other script versions.";
export function permissionState(
  m: CapabilityManifest | null,
  dirty: boolean,
): string {
  if (dirty && m) return "Outdated";
  if (!m) return "Fixed profiles";
  if (!m.requested.length) return "No host permissions";
  if (!m.review) return "Review required";
  return m.review.denied.length ? "Partially approved" : "Approved";
}
export function runGuidance(
  m: CapabilityManifest | null,
  profile: PermissionProfileId,
): RunGuidance | null {
  if (m?.requested.length && !m.review) {
    return {
      title: "Permission review required",
      message:
        "This script requests host capabilities that require your approval before it can run.",
      action: "review",
    };
  }
  if (m && profile === "host-chat") {
    return {
      title: "Choose a compatible execution mode",
      message: m.requested.length
        ? "This version uses per-script permissions. Use its reviewed permissions to run the requested host capabilities."
        : "This version does not request host capabilities. Use No permissions for restricted execution.",
      action: "mode",
      profile: m.requested.length ? "host-capabilities" : "none",
    };
  }
  if (!m && profile === "host-capabilities") {
    return {
      title: "Choose a fixed execution profile",
      message:
        "This historical version has no per-script manifest. Select an appropriate fixed profile, or save a new version to request per-script permissions.",
      action: "mode",
      profile: "none",
    };
  }
  return null;
}
export function workflowError(error: unknown): RunGuidance | null {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /This version uses capability manifests|Capability permission review required for this version/i
      .test(message)
  ) {
    return {
      title: "Permission review required",
      message:
        "This script version uses per-script host permissions. Review the requested capabilities before running.",
      action: "review",
    };
  }
  if (/source\/manifest mismatch|stale.*manifest/i.test(message)) {
    return {
      title: "Permission review is outdated",
      message:
        "Save the current source as a new version, then review its requested permissions.",
      action: "review",
    };
  }
  return null;
}

export function profileLabel(value?:string|null) { return value ? PROFILE_LABELS[value as PermissionProfileId] ?? "Unknown recorded mode" : "Not recorded"; }
