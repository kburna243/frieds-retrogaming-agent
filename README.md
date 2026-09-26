<div align="center">
  <img src="https://raw.githubusercontent.com/kburna243/frieds-retrogaming-kit/main/docs/images/character-controller.svg" alt="Fried's Retrogaming Kit mascot" width="140" style="margin-bottom: 12px;" />
  <h1>🤖 Fried's Retrogaming Agent</h1>
  <p><strong>A model that diagnoses your cabinet, and a gate that makes sure you are the one who says yes</strong></p>

  [![Kit API](https://img.shields.io/badge/Kit%20API-v1-ff2d95?style=for-the-badge)](contract/API.md)
  [![Node](https://img.shields.io/badge/Node-24%2B-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)](package.json)
  [![Runtime deps](https://img.shields.io/badge/Runtime%20deps-0-3DDC84?style=for-the-badge)](package.json)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
  [![Documentation](https://img.shields.io/badge/Docs-English%20%7C%20Deutsch-3DDC84?style=for-the-badge&logo=gitbook&logoColor=white)](docs/)
  [![CI](https://img.shields.io/github/actions/workflow/status/kburna243/frieds-retrogaming-agent/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/kburna243/frieds-retrogaming-agent/actions/workflows/ci.yml)
  [![Human in the loop](https://img.shields.io/badge/--yes-does%20not%20exist-FFC857?style=for-the-badge)](docs/POLICY.md)

  <p>
    <a href="README.md"><strong>English</strong></a> •
    <a href="README.de.md"><strong>Deutsch</strong></a> •
    <a href="docs/POLICY.md"><strong>Policy</strong></a> •
    <a href="docs/ARCHITECTURE.md"><strong>Architecture</strong></a> •
    <a href="docs/HANDOFF.md"><strong>Handoff</strong></a> •
    <a href="https://github.com/kburna243/frieds-retrogaming-kit"><strong>The Kit</strong></a>
  </p>
</div>

---

> [!NOTE]
> **Status: v0.1.0**, verified against a real kit on a Windows cabinet. The client, the policy gate, the SQLite
> memory, the CLI and the full test suite work. New and not yet released: a new session starts from a digest of the
> earlier ones (M1), and the kit's MCP server can be used as transport (M4, not yet run on a cabinet). Open:
> packaging, and a complete catalog snapshot of kit v0.3.0. See [docs/HANDOFF.md](docs/HANDOFF.md), the [CHANGELOG](CHANGELOG.md) and the [ROADMAP](ROADMAP.md).

---

## 💡 What is Fried's Retrogaming Agent?

[Fried's Retrogaming Kit](https://github.com/kburna243/frieds-retrogaming-kit) knows how to set up and repair a
Windows pinball and lightgun cabinet. This repository puts a language model in front of it: you describe the problem
("my gun does not work in game X"), the model reads the kit's health check and component list, and proposes the one
step that should fix it.

It is a **client of the kit API and nothing else**. It does not know how to install ViGEmBus or where RetroBat
lives. It does not read kit files, kit state or the registry. It asks the kit which operations exist and calls
those. And it never changes the cabinet on its own: every change is a dry run first, then a plan you read, then your
yes at the terminal.

```
model (local Ollama or an OpenAI-compatible endpoint)
   │  tool calls: cabinet_status, run_step, …
   ▼
PolicyEngine  ── dry run → plan → a human says yes → -Apply → verify
   │  one JSON document over stdio
   ▼
<kit>\api\Invoke-KitApi.ps1        ← the only door into the cabinet
```

---

## 🏛️ The Three Rules

### 1. 🛑 A change is a dry run first
The model never sees an `apply` or `approved` parameter. Only `PolicyEngine` sets them, and only after the kit's own
WhatIf output became a plan and a person said yes to exactly that plan. A yes is bound to the plan's SHA-256 digest,
used once, and the database refuses a decision that did not come from a human.

### 2. 🎯 Interactive steps stay with you
`step.pinball.08-screens` and `step.lightgun.09-verify` need hands at the cabinet. The kit's wizard does those; the
harness refuses them before any process starts, and the model is told to hand them to you.

### 3. 🔒 Nothing personal leaves the machine
Everything sent to a cloud model goes through the kit's `-Anonymize`. On top of that, the gateway refuses to send a
body that still contains a profile path, a user name, a SID or a private IP. With a local model nothing leaves the
PC at all.

---

## 🚦 Feature Status

| Area | Status | What it does |
| :--- | :--- | :--- |
| **Kit client** (stdio, one process, one JSON document) | ✅ Verified on a real kit | `Invoke-KitApi.ps1`, strict `OperationResult` parsing, exit codes per contract |
| **Tools from the live catalog** | ✅ Stable | 9 fixed tools plus `run_step`; read-only level offers reads only |
| **Policy gate** | ✅ Every stage pinned by a test | level → catalog → parameters → dry run → plan → human → `-Apply` → verify |
| **Memory** (SQLite via `node:sqlite`) | ✅ Stable | sessions, messages, tool calls, plans, approvals, kit results, all timestamped |
| **Memory read back** (M1) | 🆕 Unreleased | a new session starts from a fixed-size digest of the last ones; a remembered yes grants nothing |
| **Model gateways** | ✅ Stable | local Ollama or any OpenAI-compatible endpoint; cloud only with `-Anonymize` |
| **CLI `fagent`** | ✅ Stable | `doctor`, `tools`, `status`, `run`, `chat`, `history`; no `--yes` anywhere |
| **Fake cabinet** (`test/kit/`) | ✅ Stable | the kit API as a second implementation, so all tests run on Linux |
| **Packaging** (global install, `--version`) | 🚧 Planned (M2) | see [ROADMAP](ROADMAP.md) |
| **MCP transport** (M4) | 🆕 Unreleased | `--transport mcp` uses the kit's MCP server (kit ≥ 0.3.0); the catalog still comes from `Invoke-KitApi.ps1` |
| **Report mode** (`fagent report`) | 🚧 Planned (M6) | a summary from the audit trail, no kit writes |

---

## 🎛️ Requirements

| Component | For the tests | For a real cabinet |
| :--- | :--- | :--- |
| **Node.js** | 24 or newer | 24 or newer |
| **Operating system** | Linux, macOS or Windows | Windows 10/11 with Windows PowerShell 5.1 |
| **The kit** | not needed (`test/kit/` stands in) | a checkout of [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit) |
| **A model** | not needed (scripted model) | Ollama locally, or an OpenAI-compatible endpoint |

---

## ⚡ Quickstart

### 1. Install and check
```bash
npm install            # dev dependencies only: typescript, vitest, @types/node
npm run check          # typecheck + tests + repo rules
```

### 2. Read the cabinet (no model needed)
```bash
export FAGENT_KIT_ROOT='D:\cabinet\frieds-retrogaming-kit'
node --no-warnings src/cli.ts doctor          # what can be reached, which ApiVersion the kit speaks
node --no-warnings src/cli.ts doctor --transport mcp   # the same over the kit's MCP server (kit >= 0.3.0)
node --no-warnings src/cli.ts status          # the kit's health check, read-only
node --no-warnings src/cli.ts tools --level operator
```

### 3. One change through the gate
```bash
node --no-warnings src/cli.ts run step.lightgun.01-detect --level operator --param RetroBatRoot=C:\RetroBat
```
You see the plan the kit produced in its dry run and are asked once. Anything but a yes leaves the cabinet as it was.

### 4. Talk to the cabinet
```bash
node --no-warnings src/cli.ts chat --model qwen2.5:3b          # local model via Ollama
node --no-warnings src/cli.ts chat --demo                      # no model at all: a scripted diagnosis
node --no-warnings src/cli.ts history --last 20                # what the harness did, from its own database
```
`chat` starts with a short digest of the earlier sessions; `--no-memory` starts without it.

> [!TIP]
> The level is `read-only` unless you pass `--level operator`. There is no level that skips the dry run or your yes.

The full Windows check, on the cabinet:
`powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`

---

## 🗂️ What is Here

| Path | What it is |
| :--- | :--- |
| `src/kit/` | the API client: argv building, one-shot stdio transport, MCP transport, `OperationResult` parsing, catalog → tool schemas |
| `src/policy/` | the gate: dry run first, plan, one human yes, then `-Apply`, then verify; every rule lives here |
| `src/db/` | SQLite memory via `node:sqlite` |
| `src/llm/` | model gateways, the anonymization guard, a scripted model for tests |
| `src/agent/` | the loop, the system prompt and the memory digest |
| `src/cli.ts` | `fagent` |
| `contract/` | pinned snapshot of the kit API, with provenance |
| `test/kit/` | **the fake cabinet**: the kit API reimplemented in plain JS |
| `tools/` | contract snapshot updater, drift test, repo rule checker, Windows smoke test |

---

## 🛡️ Safety & Privacy Principles

1. **The kit decides what the cabinet can do.** The harness only calls operations from the kit's own catalog. If
   something is missing, it is a request for the kit, not a workaround here.
2. **A person approves every change.** No `--yes`, no `--approve`, no environment variable and no level changes that.
   A scripted run stops at the plan.
3. **Every call is on record.** Reads, dry runs, applies, refusals and decisions land in the SQLite audit trail with
   a timestamp.
4. **The doctor is the truth.** What the harness remembers is history. The current state of the cabinet is what
   `status` answers now.
5. **Local first.** No telemetry, no accounts. Only `src/llm/` may open a connection, and a test fails the build if
   anything else tries.
6. **No personal data in the repository.** `tools/check-repo-rules.mjs` scans every file in CI; examples use
   `D:\Pinball`, `C:\RetroBat` and the invented Friedhelm.

---

## 📖 Documentation

| Guide | Description |
| :--- | :--- |
| **[Policy](docs/POLICY.md)** | The gate stage by stage, levels, and why approvals are bound, single-use and human. |
| **[Architecture](docs/ARCHITECTURE.md)** | The boundary to the kit, the layers, and what the fake cabinet proves. |
| **[Handoff](docs/HANDOFF.md)** | What is done, what is deliberately open, and how to continue in a cloud session. |
| **[Contract](contract/)** | The pinned kit API snapshot and where it came from. |
| **[Contributing](CONTRIBUTING.md)** · **[Security](SECURITY.md)** | How to work on this, and how to report a problem. |
| **[Changelog](CHANGELOG.md)** · **[Roadmap](ROADMAP.md)** | What changed per version and what comes next. |

---

## 🤝 Credits

- **[Fried's Retrogaming Kit](https://github.com/kburna243/frieds-retrogaming-kit)**: everything this harness can do
  on a cabinet, the kit does. The mascot is the kit's.
- **[Ollama](https://ollama.com/)** for running models on the cabinet itself.
- **Node.js** for `node:sqlite` and type stripping, which is why this repository has no runtime dependencies.

---

## 📄 License

This project is licensed under the terms of the **MIT License**.
See the [LICENSE](LICENSE) file for details.
Copyright (c) 2026 Friedrich Börner.
