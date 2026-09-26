# frieds-retrogaming-agent

Der Agent-Harness für das [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit). Er plant,
erinnert und handelt an einem Retro-Automaten — und er ist **nur ein Client der Kit-API**, sonst nichts.

Der Harness weiß nicht, wie man ViGEmBus installiert. Er weiß nicht, wo RetroBat liegt. Er liest keine Kit-Dateien,
keinen Kit-Zustand, keine Registry. Er fragt das Kit, was es gibt, und ruft genau diese Operationen auf. Das
Verhalten des Automaten definiert das Kit; dieses Repository legt nur ein Modell und ein Gedächtnis drumherum.

```
Modell (lokales Ollama oder ein OpenAI-kompatibler Endpunkt)
   │  Tool-Aufrufe: cabinet_status, run_step, …
   ▼
PolicyEngine  ── Dry Run → Plan → ein Mensch sagt ja → -Apply → Verifikation
   │  ein JSON-Dokument über stdio
   ▼
<kit>\api\Invoke-KitApi.ps1        ← die einzige Tür zum Automaten
```

## Was hier liegt

| Pfad | Was es ist |
| --- | --- |
| `src/kit/` | API-Client: argv-Bau, One-Shot-stdio-Transport, `OperationResult`-Parsing, Katalog → Tool-Schemata |
| `src/policy/` | das Gate: erst Dry Run, Plan, ein Ja eines Menschen, dann `-Apply`, dann Verifikation |
| `src/db/` | SQLite-Gedächtnis (Sitzungen, Nachrichten, Tool-Aufrufe, Pläne, Freigaben, Kit-Ergebnisse) über `node:sqlite` |
| `src/llm/` | Modell-Gateways (OpenAI-kompatibel), die Anonymisierungs-Prüfung, ein Skript-Modell für Tests |
| `src/agent/` | die Schleife und der System-Prompt |
| `src/cli.ts` | `fagent` — doctor, tools, status, run, chat, history |
| `contract/` | festgeschriebener Snapshot der Kit-API, mit Herkunftsangabe |
| `test/kit/` | **der fake Automat** — die Kit-API in reinem JS, damit die Tests überall laufen |
| `tools/` | Snapshot-Aktualisierung, Drift-Test, Regel-Prüfung, Windows-Smoke-Test |
| `docs/` | Architektur, Policy, und die Übergabe für alle, die hier weitermachen |

Keine Laufzeit-Abhängigkeiten. Node 24 bringt `node:sqlite` mit, die Installation ist `typescript`, `vitest`, `@types/node`.

## Schnellstart

Braucht Node ≥ 24. Für die Tests braucht man sonst nichts — und kein Windows.

```bash
npm install
npm run check          # Typecheck + Tests + Regel-Prüfung
```

Gegen einen echten Automaten (Windows, PowerShell 5.1, Kit-Checkout):

```powershell
$env:FAGENT_KIT_ROOT = 'D:\cabinet\frieds-retrogaming-kit'
node --no-warnings src/cli.ts tools --level operator
node --no-warnings src/cli.ts status
node --no-warnings src/cli.ts run step.lightgun.01-detect --param RetroBatRoot=C:\RetroBat
node --no-warnings src/cli.ts chat --model qwen2.5:3b
```

Der vollständige Windows-Test läuft auf dem Automaten:
`powershell -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`.

## Die drei Regeln, aus denen der ganze Code folgt

1. **Eine Änderung ist erst ein Dry Run.** Das Modell sieht niemals einen Parameter `apply` oder `approved`; nur die
   `PolicyEngine` setzt sie — und erst, nachdem die WhatIf-Ausgabe des Kits ein Plan geworden ist und ein Mensch
   genau diesem Plan zugestimmt hat.
2. **Interaktive Schritte gibt es nicht zum Anrufen.** `step.pinball.08-screens` und `step.lightgun.09-verify`
   brauchen Hände am Automaten. Das macht der Wizard; der Harness verweigert sie, bevor etwas startet.
3. **Nichts Persönliches verlässt den Rechner.** Alles, was an ein Cloud-Modell geht, läuft über `-Anonymize` des
   Kits, und das Gateway verweigert einen Körper, in dem noch ein Profilpfad, ein Benutzername, eine SID oder eine
   private IP steht.

Einzelheiten: [docs/POLICY.md](docs/POLICY.md) (englisch). Standard-Level ist `read-only`. Es gibt kein `--yes`.

## Stand

Siehe [docs/HANDOFF.md](docs/HANDOFF.md).
