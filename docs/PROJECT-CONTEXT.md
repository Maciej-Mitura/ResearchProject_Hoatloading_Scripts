# Project context system

Provider-independent grounding for the conversational assistant.

## Pieces

| Artifact | Role |
|----------|------|
| `config/project-spec.yaml` | Version-controlled **base / default** project facts (no secrets) |
| PostgreSQL `project_settings.overrides` | User/project-specific **overrides** from the web UI |
| **Effective configuration** | `deepMerge(base, overrides)` — what the assistant uses |
| `config/assistant-policy.md` | Provider-independent AI behavior rules |
| `config/host-capabilities.yaml` | Authoritative SecureBridge capability surface |
| Dynamic host state | Observed runtime (heartbeat, players, reported version) — **not** settings |

## Merge model

```
base (YAML)  +  overrides (JSONB)  →  effective settings
```

Only overridden fields are stored in the database. If the base YAML changes later, fields without overrides inherit the new default.

## Save → next message

1. User edits a value in **Project Settings** (right panel).
2. The UI auto-saves via `PATCH /api/project/settings` (debounced).
3. The next chat message rebuilds assistant context through `ProjectContextService` → `AssistantContextBuilder`.
4. No application restart, Docker restart, YAML edit, or new conversation is required.

## APIs

- `GET /api/project/settings` — base, overrides, effective, field metadata, issues, host state, preview
- `PATCH /api/project/settings` — validated editable overrides only
- `POST /api/project/settings/reset` — clear overrides (back to base YAML)
- `GET /api/project/settings/context-preview` — safe summary (no secrets)

## Architecture

```
Chat Service (conversations route)
    ↓
ProjectContextService   (fresh overrides every turn)
    ↓
AssistantContextBuilder
    ↓
ChatProvider
    ├── GeminiChatProvider
    ├── OpenAIChatProvider (optional)
    └── MockChatProvider
```

Gemini (and other providers) receive a prepared `systemInstruction`. They do **not** read YAML or invent Minecraft/SecureBridge facts.

## Configuration vs enforcement

Project Settings describe **policy intent**. In this PoC, `project.executionEnforcement` is typically `mocked`: toggling filesystem/network access in the UI does **not** by itself prove the sandbox enforces it.

## Future structured responses

A later step may ask the model for structured output such as:

`intent`, `summary`, `requiredCapabilities`, `unsupportedCapabilities`, `compatibility`, `script`, `warnings`

This version only prepares the grounded context input.
