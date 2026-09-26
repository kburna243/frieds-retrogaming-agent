# Live Test Report: Reale Cabinet-Verifikation (M1, M2, M4, M5)

> **Datum:** 2026-09-26  
> **Host:** Windows 10/11 x64 (Cabinet / Automat)  
> **Node:** v24.19.0 (native `node:sqlite`)  
> **PowerShell:** Windows PowerShell 5.1  
> **Kit-Stand:** Fried's Retrogaming Kit v0.3.0 (`b5df22f`)  
> **Agent-Stand:** `main` (97/97 Vitest-Tests grün)  

---

## 1. Übersicht & Ziel

Dieser Bericht dokumentiert die am physischen Automaten/Rechner durchgeführten Live-Tests, die nur mit Zugriff auf die reale Kit-Installation (`api\Invoke-KitApi.ps1` und `api\Start-KitMcpServer.ps1`) und lokale Modell-Inferenz (Ollama) möglich sind.

Er dient als Nachweis und Übergabe für Claude Code Cloud-Sessions zur Weiterarbeit an **M3** (Terminal-Bedienung: Streaming, `chat --continue`) und **M6** (Report-Modus).

---

## 2. Test 1: `fagent doctor --transport mcp` (M4 Verifikation)

Der MCP-Transport über `stdio` gegen den MCP-Server des Kits (`api\Start-KitMcpServer.ps1`) wurde ausgeführt.

```text
PS D:\cabinet\frieds-retrogaming-agent> $env:FAGENT_KIT_ROOT = 'D:\cabinet\frieds-retrogaming-kit'
PS D:\cabinet\frieds-retrogaming-agent> node --no-warnings src/cli.ts doctor --transport mcp

OK    node            v24.19.0 (node:sqlite needs >= 24)
OK    platform        win32 — the kit is reached over Windows PowerShell 5.1, so real calls run on the cabinet
OK    kit root        D:\cabinet\frieds-retrogaming-kit
OK    database        C:\Users\Friedhelm\AppData\Local\frieds-retrogaming-agent\harness.db
OK    model           local · (no model: this command does not need one) · http://127.0.0.1:11434/v1
OK    anonymization   every kit call uses -Anonymize
OK    level           read-only
OK    kit api         ApiVersion 1.0 · 34 operations · 5 tools at this level
OK    transport       mcp-stdio · kit 0.3.0
OK    schema          harness database at schema version 2
INFO  wizard-only     step.pinball.08-screens, step.lightgun.09-verify
```

### Befund:
- ✅ **MCP Server Erkennung:** Zeigt sauber `transport: mcp-stdio · kit 0.3.0`.
- ✅ **Schema Migration (M2):** SQLite-Datenbank erfolgreich auf `schema version 2` migriert.
- ✅ **API-Katalog:** 34 Live-Operationen erkannt.

---

## 3. Test 2: Live Status & Tool-Katalog über MCP

Abfrage des Systemzustands direkt über das Model Context Protocol:

```bash
node --no-warnings src/cli.ts status --transport mcp
```
**Ausgabe:**
```text
Result: 0 error(s), 0 warning(s), 11 OK
level Ok · ok 11 · info 9 · warn 0 · error 0

nothing to look at: every check is OK
```

Werkzeugkatalog auf Stufe `operator`:
```text
ApiVersion 1.0 · 34 operations in the kit · 10 tools at level operator

Read   cabinet_operations   → operations
Read   cabinet_status       → status
Read   cabinet_components   → components
Read   list_backups         → backups.list  (Root:array)
Read   check_backup         → backup.check  (Path:string)
Change restore_backup       → backup.restore  (Path:string AllowedRoot:array)
Change support_bundle       → support.bundle  (Destination:string)
Change export_profile       → profile.export  (Suite:string Destination:string ...)
Change import_profile       → profile.import  (Path:string PupDatabasePath:string ...)
Change run_step             → 21 steps  (operation:string parameters:object)
```

---

## 4. Test 3: Policy-Gate & Human-Approval (`run`)

Ein schreibender Aufruf (`support.bundle`) wurde getestet, wobei die Bestätigung mit `no` abgelehnt wurde:

```text
────────────────────────────────────────────────────────────────────────
Operation : support.bundle
Parameters: (none)
Kit says  : Dry run: a support bundle would be written to ...\support-bundle_20260926-070051.zip.
(paths and names in this plan are anonymized: -Anonymize was used)
────────────────────────────────────────────────────────────────────────
Apply this exact change? Type yes to apply, anything else refuses. > refused ("no") — nothing was changed
not applied: you declined ("no"). Nothing changed.
```
- ✅ Der Plan wurde als Dry-Run (`-WhatIf`) angezeigt.
- ✅ Eingabe `no` lehnte die Aktion ab.
- ✅ Audit-Trail verzeichnete die Ablehnung in der SQLite-Datenbank.

---

## 5. Test 4: Lokales Modell via Ollama (Meilenstein M5 Verifikation)

### Setup:
- Ollama Server aktiv auf `http://127.0.0.1:11434/v1`.
- Getestetes Modell: `llama3.2:3b`.

### Bugfix in `src/cli.ts`:
Im Code von `runChat` wurde `createHarness(config, { human, gateway: scripted ?? new ScriptedModelGateway([{ text: '' }]) })` aufgerufen. Wenn `--demo` nicht aktiv war (`scripted === undefined`), wurde fälschlicherweise immer das leere `ScriptedModelGateway` injiziert, statt das echte `OpenAiCompatibleGateway` zu erzeugen.  
**Behoben:** `gateway: scripted` übergeben und `run.answer` bei `--message` ausgegeben.

### Live-Lauf mit echtem lokalem Modell:
```bash
node --no-warnings src/cli.ts chat --model llama3.2:3b --message "Wie ist der Status des Kabinetts?"
```

**Ergebnis:**
1. **Tool-Call ausgeführt:**
   `→ cabinet_status {}`
   `[read] Ok · Result: 0 error(s), 0 warning(s), 11 OK`
2. **Antwort von `llama3.2:3b`:**
   > *„Der Status des Kabinetts ist wie folgt:*  
   > *- Der Kit-Status ist 'Ok'.*  
   > *- Die Systeme Windows, PowerShell und 64-bit Windows sind in Ordnung.*  
   > *- Das File-System des Kit-Folder ist in Ordnung.*  
   > *- Die DolphinBar ist in Mode 4 verbunden und die Refresh-Rate beträgt 1920x1080 bei 60 Hz.*  
   > *- Die ViGEmBus-Installation ist erfolgreich.*  
   > *- Die Gunmote-Installation ist erfolgreich und ein Autostart-Task ist eingerichtet.*  
   > *Es gibt keine Fehler oder Warnungen.“*
3. **Audit:**
   `(2 rounds · 1 tool calls · 0 refused · audit: harness.db)`

Damit ist **M5 (Szenarien mit lokalem Modell)** am Automaten erfolgreich verifiziert!

---

## 6. Nächste Schritte für Claude Code Cloud-Session

### Zu erledigen:

1. **Meilenstein M3 (Bedienung im Terminal):**
   - **Streaming:** Token-Streaming für Assistenten-Ausgaben (insbesondere bei längeren Erklärungen lokaler Modelle hilfreich).
   - **`chat --continue`:** Fortsetzen einer früheren Sitzung anhand der `session_id` aus der SQLite-Datenbank.
   - **`--json` Konsistenz:** Sicherstellen, dass alle CLI-Subkommandos strukturierte JSON-Ausgaben liefern, wenn `--json` gesetzt ist.

2. **Meilenstein M6 (Report-Modus):**
   - Befehl `fagent report [--since 7d]`:
   - Aggregiert die Tabelle `tool_calls` und `approvals` aus `harness.db`.
   - Gibt eine saubere Markdown- oder Text-Zusammenfassung über durchgeführte Änderungen, abgelehnte Aktionen und aufgetretene Warnungen aus.
   - Keine Kit-Schreiboperationen.

### Test-Status im Repository:
- Alle **97 Tests** in `test/` laufen sauber durch.
- `npm run check` (Typecheck, Vitest, Repo-Regeln) ist **grün**.
