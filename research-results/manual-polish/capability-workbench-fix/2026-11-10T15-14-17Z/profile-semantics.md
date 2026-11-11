# Execution profiles
| Internal ID | Visible name | Scope |
|---|---|---|
| none | No permissions | No additional filesystem, environment or host grants; restricted sandbox |
| read-fixture | Read test fixture | Read predefined /fixtures data only |
| env-demo | Demo environment | Read SANDBOX_DEMO_VALUE only |
| host-chat | Chat broadcast (fixed) | Historical null-manifest versions, fixed chat.broadcast authority |
| host-capabilities | Per-script permissions | SDK/Gateway transport using only the selected version's explicit stored review |

Mode selection is not permission approval. New saved versions use version-scoped manifests, including empty manifests for simple scripts. The existing backend incompatibility between a manifest and fixed host-chat remains enforced. Tooltips and Help explain the options; ordinary workflow messages no longer ask users to select an internal identifier. Technical stored diagnostics may retain IDs.
