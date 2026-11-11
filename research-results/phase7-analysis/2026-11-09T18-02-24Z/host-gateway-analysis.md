# Host Gateway as an application security boundary

## RESULTS (S19–S20)

The path is sandbox SDK → capability listener → scoped session/capability/input/
budget validation → authenticated API enqueue → trusted DB command mapping →
SecureBridge → Paper confirmation. Deno's transport grant only permits reaching
the narrow listener; it does not authorize arbitrary host actions.

E8 queued then received successful broadcasted result and server_broadcast event,
with execution/trace/call/command correlation. Public direct enqueue returned403;
missing internal credential401; an authenticated trusted harness with nonexistent
execution/trace mapping403. Capability listener lacked the admin route, while
the sandbox's Deno network scope denied admin/API ports. No rejected probe enqueued
a command. Per-execution budget5 and TTL40s are design/configuration bounds, not a
global spam guarantee. Credentials and correlation originate in trusted services,
not sandbox-supplied metadata.

## INTERPRETATION

Application-level capability authorization is a distinct contribution from runtime
network restriction. A host-enabled script can have legitimate transport while
remaining unable to request arbitrary server methods or administer sessions. Trusted
correlation then distinguishes enqueue from later host effect; advice remains
post-execution metadata. This is a concrete defense-in-depth pattern for reducing
the scope of an exposed host effect without denying all useful interaction.

## NON-CONCLUSION

Only chat.broadcast is a meaningful sandbox capability. Backend status/player
views do not constitute script APIs. No persistent events, arbitrary Paper access,
general capability ecosystem, exactly-once guarantee, independent poll packet trace
or player-screen verification. Delivery is inferred through the guarded trusted
transition; confirmation is observed. Trust in runner/gateway/API/DB/plugin and
their secret handling remains. A per-execution quota does not cap aggregate spam
across unlimited requests; runner admission only bounds local concurrent execution.
