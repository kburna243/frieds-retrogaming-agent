<div align="center">
  <img src="https://raw.githubusercontent.com/kburna243/frieds-retrogaming-kit/main/docs/images/character-controller.svg" alt="Maskottchen von Fried's Retrogaming Kit" width="140" style="margin-bottom: 12px;" />
  <h1>🤖 Fried's Retrogaming Agent</h1>
  <p><strong>Ein Modell, das deinen Automaten untersucht, und ein Gate, das dafür sorgt, dass du ja sagst</strong></p>

  [![Kit API](https://img.shields.io/badge/Kit%20API-v1-ff2d95?style=for-the-badge)](contract/API.md)
  [![Node](https://img.shields.io/badge/Node-24%2B-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)](package.json)
  [![Laufzeit-Abhängigkeiten](https://img.shields.io/badge/Laufzeit--Abh%C3%A4ngigkeiten-0-3DDC84?style=for-the-badge)](package.json)
  [![Lizenz: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow?style=for-the-badge)](LICENSE)
  [![Dokumentation](https://img.shields.io/badge/Doku-English%20%7C%20Deutsch-3DDC84?style=for-the-badge&logo=gitbook&logoColor=white)](docs/)
  [![CI](https://img.shields.io/github/actions/workflow/status/kburna243/frieds-retrogaming-agent/ci.yml?branch=main&style=for-the-badge&label=CI)](https://github.com/kburna243/frieds-retrogaming-agent/actions/workflows/ci.yml)
  [![Mensch entscheidet](https://img.shields.io/badge/--yes-gibt%20es%20nicht-FFC857?style=for-the-badge)](docs/POLICY.md)

  <p>
    <a href="README.md"><strong>English</strong></a> •
    <a href="README.de.md"><strong>Deutsch</strong></a> •
    <a href="docs/POLICY.md"><strong>Policy</strong></a> •
    <a href="docs/ARCHITECTURE.md"><strong>Architektur</strong></a> •
    <a href="docs/HANDOFF.md"><strong>Übergabe</strong></a> •
    <a href="https://github.com/kburna243/frieds-retrogaming-kit"><strong>Das Kit</strong></a>
  </p>
</div>

---

> [!NOTE]
> **Stand: v0.1.0**, gegen ein echtes Kit auf einem Windows-Automaten geprüft. Client, Policy-Gate, SQLite-Gedächtnis,
> CLI und die ganze Testsuite funktionieren. Neu und noch nicht veröffentlicht: Eine neue Sitzung beginnt mit einer
> Zusammenfassung der früheren (M1), der MCP-Server des Kits lässt sich als Transport nutzen (M4, noch nicht am
> Automaten gelaufen), `npm i -g .` installiert `fagent` (M2), `fagent report` fasst einen Zeitraum zusammen (M6),
> und die Datenbank migriert sich selbst. Der Vertrag ist auf Kit v0.3.0 festgeschrieben. Streaming und `chat --continue`
> sind drin (M3). Offen: Szenarien (M5). Siehe [docs/HANDOFF.md](docs/HANDOFF.md), das [CHANGELOG](CHANGELOG.md)
> und die [ROADMAP](ROADMAP.md).

---

## 💡 Was ist Fried's Retrogaming Agent?

[Fried's Retrogaming Kit](https://github.com/kburna243/frieds-retrogaming-kit) weiß, wie man einen Windows-Automaten
für Flipper und Lightgun einrichtet und repariert. Dieses Repository stellt ein Sprachmodell davor: Du beschreibst
das Problem („meine Gun geht in Spiel X nicht“), das Modell liest den Gesundheitscheck und die Komponentenliste des
Kits und schlägt den einen Schritt vor, der es beheben sollte.

Es ist **nur ein Client der Kit-API, sonst nichts**. Der Harness weiß nicht, wie man ViGEmBus installiert oder wo
RetroBat liegt. Er liest keine Kit-Dateien, keinen Kit-Zustand, keine Registry. Er fragt das Kit, welche Operationen
es gibt, und ruft genau diese auf. Und er ändert den Automaten nie von sich aus: Jede Änderung ist erst ein Dry Run,
dann ein Plan, den du liest, dann dein Ja am Terminal.

```
Modell (lokales Ollama oder ein OpenAI-kompatibler Endpunkt)
   │  Tool-Aufrufe: cabinet_status, run_step, …
   ▼
PolicyEngine  ── Dry Run → Plan → ein Mensch sagt ja → -Apply → Verifikation
   │  ein JSON-Dokument über stdio
   ▼
<kit>\api\Invoke-KitApi.ps1        ← die einzige Tür zum Automaten
```

---

## 🏛️ Die drei Regeln

### 1. 🛑 Eine Änderung ist zuerst ein Dry Run
Das Modell sieht nie einen Parameter `apply` oder `approved`. Nur `PolicyEngine` setzt sie, und nur nachdem die
WhatIf-Ausgabe des Kits zu einem Plan wurde und ein Mensch genau zu diesem Plan ja gesagt hat. Ein Ja ist an den
SHA-256-Digest des Plans gebunden, gilt genau einmal, und die Datenbank lehnt eine Entscheidung ab, die nicht von
einem Menschen kam.

### 2. 🎯 Interaktive Schritte bleiben bei dir
`step.pinball.08-screens` und `step.lightgun.09-verify` brauchen Hände am Automaten. Die erledigt der Assistent des
Kits; der Harness lehnt sie ab, bevor ein Prozess startet, und das Modell soll sie an dich übergeben.

### 3. 🔒 Nichts Persönliches verlässt den Rechner
Alles, was an ein Cloud-Modell geht, läuft durch `-Anonymize` des Kits. Zusätzlich verweigert das Gateway jede
Anfrage, die noch einen Profilpfad, einen Benutzernamen, eine SID oder eine private IP enthält. Mit einem lokalen
Modell verlässt gar nichts den PC.

---

## 🚦 Funktionsstand

| Bereich | Stand | Was es tut |
| :--- | :--- | :--- |
| **Kit-Client** (stdio, ein Prozess, ein JSON-Dokument) | ✅ Am echten Kit geprüft | `Invoke-KitApi.ps1`, strenges `OperationResult`-Parsing, Exit-Codes laut Vertrag |
| **Tools aus dem Live-Katalog** | ✅ Stabil | 9 feste Tools plus `run_step`; die Stufe read-only bietet nur Lese-Tools |
| **Policy-Gate** | ✅ Jede Stufe durch einen Test festgenagelt | Stufe → Katalog → Parameter → Dry Run → Plan → Mensch → `-Apply` → Verifikation |
| **Gedächtnis** (SQLite über `node:sqlite`) | ✅ Stabil | Sitzungen, Nachrichten, Tool-Aufrufe, Pläne, Freigaben, Kit-Ergebnisse, alle mit Zeitstempel |
| **Gedächtnis wird gelesen** (M1) | 🆕 Unveröffentlicht | eine neue Sitzung beginnt mit einer Zusammenfassung fester Größe; ein gemerktes Ja gibt nichts frei |
| **Modell-Gateways** | ✅ Stabil | lokales Ollama oder jeder OpenAI-kompatible Endpunkt; Cloud nur mit `-Anonymize` |
| **CLI `fagent`** | ✅ Stabil | `doctor`, `tools`, `status`, `run`, `chat`, `history`; nirgends ein `--yes` |
| **Fake-Automat** (`test/kit/`) | ✅ Stabil | die Kit-API als zweite Implementierung, damit alle Tests unter Linux laufen |
| **Packaging** (M2) | 🆕 Unveröffentlicht | `npm i -g .` installiert `fagent`, `fagent --version`; in der CI unter Linux und Windows geprüft |
| **Datenbank-Migrationen** | 🆕 Unveröffentlicht | eine ältere Harness-Datenbank wird beim Öffnen nachgezogen; eine neuere wird abgelehnt |
| **MCP-Transport** (M4) | 🆕 Unveröffentlicht | `--transport mcp` nutzt den MCP-Server des Kits (Kit ≥ 0.3.0); der Katalog kommt weiter von `Invoke-KitApi.ps1` |
| **Berichtsmodus** (M6) | 🆕 Unveröffentlicht | `fagent report --since 7d` fasst einen Zeitraum aus dem Audit-Trail zusammen; liest nur die Datenbank, braucht keinen Kit-Pfad |

---

## 🎛️ Voraussetzungen

| Komponente | Für die Tests | Für einen echten Automaten |
| :--- | :--- | :--- |
| **Node.js** | 24 oder neuer | 24 oder neuer |
| **Betriebssystem** | Linux, macOS oder Windows | Windows 10/11 mit Windows PowerShell 5.1 |
| **Das Kit** | nicht nötig (`test/kit/` springt ein) | ein Checkout von [frieds-retrogaming-kit](https://github.com/kburna243/frieds-retrogaming-kit) |
| **Ein Modell** | nicht nötig (Skript-Modell) | Ollama lokal oder ein OpenAI-kompatibler Endpunkt |

---

## ⚡ Schnellstart

### 1. Installieren und prüfen
```bash
npm install            # nur Entwicklungs-Abhängigkeiten: typescript, vitest, @types/node
npm run check          # Typecheck + Tests + Repo-Regeln
npm i -g .             # baut dist/ und installiert den Befehl fagent
fagent --version
```
Ohne globale Installation startet `node --no-warnings src/cli.ts <befehl>` dieselbe CLI aus den Quellen.

### 2. Den Automaten lesen (ohne Modell)
```bash
export FAGENT_KIT_ROOT='D:\cabinet\frieds-retrogaming-kit'
fagent doctor                  # was erreichbar ist, welche ApiVersion das Kit spricht
fagent doctor --transport mcp  # dasselbe über den MCP-Server des Kits (Kit >= 0.3.0)
fagent status                  # der Gesundheitscheck des Kits, nur lesend
fagent tools --level operator
```

### 3. Eine Änderung durch das Gate
```bash
fagent run step.lightgun.01-detect --level operator --param RetroBatRoot=C:\RetroBat
```
Du siehst den Plan aus dem Dry Run des Kits und wirst einmal gefragt. Alles außer einem Ja lässt den Automaten, wie
er war.

### 4. Mit dem Automaten reden
```bash
fagent chat --model qwen2.5:3b  # lokales Modell über Ollama
fagent chat --demo              # ganz ohne Modell: eine geskriptete Diagnose
fagent history --last 20        # was der Harness getan hat, aus seiner Datenbank
fagent report --since 7d        # eine Zusammenfassung der letzten Woche für Menschen (--json für Maschinen)
```
`chat` beginnt mit einer kurzen Zusammenfassung der früheren Sitzungen (`--no-memory` beginnt ohne) und zeigt die
Antwort, während sie entsteht (`--no-stream` wartet auf die ganze). `--continue` setzt das letzte Gespräch fort, nur
seine Worte: eine Änderung braucht weiter dein Ja. `--max-rounds` legt fest, wie viele Runden eine Frage dauern darf,
und `--json` gibt bei jedem Befehl ein JSON-Dokument aus.

> [!TIP]
> Die Stufe ist `read-only`, solange du nicht `--level operator` angibst. Es gibt keine Stufe, die den Dry Run oder
> dein Ja überspringt.

Der vollständige Windows-Check, am Automaten:
`powershell -NoProfile -ExecutionPolicy Bypass -File tools\Start-SmokeTest.ps1 -KitRoot D:\cabinet\frieds-retrogaming-kit`

---

## 🗂️ Was hier liegt

| Pfad | Was es ist |
| :--- | :--- |
| `src/kit/` | API-Client: argv-Bau, One-Shot-stdio-Transport, MCP-Transport, `OperationResult`-Parsing, Katalog → Tool-Schemata |
| `src/policy/` | das Gate: erst Dry Run, Plan, ein Ja eines Menschen, dann `-Apply`, dann Verifikation |
| `src/db/` | SQLite-Gedächtnis über `node:sqlite` |
| `src/llm/` | Modell-Gateways, die Anonymisierungs-Prüfung, ein Skript-Modell für Tests |
| `src/agent/` | die Schleife, der System-Prompt und die Gedächtnis-Zusammenfassung |
| `src/cli.ts` | `fagent` |
| `contract/` | festgeschriebener Snapshot der Kit-API, mit Herkunftsangabe |
| `test/kit/` | **der Fake-Automat**: die Kit-API in reinem JS |
| `tools/` | Snapshot-Aktualisierung, Drift-Test, Regel-Prüfung, Windows-Smoke-Test |

---

## 🛡️ Sicherheit & Datenschutz

1. **Was der Automat kann, entscheidet das Kit.** Der Harness ruft nur Operationen aus dem Katalog des Kits auf.
   Fehlt etwas, ist das ein Wunsch ans Kit, kein Workaround hier.
2. **Jede Änderung gibt ein Mensch frei.** Kein `--yes`, kein `--approve`, keine Umgebungsvariable und keine Stufe
   ändert das. Ein geskripteter Lauf endet beim Plan.
3. **Jeder Aufruf ist protokolliert.** Lesen, Dry Runs, Anwenden, Ablehnungen und Entscheidungen landen mit
   Zeitstempel im SQLite-Audit-Trail.
4. **Der Doctor ist die Wahrheit.** Was der Harness sich merkt, ist Vergangenheit. Den aktuellen Zustand des
   Automaten sagt `status`, jetzt.
5. **Lokal zuerst.** Keine Telemetrie, keine Konten. Nur `src/llm/` darf eine Verbindung öffnen, und ein Test lässt
   den Build scheitern, wenn etwas anderes es versucht.
6. **Keine persönlichen Daten im Repository.** `tools/check-repo-rules.mjs` prüft in der CI jede Datei; Beispiele
   verwenden `D:\Pinball`, `C:\RetroBat` und den erfundenen Friedhelm.

---

## 📖 Dokumentation

| Anleitung | Beschreibung |
| :--- | :--- |
| **[Policy](docs/POLICY.md)** | Das Gate Stufe für Stufe, die Berechtigungsstufen, und warum Freigaben gebunden, einmalig und menschlich sind. |
| **[Architektur](docs/ARCHITECTURE.md)** | Die Grenze zum Kit, die Schichten, und was der Fake-Automat beweist. |
| **[Übergabe](docs/HANDOFF.md)** | Was fertig ist, was bewusst offen ist, und wie man in einer Cloud-Sitzung weitermacht. |
| **[Vertrag](contract/)** | Der festgeschriebene Snapshot der Kit-API und woher er stammt. |
| **[Mitmachen](CONTRIBUTING.md)** · **[Sicherheit](SECURITY.md)** | Wie man hier arbeitet, und wie man ein Problem meldet. |
| **[Changelog](CHANGELOG.md)** · **[Roadmap](ROADMAP.md)** | Was sich pro Version geändert hat und was als Nächstes kommt. |

Die Dokumente unter `docs/` sind auf Englisch.

---

## 🤝 Danke

- **[Fried's Retrogaming Kit](https://github.com/kburna243/frieds-retrogaming-kit)**: Alles, was dieser Harness an
  einem Automaten kann, macht das Kit. Das Maskottchen gehört dem Kit.
- **[Ollama](https://ollama.com/)**, damit Modelle direkt auf dem Automaten laufen.
- **Node.js** für `node:sqlite` und Type Stripping, weshalb dieses Repository ohne Laufzeit-Abhängigkeiten auskommt.

---

## 📄 Lizenz

Dieses Projekt steht unter der **MIT-Lizenz**.
Details in der Datei [LICENSE](LICENSE).
Copyright (c) 2026 Friedrich Börner.
