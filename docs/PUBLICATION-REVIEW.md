# Public-release review — 2026-11-07

## 1. Publication verdict

**READY TO SHARE** as a public, work-in-progress Bachelor Research Project for
external technical community feedback. No genuine tracked credential exposure
was identified. The maintainer confirmed the historical Jev test token was
fabricated; no credential rotation or secret-removal history cleanup is needed.

Maintainer decisions superseding the initial conservative audit verdict:

- Tracked research corpus, scenarios, labels, policies and experiment artifacts
  may remain public; do not hide or rewrite them to preserve a blind holdout.
- Incomplete clean-clone verification and evolving setup are accepted WIP risks,
  not publication blockers. No complete clean-clone verification is claimed.
- Existing Git author metadata stays unchanged; identity privacy is a maintainer
  decision. No history rewriting is authorized.
- Share the architecture for feedback, without production-safety claims.

The initial conservative verdict was READY AFTER MANUAL ACTIONS; the decisions
above supersede it. The original findings and methodological caveats below are
retained as audit context. They do not override these accepted publication decisions. Nothing was
committed, pushed, published, released, rotated or history-rewritten; no paid
experiments or provider requests were run.

## 2. Security findings

| Severity | File/location | Finding | Action required |
|---|---|---|---|
| Informational, resolved | `apps/api/tests/jev_risk_test.ts`, redaction test near line 650; commit `e910ff5` | Maintainer confirmed the historical token was deliberately fabricated. Current tree uses an unmistakable synthetic value. | No rotation or secret-removal history cleanup required for this fixture. |
| Medium, privacy | Author/committer metadata in all four reachable commits | Personal student email and author name are embedded in commits; reflog repeats identity. | Existing metadata is retained as instructed. Privacy remains a maintainer decision; consider a GitHub noreply address for future commits. No history rewrite or Git configuration change is authorized. |
| Medium, local only | Ignored `.env` | Populated Gemini and AI Gateway credentials; no exact matches found in any local Git object. | Keep private; do not force-add, attach, or include in source archives. No evidence-based rotation requirement for these current keys from this audit alone. |
| Medium, operational | `compose.yaml`, API routes, token defaults | Workbench/control-plane routes are a local trusted-user PoC; published ports bind all interfaces. Bridge/admin/password examples are public known defaults; Paper defaults to offline mode. | Use a trusted local/disposable environment, independent random tokens, and local firewall restrictions. Do not expose the running stack as a public service. Defaults are examples, not recovered private credentials. |
| Medium, methodological | `fixtures/scenarios/*manifest.json`, holdout scripts, rules, `config/jev-risk-policy.md`, tracked dry-run | Labels, holdout scenarios and classifier/policy behavior will become public before evaluation concludes. | Maintainer accepts publication of tracked research material. Retain this methodological caveat for interpreting evaluation; see section 10. |
| Low | `.env.example`, old README and architecture docs | Missing/ineffective settings and stale mock/no-host claims made setup misleading. | Fixed. Advanced direct-service settings are separated from Compose-interpolated variables. |
| Low, reproducibility | Frozen evidence and pinned experiment manifest | 25 frozen records exist locally but are ignored, while the tracked manifest references them and an earlier model/route. | Retain original data and fingerprints. Publish a reviewed reproducibility bundle after evaluation, or explain how a new collection differs. Do not rewrite the frozen manifest to imply a new run. |
| Verification gap | Docker engine / backend toolchain | Docker Desktop Linux engine unavailable; host Deno unavailable. | Follow-up backend/gateway/bridge tests and disposable startup remain useful; incomplete verification is accepted for WIP publication. |

No private key/certificate, database dump, credentialed private remote, internal
private service URL, sensitive local IP, absolute Windows user path, or genuine
non-example database/bridge/admin credential was identified in publishable files.
Service names such as `api`, `postgres`, `runner`, and `host-gateway` are Compose
DNS, not private infrastructure discoveries. Migration SQL files are schema/seed
source, not database dumps. Two PNGs in the parent workspace were visually
reviewed: they show the workbench and local execution history, with no visible
credential; they are outside this Git repository and were left unchanged.

## 3. Credential rotation needed

- **None identified.** The maintainer confirmed the historical AI Gateway test
  token was deliberately fabricated. No key validity/authentication requests
  were made, and no genuine credential exposure was found in tracked files/history.
- Current ignored Gemini and AI Gateway keys were not found in Git objects;
  leave them private. No credentials were changed automatically.

## 4. Git history and audit coverage

Reviewed the complete current first-party repository text, including ignored
`.env` and local research exports; source, tests, fixtures, scripts, configuration,
Dockerfiles and docs. Current index initially had 229 tracked paths and no user
changes. There are no tracked CI workflows. Generated dependencies/build caches
were inventoried/excluded as non-public build inputs rather than treated as
first-party source. No tracked binary media or key bundles were found.

Inspected every tree in all four commits reachable from local/remote refs,
`.env`/key filename history, provider-key formats, secret assignments, credential
URLs, identities and local paths. Suspect matches were manually reviewed without
including credential values in this report. `.env` has no reachable tracked
history. Git object inventory contained 423 objects, including three dangling
blobs; both current provider keys were checked in all objects with no match.
Dangling blobs were also checked for common key/private-key formats and user
paths. Local config/remotes, refs and reflog were inspected; the configured remote
is the GitHub repository used in the README, without embedded credentials.

The synthetic test token exists in `e910ff5`; the maintainer confirmed it was
fabricated. Its historical presence does not require credential rotation or
secret-removal history rewriting. Author/committer identity rewriting remains a
separate privacy decision. If independently discovered genuine secrets ever
require cleanup, first rotate them, retain a private backup, then use an
explicitly approved `git-filter-repo` cleanup in a disposable mirror and rescan.
No destructive rewrite was authorized or run. This audit covers local objects,
not additional GitHub-retained objects or other copies.
Pattern searches are not proof of the absence of arbitrary encoded secrets.

## 5. Files changed

| File | Purpose |
|---|---|
| `README.md` | Concise code-grounded public overview, Mermaid, setup, usage, limitations and feedback |
| `.env.example` | Complete supported setting inventory, blank provider keys, scope/alias guidance; remove unused `PAPER_BUILD` and inactive collector host-port settings; require explicit EULA acceptance |
| `.gitignore` | Additional credential stores, local data, IDE/transcript/temp exclusions; preserve research selection and migrations |
| `.dockerignore` | Keep research exports, credential files and local databases out of application build contexts |
| `apps/api/tests/jev_risk_test.ts` | Replace opaque token/prefix with explicit synthetic redaction-test input; retain test behavior |
| `config/project-spec.yaml` | Comments only: clarify descriptive metadata and unpinned Paper build; no settings changed |
| `docs/ARCHITECTURE.md` | Correct current advisory risk/host path, profile network and execute request shape |
| `docs/RESEARCH-BOUNDARIES.md` | Correct deterministic/Jev/host/telemetry implementation versus pending evaluation |
| `docs/PROJECT-CONTEXT.md` | Explain `executionEnforcement: mocked` is descriptive metadata, not live runtime detection |
| `docs/RESTORE-LOCAL-SETUP.md` | Workbench-first startup and explicit optional Paper/EULA step |
| `SECURITY.md` | Short PoC scope and private reporting instructions with maintainer TODO |
| `docs/PUBLICATION-REVIEW.md` | This redacted audit, artifact decisions and validation record |

No frozen records, labels, deterministic logic, Jev policy, architecture, local
`.env`, or Git history were changed. No contribution bureaucracy was added.

## 6. README summary

README includes project overview, simple Mermaid architecture, implemented and
pending features, short security model, installation and environment setup,
usage/profiles/examples, research status, and request for community feedback.
Claims distinguish implemented integration from incomplete empirical evaluation.
Optional UI polish was not invented as a research deliverable.

## 7. Clean-clone instructions

Requirements: Git, Docker/Compose v2 with Linux containers. Local Deno/JDK/Gradle/
Node are unnecessary for container startup. Node 18+ is optional for root npm
scripts; frontend build image uses Node 22. Minecraft client is optional.

```bash
git clone https://github.com/Maciej-Mitura/ResearchProject_Hoatloading_Scripts.git
cd ResearchProject_Hoatloading_Scripts
cp .env.example .env
# Edit .env privately: independent bridge/admin tokens; EXECUTION_PROVIDER=docker.
docker compose up -d --build web
docker compose ps
```

PowerShell copy: `Copy-Item .env.example .env`. No dependency installation is
needed on the host. Open http://localhost:5173 and http://localhost:3000/health;
check `/api/config/public` for `executionProvider: docker`. Run a hello script.

For Paper: accept the Minecraft EULA, set `EULA=TRUE`, then:

```bash
docker compose up -d --build paper
docker compose logs -f paper
```

Wait for “Done”; join with Minecraft Java 1.21.1 at `localhost:25565`.
`/api/host/status` should show `connected: true`; use `host-chat` and broadcast.
Default host ports are web 5173, API 3000 and Minecraft 25565. PostgreSQL,
collector, runner and gateway are not host-published. Collector export is debug
output, not a bundled trace exploration UI.

```bash
docker compose down
# Only to deliberately destroy DB/world/plugin volumes:
docker compose down -v
```

Known limits: first-build downloads require network; Paper build and some base
image tags/dependency ranges are not immutable pins. Original frozen comparison
is not fully reproducible from a clean clone without retained frozen records.
The tracked manifest records an earlier direct TypeSafe model/route; current
Vercel defaults do not retrospectively describe those original frozen settings.

## 8. Required variables

Defaults permit a basic local mock-chat PoC with no external key. These are
required configuration roles, rather than secrets to obtain from a third party.

| Variable | Required for basic PoC? | Feature | Where to obtain/configure |
|---|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Yes, defaults provided | Persistence | Choose local DB settings; Compose constructs the credentialed URL |
| `BRIDGE_TOKEN` | Required for optional Paper bridge | Host connection | Generate a private random local value; shared by Compose API/Paper |
| `HOST_GATEWAY_ADMIN_TOKEN` | Required for host sessions | `host-chat` | Generate an independent private random local value; Compose maps internal service token |
| `EXECUTION_PROVIDER` | Yes, default provided | `mock` simulation / `docker` real execution | Set `docker` for research execution |
| `CHAT_PROVIDER`, `RISK_ANALYZER` | Defaults sufficient | Key-free assistant/advisory analysis | Keep `mock` chat and `deterministic` risk |
| `DATABASE_URL` | Direct API only; not a Compose .env override | Persistence | Build from a private DB connection; Compose supplies internally |

## 9. Optional variables

| Variable | Required for basic PoC? | Feature | Where to obtain/configure |
|---|---|---|---|
| `WEB_PORT`, `API_PORT`, `VITE_API_URL` | No | Published UI/API | Local ports; rebuild web when changing browser API URL |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | No | Gemini assistant | Own provider account; select `CHAT_PROVIDER=gemini` |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | No | OpenAI assistant | Own provider account; select `CHAT_PROVIDER=openai` |
| `JEV_PROVIDER`, `JEV_MODEL`, `AI_GATEWAY_API_KEY` | No | Vercel Jev | Own AI Gateway credential; provider `vercel`, pinned model `typesafe-ai/jev-1.14.0` |
| `TYPESAFE_API_KEY`, `JEV_API_KEY` | No | Direct Jev alternative | Own TypeSafe credential; preferred first name, second legacy alias; never reuse gateway key |
| `JEV_TIMEOUT_MS`, `JEV_API_URL`, `JEV_MODELS_URL` | No | Jev timeout/advanced routes | Keep defaults/blank unless intentionally overriding provider endpoints |
| `SANDBOX_DOCKER_RUNTIME` | No | gVisor | Register `runsc` on a Linux Docker engine; set `runsc` centrally |
| `SANDBOX_DENO_VERSION` | No | Manifest/runtime expectation | Match pinned sandbox Dockerfile; changing this alone does not install Deno |
| `SANDBOX_TIMEOUT_MS`, `SANDBOX_MAX_OUTPUT_BYTES`, `SANDBOX_AUDIT_MAX_EVENTS`, `SANDBOX_AUDIT_MAX_BYTES` | No | Execution limits | Trusted local administrator; defaults supplied |
| `HOST_CHAT_BROADCAST_BUDGET`, `HOST_CHAT_BROADCAST_MAX_LEN`, `HOST_SESSION_TTL_MS` | No | Gateway bounds | Local trusted configuration |
| `MC_VERSION`, `MEMORY`, `ONLINE_MODE`, `MOTD`, `MAX_PLAYERS`, `VIEW_DISTANCE`, `MC_PORT`, `EULA` | No | Optional Paper server | Local configuration; set EULA true only after acceptance |
| `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_SERVICE_NAME` | No | Direct API telemetry | Fixed internal values in Compose; configure own collector for direct launch |
| `EXECUTION_SUPERVISOR_URL`, `RUNNER_URL`, `PROJECT_CONFIG_DIR`, `HOST_GATEWAY_SERVICE_TOKEN` | No | Direct API configuration | Compose supplies values; preferred supervisor URL takes precedence over legacy alias |
| `RUNNER_PORT`, `SANDBOX_IMAGE`, `SANDBOX_CPUS`, `SANDBOX_MEMORY`, `SANDBOX_PIDS_LIMIT`, `SANDBOX_WORKSPACE_TMPFS`, `SANDBOX_TMP_TMPFS`, `SANDBOX_MAX_SOURCE_BYTES`, `SANDBOX_HOST_NETWORK` | No | Advanced direct runner settings | Code-supported; not .env-interpolated by Compose; use service-specific override |
| `HOST_GATEWAY_URL`, `HOST_GATEWAY_SANDBOX_URL`, `HOST_GATEWAY_NET_ALLOW`, `HOST_GATEWAY_PORT`, `API_BASE_URL`, `HOST_SESSION_MAX_TTL_MS` | No | Advanced direct runner/gateway settings | Internal routing/defaults; service-specific overrides |
| `BRIDGE_API_URL` | No | Direct bridge configuration | Compose fixes to internal API; Java bridge also supports JVM property fallback |
| `API_URL`, `JEV_REPS`, `HOST_ACTIVITY_DB_TEST` | No | Host research scripts / opt-in DB test | Export in shell; scripts do not automatically load .env |

Sandbox variables `HOST_CAPABILITY_TOKEN`, `SANDBOX_DEMO_VALUE`,
`DENO_AUDIT_PERMISSIONS`, `DENO_DIR`, `SANDBOX_WORKDIR`, `SCRIPT_LANGUAGE` and
`PERMISSION_PROFILE` are trusted/generated job internals, not user-supplied
credentials or global .env settings. `HOME` is read by denial fixtures only.
All supported names and scope comments appear in `.env.example`.

## 10. Research artifact publication

**Decision: tracked research artifacts are accepted for public sharing.** The
following classifications preserve the original audit considerations. They do
not require hiding scenarios, labels, holdout scripts, policies or manifests.
Ignored local artifacts remain ignored; frozen data and fingerprints are untouched.


| Category | Artifact | Publication assessment |
|---|---|---|
| A — useful reproducible source | Fixtures, scenario/sensitivity manifests, deterministic rules, evidence schema, Jev policy/prompt construction | Technically safe from credential findings, but labels/holdout scripts/policy may bias future evaluation. Public sharing accepted by maintainer; account for public availability in later methodology. |
| B — generated but safe | Tracked `experiment-manifest.json`, sanitized `jev-dry-run-SCN-005.json` | No discovered credentials. Useful provenance, but exposes experiment structure and sample inputs. Manifest is historical and should stay unchanged. |
| B / E — safe content, release decision | 25 local ignored `frozen-evidence-v1/*.json` | No discovered credential patterns/current-key matches in reviewed data; execution IDs/timestamps/output remain research data. Review for blinding and export provenance before separate release. Keep originals. |
| B / E — generated, pending interpretation | Ignored scenario CSV/JSON and Jev smoke/raw result directories | Retain privately until experiment completeness and provider diagnostics are reviewed; failed smoke outputs are not successful evaluation evidence. |
| C — sensitive/private | `.env`, DB/Paper volumes, raw future provider logs, transcripts | Never publish automatically; volumes may contain chats/player identifiers, keys or private code. Actual Docker volumes could not be inspected with engine offline. |
| D — generated/noisy | node_modules, dist/build, caches, IDE state, local logs | Excluded; rebuild rather than publish. |
| E — maintainer privacy decision | Public author/student identity | Existing metadata retained; privacy remains with maintainer. Corpus publication is explicitly accepted. |

The code strips research metadata from provider evidence and builds compact Jev
state, but request-level label separation does not prevent public-corpus
contamination, analyst tuning, or external access to a holdout set. Public code
availability does not prove a model trained on this repository; the point is to
avoid overstating a future blind evaluation. The maintainer accepts this limitation and authorizes public sharing of the
tracked corpus. Retain scenarios, labels, policy, rules and history as they are;
report public availability honestly in subsequent experimental methodology.

No gVisor comparative results exist to justify a performance/isolation claim;
publishing prepared runtime/preflight source is fine. Existing local-machine
preflight observations are historical reports, not portable prerequisites.

## 11. Maintainer review and optional follow-up

1. Historical test token is resolved as deliberately fabricated; no rotation or
   secret-removal history cleanup is required.
2. Existing author/committer metadata remains unchanged. Current configured
   identity is `Maciej Mitura <maciej.mitura@student.howest.be>`; historic commits
   also use `Maciej-Mitura` as an author name. Privacy is the maintainer's decision.
   A GitHub noreply address can be used for future commits; no Git config changed.
3. Tracked research material is accepted for publication. Retain original frozen
   evidence privately and consider a reviewed reproducibility bundle later.
4. Enable GitHub private vulnerability reporting or add a verified private contact
   in `SECURITY.md` when available. No contact was invented.
5. Repository currently has no explicit license. The maintainer may choose MIT or
   another license later if code reuse is intended; this does not block sharing.
6. Continue improving setup and testing with a disposable Docker environment.
   Incomplete clean-clone verification is disclosed and accepted for WIP sharing.
7. Manually review and commit the exact intended files, then push/publish only
   when the maintainer chooses. No automatic commit or publication is authorized.

### Follow-up container test commands

With the Docker engine running and images built, use example configuration to
avoid loading private provider settings:

```bash
docker compose --env-file .env.example build api runner host-gateway bridge-builder
docker compose --env-file .env.example run --rm --no-deps api deno test --allow-net --allow-env --allow-read --allow-write --allow-sys tests/
docker compose --env-file .env.example run --rm --no-deps runner deno test --allow-env --allow-read tests/
docker compose --env-file .env.example run --rm --no-deps host-gateway deno test --allow-env --allow-net tests/
docker compose --env-file .env.example run --rm --no-deps bridge-builder gradle test --no-daemon
```

The runner unit command does not grant Docker execution permissions and its
Docker integration suite skips. After building `sandbox`, explicitly validate
real runner jobs with:

```bash
docker compose --env-file .env.example build sandbox
docker compose --env-file .env.example run --rm --no-deps runner deno test --allow-env --allow-run=docker --allow-net --allow-read tests/docker_integration_test.ts
```

### Validation completed locally

- Frontend: all **13 tests passed** across three files.
- Frontend TypeScript check and Vite production build passed.
- Base Compose and gVisor override parsed with `--env-file .env.example`.
- README/SECURITY relative links resolved; no tracked filename case collisions.
- No absolute Windows user paths in tracked public docs/config checked.
- `.env` ignored; only `.env.example` tracked. Git whitespace check passed.
- All 423 local Git objects checked against both populated current provider keys:
  no match. Historical test token confirmed deliberately fabricated by maintainer.
- Backend Deno tests, Java tests, live Docker execution and clean-clone startup
  were **not run**: engine unavailable, local Deno absent. No paid experiments run.

### Final WIP publication rescan

After the final documentation edits, the scan covered all 229 tracked paths,
`SECURITY.md` and this new review, plus 293 unique historical file blobs across
all four reachable commits. No new suspected genuine credential, private key or
absolute Windows user path was found. Known synthetic test values were recognized
as fixtures. Both populated current local provider keys remain absent from
intended public files and reachable historical file content. Earlier assignment,
credential-URL and local-artifact findings remain documented above; public
example credentials are not private secrets.

`.env.example` contains blank provider keys and explicit local example tokens;
all detected application/script environment names are documented. Base Compose
and its gVisor override parse successfully. README/SECURITY local links and Git
whitespace checks pass. No research source/artifact changes were detected.
Frontend results from the preceding audit remain 13 passing tests and a passing
production build; they were not rerun for documentation-only follow-up edits.
Live startup/backend validation remains incomplete and accepted as WIP.

Exact intended next-commit set (no files staged or committed):

- Modified, already tracked: `.dockerignore`, `.env.example`, `.gitignore`,
  `README.md`, `apps/api/tests/jev_risk_test.ts`, `config/project-spec.yaml`,
  `docs/ARCHITECTURE.md`, `docs/PROJECT-CONTEXT.md`,
  `docs/RESEARCH-BOUNDARIES.md`, `docs/RESTORE-LOCAL-SETUP.md`.
- New, intended public: `SECURITY.md`, `docs/PUBLICATION-REVIEW.md`.
- Tracked and retained unchanged: scenario/holdout manifests and scripts,
  deterministic rules, evidence schema, Jev policy, experiment manifest and
  sanitized dry-run artifact, plus remaining application sources.
- Ignored but important: private `.env`, frozen research evidence and local
  scenario/provider exports. Keep these out of this commit.
- Not intended for publication: credentials, Docker DB/Paper volumes, raw private
  transcripts/logs, local databases, IDE/cache/dependency/build output. No live
  Docker volumes were inspected with the engine unavailable.

## 12. Final verdict

**READY TO SHARE.** From a repository-security and documentation perspective,
would I share this repository publicly for community feedback now? **YES.** No
genuine tracked credential exposure was identified, the fabricated token is
resolved, and the documentation presents the implementation and its limitations
as a work-in-progress research PoC. The maintainer accepts public tracked research
material and incomplete clean-clone reproducibility. Identity privacy remains a
maintainer decision. Public source sharing does not imply deploying the running
stack publicly or claiming production-grade untrusted-code infrastructure.
