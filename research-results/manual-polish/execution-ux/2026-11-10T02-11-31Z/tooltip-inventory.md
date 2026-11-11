# Tooltip inventory

One reusable InfoTip supports hover, keyboard focus, click/tap pinning, Escape/outside dismissal, accessible About labels and aria-describedby to role=tooltip. Position is clamped with a body portal; width <=300 px and viewport bounds. Existing focus-visible styling applies. Motion disables under prefers-reduced-motion. No custom select framework was introduced; native option rows cannot reliably contain interactive buttons, so four icons sit in an adjacent Profile guide disclosure.

Major concepts: execution profile, each of four profile scopes, execution outcome, duration, advisory assessment, collection quality (including each state), stages/provenance, permission observations, host capability/confirmation, configured runtime controls, and technical/correlation metadata. Insights reuses collection and advisory help. Help supplies a complete compact legend. Tooltips explain domain concepts, not every sentence.

Exact profile tooltip bodies (current /api/config/public metadata plus common suffix):

## none

Deno receives no filesystem, network, environment, subprocess or FFI permissions. These configured grants are not a general security guarantee.

## read-fixture

Configured Deno permissions: read /fixtures only (baked-in test file). Not general filesystem access. These configured grants are not a general security guarantee.

## env-demo

Configured Deno permissions: env SANDBOX_DEMO_VALUE only. Application secrets are not injected. These configured grants are not a general security guarantee.

## host-chat

Host capability chat.broadcast via Host Gateway. Deno may reach only the gateway; authority is enforced by the gateway, not by network access alone. These configured grants are not a general security guarantee.

Verified against packages/contracts/src/index.ts, services/runner/src/permissions.ts and services/sandbox/entrypoint.sh: none has no explicit grants/network; read-fixture reads /fixtures; env-demo exposes SANDBOX_DEMO_VALUE only; host-chat reads trusted SDK, scoped gateway environment, connects to gateway only, and delegates chat.broadcast authority to gateway. No general host/Paper access.
