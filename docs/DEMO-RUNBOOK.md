# Normal runc demo runbook

One short session; no paid Jev calls, runsc, benchmark or failure injection.
Use [normal setup](REPRODUCTION.md) first. Default URLs below assume API 3000/web
5173; the retained development environment may use API 13000/web 15173.
Read `.env` locally without sharing credentials and use its configured ports.

## 1. Start and verify

```bash
docker compose up -d --build web paper
docker compose ps
docker compose logs --tail=60 paper
```

For an intentional offline assistant demo, temporarily set `CHAT_PROVIDER=mock`; restore your normal real-provider selection afterward. This is not the normal assistant configuration. Set `EXECUTION_PROVIDER=docker`,
`RISK_ANALYZER=deterministic`, empty `SANDBOX_DOCKER_RUNTIME`; accept the EULA
personally before setting `EULA=TRUE`. `/health` must report DB ok;
`GET /api/config/public` must show Docker execution; `GET /api/host/status` must
show connected Paper. No runsc or external model is needed.

## 2. Explain context and runtime

Open workbench and Settings. Context guides proposals; it grants nothing.
Use the Workbench editor and show the permission-profile picker. The selected
provider/profile and result manifest describe runtime behavior; observed audit
and advisory results describe the completed run.

## 3. Normal source

Use [simple-calculation.js](../samples/scripts/simple-calculation.js), profile
`none`. Open a new conversation and ask the mock assistant for a calculation,
then Save script as draft; or select the seeded calculation and review its current
source. Run; expect 4 from the mock assistant calculation, or Hello and 4 from
the sample/updated stock calculation. Expect completed. Exporting an uncalled function alone
does not execute it.

## 4. Caught restricted read

Use [caught-restricted-read.js](../samples/scripts/caught-restricted-read.js),
profile `none`. Expect completed, the handled-message stdout, and read access/check
observation for `/etc/hosts`. The caught denial does not erase observed activity.
Show audit collection status/reasons. Zero observations with unavailable collection
must not be presented as no activity. Read audit events as observations, not native
allow/deny verdicts. Optional fixture/env samples use their named profiles.

## 5. Host capability

Use [welcome-message.js](../samples/scripts/welcome-message.js), profile `host-chat`.
Run once. Output contains accepted/commandId/callId; accepted means queued.
Open Server Info, refresh if necessary, and find the Paper-confirmed broadcast.
If a Minecraft Java 1.21.1 client is connected, show the message in-game; the
server-side confirmation is still the evidence when no player client is present.

## 6. Correlate and assess

Advanced details expose execution/trace IDs. Inspect:

- `GET /api/executions/<executionId>`
- `GET /api/security/events?executionId=<executionId>`
- `GET /api/host/events?limit=100`
- `GET /api/risk-assessments?executionId=<executionId>`

Match `host_api.requested`, allowed and queued call/command IDs to the later
`host.command.result` and Server Info event. A result may arrive after execution
completion. Show deterministic LOW/REVIEW/HIGH as advisory; REVIEW does not mean
blocked. Analysis failed/unavailable can coexist with completed execution.

UI timeline/security evidence comes from PostgreSQL. Collector logs are separate
best-effort observability: `docker compose logs --tail=150 otel-collector`.
No complete Paper span or durable trace backend is claimed.

## 7. Saved research and stop

Open [research status](RESEARCH-STATUS.md) and saved Phase 3/4 reports. Mention
Jev 16/25 modal agreement versus deterministic 24/25, variability on two cases,
and runsc 9/10 compatibility with W8 DNS failure. Do not rerun experiments.
Stop presentation services with `docker compose stop` when appropriate; retain
volumes. Do not use `down -v` to prepare a demo.

## Optional exact API creation (PowerShell)

```powershell
$demoApi = 'http://localhost:3000' # use configured API_PORT
$demoSource = Get-Content -Raw samples/scripts/welcome-message.js
$demoBody = @{name='Manual host demo';language='javascript';source=$demoSource;status='ready'} | ConvertTo-Json
$demoScript = Invoke-RestMethod "$demoApi/api/scripts" -Method Post -ContentType 'application/json' -Body $demoBody
$demoRun = @{scriptId=$demoScript.script.id;permissionProfile='host-chat'} | ConvertTo-Json
$demoExecution = Invoke-RestMethod "$demoApi/api/executions" -Method Post -ContentType 'application/json' -Body $demoRun
Invoke-RestMethod "$demoApi/api/executions/$($demoExecution.id)"
```

Poll the last route until terminal; then inspect security/host events as above.
