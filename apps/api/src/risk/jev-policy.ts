import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

/** One current default source. Historical v1 policy is deliberately untouched. */
export const JEV_POLICY_VERSION = "2" as const;
export const JEV_POLICY_SOURCE = "config/jev-risk-policy-v2.md";
export const DEFAULT_JEV_POLICY = readFileSync(
  new URL("../../../../config/jev-risk-policy-v2.md", import.meta.url),
  "utf8",
);
export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
export const JEV_POLICY_HASH = sha256(DEFAULT_JEV_POLICY);
