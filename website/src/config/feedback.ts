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
  titleEn?: string;
  why: string;
  whyEn?: string;
  tag: string;
  prefill: Partial<ReportDraft>;
}

export const wantedSystems: WantedSystem[] = [
  {
    id: "win10",
    title: "Windows 10 + PowerShell 5.1",
    titleEn: "Windows 10 + PowerShell 5.1",
    why: "Der Kit-Kern läuft auf PS 5.1 – getestet wird fast nur auf Windows 11.",
    whyEn: "Kit core runs on PS 5.1 – real cabinets mostly tested on Windows 11.",
    tag: "OS",
    prefill: { cabinet: "both", os: "Windows 10" },
  },
  {
    id: "sinden-lightgun",
    title: "Sinden Lightgun (im Feinschliff)",
    titleEn: "Sinden Lightgun (Finalizing)",
    why: "Wird aktuell finalisiert – Kalibrierung, weißer Rand & Recoil-Profile im Test.",
    whyEn: "Currently being finalized – camera tracking, white border & recoil profiles.",
    tag: "Lightgun",
    prefill: {
      cabinet: "lightgun",
      lightgun: ["Sinden"],
      command: "fagent run step.lightgun.01-detect --level operator",
    },
  },
  {
    id: "fp-bam",
    title: "Future Pinball + BAM",
    titleEn: "Future Pinball + BAM",
    why: "Screen-Geometrie und Backglass jenseits von VPX.",
    whyEn: "Screen geometry and backglass beyond standard VPX.",
    tag: "Pinball",
    prefill: { cabinet: "pinball", pinball: ["Future Pinball"] },
  },
  {
    id: "pinup",
    title: "PinUP Popper (neueste Version)",
    titleEn: "PinUP Popper (Latest)",
    why: "Schema-Änderungen an der Popper-SQLite-DB.",
    whyEn: "Schema changes and SQLite DB migration verification.",
    tag: "Pinball",
    prefill: { cabinet: "pinball", pinball: ["Visual Pinball X", "PinUP Popper"] },
  },
  {
    id: "teknoparrot",
    title: "TeknoParrot aktuell + DemulShooter",
    titleEn: "TeknoParrot + DemulShooter",
    why: "Die XML-Profile ändern sich mit jedem Release.",
    whyEn: "Arcade shooter XML profiles change across game releases.",
    tag: "Lightgun",
    prefill: { cabinet: "lightgun", frontends: ["TeknoParrot", "DemulShooter"] },
  },
  {
    id: "models",
    title: "Andere Ollama-Modelle (Llama 3, Mistral, 7B+)",
    titleEn: "Other Ollama Models (Llama 3, Mistral, 7B+)",
    why: "Tool-Call-Qualität außerhalb von Qwen 2.5.",
    whyEn: "Tool calling accuracy outside recommended Qwen 2.5.",
    tag: "LLM",
    prefill: { model: "Ollama · llama3", command: "fagent chat --model …" },
  },
  {
    id: "mcp",
    title: "MCP-Transport auf fremder Hardware",
    titleEn: "MCP Transport on Remote Hardware",
    why: "--transport mcp gegen Kit ≥ 0.3.0 auf anderen Rechnern.",
    whyEn: "--transport mcp against Kit >= 0.3.0 on external machines.",
    tag: "Transport",
    prefill: { transport: "mcp", command: "fagent doctor --transport mcp" },
  },
  {
    id: "unix",
    title: "Linux / macOS mit Fake-Cabinet",
    titleEn: "Linux / macOS Fake Cabinet",
    why: "node:sqlite & Type-Stripping auf Node 24 außerhalb der CI.",
    whyEn: "node:sqlite & type stripping on Node 24 outside CI.",
    tag: "Dev",
    prefill: { cabinet: "other", os: "Linux (Fake-Cabinet)", model: "Kein Modell (nur CLI / --demo)" },
  },
  {
    id: "diy-guns",
    title: "Gun4IR · AimTrak (DIY-Lightguns)",
    titleEn: "Gun4IR · AimTrak (DIY Lightguns)",
    why: "Hardware-Fakten für alternative Infrarot- und LED-Systeme gesucht.",
    whyEn: "Hardware facts for infrared and LED arcade lightgun systems.",
    tag: "Hardware",
    prefill: { kind: "idea", cabinet: "lightgun", lightgun: ["Gun4IR"] },
  },
];
