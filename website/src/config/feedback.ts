/**
 * Konfiguration für „System melden“ (Community-Feedback ohne GitHub-Account).
 *
 * Es reicht, EINEN der drei Sendewege zu aktivieren. Reihenfolge, in der die
 * Seite sie benutzt: endpoint → web3formsKey → email. Fehlt alles, bleiben
 * „Report kopieren“ und „Als GitHub-Issue öffnen“ (für Leute mit Account).
 */
export const feedbackConfig = {
  /**
   * Option A (empfohlen): URL des Cloudflare Workers aus `/feedback-worker`.
   * Der Worker legt aus jedem Report ein GitHub-Issue im Repo an – Nutzer
   * brauchen keinen Account, du bekommst alles dort, wo das Projekt lebt.
   * Beispiel: "https://fagent-feedback.<dein-account>.workers.dev"
   */
  endpoint: "",

  /**
   * Option B (ohne eigenen Code): Access-Key von https://web3forms.com
   * (kostenlos, nur E-Mail-Bestätigung). Reports kommen dann per E-Mail.
   */
  web3formsKey: "",

  /**
   * Option C: E-Mail-Adresse für den mailto:-Fallback. Öffnet das Mailprogramm
   * des Nutzers mit fertig ausgefülltem Report.
   */
  email: "",

  /** Repo für „Als GitHub-Issue öffnen“ (nur für Nutzer mit Account). */
  githubRepo: "kburna243/frieds-retrogaming-agent",

  /** Private Sicherheitsmeldungen (z. B. Approval-Bypass) – nie öffentlich. */
  securityUrl: "https://github.com/kburna243/frieds-retrogaming-agent/security/advisories/new",

  /** Vorbelegung der Versionsfelder. */
  versions: { fagent: "0.2.0", kit: "0.3.1" },
};

/* ---------- Auswahllisten ---------- */

export const OS_OPTIONS = [
  "Windows 11",
  "Windows 10",
  "Linux (Fake-Cabinet)",
  "macOS (Fake-Cabinet)",
  "Anderes",
];

export const LIGHTGUN_OPTIONS = [
  "Wiimote + DolphinBar",
  "Sinden",
  "Gun4IR",
  "AimTrak",
  "Andere",
  "Keine",
];

export const PINBALL_OPTIONS = [
  "Visual Pinball X",
  "Future Pinball",
  "PinUP Popper",
  "PinballX",
  "DOF / Toys",
  "Andere",
  "Keine",
];

export const FRONTEND_OPTIONS = ["RetroBat", "TeknoParrot", "DemulShooter", "MAME", "Steam", "Andere"];

export const MODEL_OPTIONS = [
  "Ollama · qwen2.5:3b",
  "Ollama · qwen2.5:7b",
  "Ollama · llama3",
  "Ollama · mistral",
  "OpenAI-kompatibler Endpoint (Cloud)",
  "Kein Modell (nur CLI / --demo)",
  "Anderes",
];

export const COMMAND_OPTIONS = [
  "fagent doctor",
  "fagent doctor --transport mcp",
  "fagent status",
  "fagent tools --level operator",
  "fagent run step.lightgun.01-detect --level operator",
  "fagent run step.pinball.… --level operator",
  "fagent chat --model …",
  "fagent chat --demo",
  "fagent history --last 20",
  "fagent report --since 7d",
  "Installation (npm i -g .)",
];

/* ---------- „Most Wanted“: Systeme, die wir nicht selbst testen können ---------- */

import type { ReportDraft } from "../lib/report";

export interface WantedSystem {
  id: string;
  title: string;
  why: string;
  tag: string;
  prefill: Partial<ReportDraft>;
}

export const wantedSystems: WantedSystem[] = [
  {
    id: "win10",
    title: "Windows 10 + PowerShell 5.1",
    why: "Der Kit-Kern läuft auf PS 5.1 – getestet wird fast nur auf Windows 11.",
    tag: "OS",
    prefill: { cabinet: "both", os: "Windows 10" },
  },
  {
    id: "multi-wiimote",
    title: "3–4 Wiimotes an einer DolphinBar",
    why: "Mehrspieler-Erkennung in step.lightgun.01-detect.",
    tag: "Lightgun",
    prefill: {
      cabinet: "lightgun",
      lightgun: ["Wiimote + DolphinBar"],
      command: "fagent run step.lightgun.01-detect --level operator",
    },
  },
  {
    id: "fp-bam",
    title: "Future Pinball + BAM",
    why: "Screen-Geometrie und Backglass jenseits von VPX.",
    tag: "Pinball",
    prefill: { cabinet: "pinball", pinball: ["Future Pinball"] },
  },
  {
    id: "pinup",
    title: "PinUP Popper (neueste Version)",
    why: "Schema-Änderungen an der Popper-SQLite-DB.",
    tag: "Pinball",
    prefill: { cabinet: "pinball", pinball: ["Visual Pinball X", "PinUP Popper"] },
  },
  {
    id: "teknoparrot",
    title: "TeknoParrot aktuell + DemulShooter",
    why: "Die XML-Profile ändern sich mit jedem Release.",
    tag: "Lightgun",
    prefill: { cabinet: "lightgun", frontends: ["TeknoParrot", "DemulShooter"] },
  },
  {
    id: "models",
    title: "Andere Ollama-Modelle (Llama 3, Mistral, 7B+)",
    why: "Tool-Call-Qualität außerhalb von Qwen 2.5.",
    tag: "LLM",
    prefill: { model: "Ollama · llama3", command: "fagent chat --model …" },
  },
  {
    id: "mcp",
    title: "MCP-Transport auf fremder Hardware",
    why: "--transport mcp gegen Kit ≥ 0.3.0 auf anderen Rechnern.",
    tag: "Transport",
    prefill: { transport: "mcp", command: "fagent doctor --transport mcp" },
  },
  {
    id: "unix",
    title: "Linux / macOS mit Fake-Cabinet",
    why: "node:sqlite & Type-Stripping auf Node 24 außerhalb der CI.",
    tag: "Dev",
    prefill: { cabinet: "other", os: "Linux (Fake-Cabinet)", model: "Kein Modell (nur CLI / --demo)" },
  },
  {
    id: "guns",
    title: "Sinden · Gun4IR · AimTrak",
    why: "Hardware-Fakten für die geplante Abstraktionsschicht (Roadmap).",
    tag: "Roadmap",
    prefill: { kind: "idea", cabinet: "lightgun", lightgun: ["Sinden"] },
  },
];
