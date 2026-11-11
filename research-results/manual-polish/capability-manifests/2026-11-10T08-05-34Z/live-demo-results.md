# Bounded local demonstration results
These are post-research integration checks with test-harness approvals, not frozen empirical experiments. No manual player participation was requested after the user declined to join. GoldennBullet is the configured example target.

| Scenario | Observed result |
|---|---|
| A calculation | Printed42; requested[]; no host review |
| B chat | Approved request; trusted Paper success result |
| C spawn | Approved ZOMBIE maximum3; generated source produced three separate Paper-confirmed spawns near the public demo location |
| D composition | Chat/status/three spawns confirmed. Private-message request reached Paper and failed CAPABILITY_PLAYER_OFFLINE; full all-effects success is unverified |
| E partial denial | Chat approved and confirmed; spawn denied with CAPABILITY_NOT_APPROVED; no spawn command queued |
| F source tampering | Known spawn call absent from requested/approved lists; advisory warning and Gateway denial |
| G constraint escape | Approved ZOMBIE, attempted SKELETON; CAPABILITY_ARGUMENT_NOT_ALLOWED; no command queued |
| H cross execution | B own unapproved credential403; copied A credential with B ID403; copied A credential with forged A ID from B403; A credential after completion401 |

Additional probes: per-capability quota overrun429, extra NBT field400, public supplied authority400, cross-script/version400, new version using legacy host-chat400. Generated operations and original hand-authored checks are retained separately. Outcomes marked completed refer to process exit; typed denial/offline results do not automatically throw from effect SDK methods.

Demo entities have AI/item pickup disabled and are removed by the plugin after60seconds. No arbitrary command or generic Paper operation was used. Runtime probe containers were removed.

Generated execution IDs:
{
  "spawn": {
    "executionId": "ccbdcc83-d2a4-41e5-9cca-554b1e039d2a",
    "successfulSpawns": 3
  },
  "multi": {
    "executionId": "fc00a2ab-60e9-46b7-a50d-027ef44f9d6d",
    "successfulSpawns": 3
  }
}

See runtime-bound-summary.json, generated-runtime-summary.json and runtime-H-summary.json for correlation/results.
