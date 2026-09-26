import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Mascot } from "./Mascot";
import { Heading, Icon, Section, Tag } from "./ui";

export function UseCases() {
  const { t } = useLanguage();
  const [active, setActive] = useState(0);

  const cases = [
    {
      id: "lightgun",
      icon: Icon.Crosshair,
      title: t("Intelligente Lightgun-Fehlerbehebung", "Intelligent Lightgun Troubleshooting"),
      user: t(
        "Mein zweiter Wiimote-Controller zielt in House of the Dead 2 daneben.",
        "My second Wiimote controller aims completely off in House of the Dead 2.",
      ),
      steps: [
        { label: "status", text: t("Fragt den Kabinett-Status ab.", "Queries cabinet health status."), state: "done" },
        {
          label: "analyze",
          text: t(
            "Stellt fest: DolphinBar steht auf Mode 1 statt Mode 4, ViGEmBus meldet Konflikt.",
            "Detects: DolphinBar is on Mode 1 instead of Mode 4, ViGEmBus driver reports conflict.",
          ),
          state: "done",
        },
        {
          label: "dry-run",
          text: t("Trockenlauf für step.lightgun.02-hardware.", "Dry run for step.lightgun.02-hardware."),
          state: "done",
        },
        {
          label: "plan",
          text: t(
            "„Ich werde die Kalibrierungsdaten prüfen und ViGEmBus neu einbinden. Bestätigen mit [yes/no]?“",
            "\"I will verify calibration offsets and reconnect ViGEmBus. Confirm with [yes/no]?\"",
          ),
          state: "approval",
        },
        {
          label: "apply",
          text: t("Nach yes: Sichere Ausführung und Erfolgsmessung.", "After yes: safe execution and post-verification."),
          state: "pending",
        },
      ],
      tags: ["Wiimote", "DolphinBar", "ViGEmBus", "DemulShooter"],
    },
    {
      id: "dmd",
      icon: Icon.Monitor,
      title: t("Monitor- & Geometrie-Audit im Virtual Pinball", "Virtual Pinball Screen & Geometry Audit"),
      user: t(
        "Das DMD wird auf dem Backglass-Monitor abgeschnitten.",
        "The DMD display gets cut off on my backglass monitor.",
      ),
      steps: [
        {
          label: "status",
          text: t("Liest DmdDevice.ini über das Kit ein.", "Reads DmdDevice.ini through the kit."),
          state: "done",
        },
        {
          label: "analyze",
          text: t(
            "Erkennt Abweichungen zwischen Bildschirm-Rollen und physischen Koordinaten.",
            "Detects discrepancy between screen roles and physical monitor coordinates.",
          ),
          state: "done",
        },
        {
          label: "compute",
          text: t("Berechnet die Differenz pixelgenau.", "Computes exact pixel offset corrections."),
          state: "done",
        },
        {
          label: "plan",
          text: t(
            "Schlägt Korrektur vor – inklusive automatischem .bak-Backup. [yes/no]?",
            "Proposes fix – including automated .bak backup. [yes/no]?",
          ),
          state: "approval",
        },
        {
          label: "verify",
          text: t("Bounds erneut prüfen, Backup bestätigen.", "Re-verify bounds, confirm backup exists."),
          state: "pending",
        },
      ],
      tags: ["VPX", "DmdDevice.ini", "PinUP Popper", "3 Screens"],
    },
    {
      id: "migrate",
      icon: Icon.Box,
      title: t("Kabinett-Umzug (A → B Migration)", "Cabinet Migration (A → B Machine Export)"),
      user: t(
        "Ich baue ein neues Kabinett und will meine komplette Konfiguration mitnehmen.",
        "I am building a new cabinet and want to migrate my complete configuration cleanly.",
      ),
      steps: [
        {
          label: "export",
          text: t("Konfigurationen in tokenisierte Archive exportieren.", "Export configurations into tokenized archives."),
          state: "done",
        },
        {
          label: "tokens",
          text: t(
            "Pfade werden zu {PinballRoot} und {RetroBatRoot} abstrahiert.",
            "Paths are abstracted to {PinballRoot} and {RetroBatRoot}.",
          ),
          state: "done",
        },
        {
          label: "verify",
          text: t("Manifest & Prüfsummen erzeugen.", "Generate manifest & SHA-256 checksums."),
          state: "done",
        },
        {
          label: "import",
          text: t("Begleiteter Import auf dem Zielrechner. [yes/no]?", "Guided import on target machine. [yes/no]?"),
          state: "approval",
        },
        {
          label: "doctor",
          text: t("Abschließender kit doctor auf Maschine B.", "Final kit doctor diagnostic run on Machine B."),
          state: "pending",
        },
      ],
      tags: ["{PinballRoot}", "{RetroBatRoot}", "Backup", "Migration"],
    },
  ];

  const c = cases[active];

  return (
    <Section id="hardware">
      <Heading
        eyebrow={t("Level 6 · Hardware & Praxiseinsatz", "Level 6 · Hardware & Real Scenarios")}
        accent="accent"
        title={
          <>
            {t("Von der Frage zur ", "From question to ")}
            <span className="text-accent">{t("Lösung", "solution")}</span>
            {t(" – ohne Schaden", " – zero damage")}
          </>
        }
        sub={t(
          "Drei typische Abende am Kabinett. Und wie der Agent sie beendet, ohne dass du hinterher Backups suchen musst.",
          "Three typical evenings at the cabinet. And how the agent solves them without you having to hunt for backups.",
        )}
      />

      <div className="reveal grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        {/* Selector */}
        <div className="space-y-3">
          {cases.map((uc, i) => (
            <button
              key={uc.id}
              onClick={() => setActive(i)}
              className={cn(
                "sticker-hover flex w-full items-center gap-4 rounded-2xl border p-5 text-left transition",
                active === i
                  ? "border-accent/50 bg-accent/5 shadow-[0_0_15px_-4px_rgb(255_214_0/0.3)]"
                  : "border-border bg-surface/60",
              )}
            >
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-xl",
                  active === i ? "bg-accent text-bg" : "bg-border/60 text-text",
                )}
              >
                <uc.icon className="h-6 w-6" />
              </span>
              <div>
                <div className="font-pixel text-[9px] text-muted">USE CASE {i + 1}</div>
                <div className="font-display mt-1 text-xl leading-tight">{uc.title}</div>
              </div>
            </button>
          ))}

          {/* Real machine verification card */}
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 text-xs font-mono text-muted">
            <div className="text-primary font-bold flex items-center gap-1.5 mb-1">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              {t("Am echten Automaten verifiziert", "Verified on Real Cabinet")}
            </div>
            <p>
              {t(
                "Live-Getestet mit Ollama (Llama 3.2), MCP stdio Transport und Windows PowerShell 5.1.",
                "Live-tested with Ollama (Llama 3.2), MCP stdio transport, and Windows PowerShell 5.1.",
              )}
            </p>
          </div>
        </div>

        {/* Chat-style walkthrough */}
        <div className="sticker overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-5 py-3">
            <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary text-bg">
              <Mascot pose="friendly" size="xs" glow={false} />
            </span>
            <div>
              <div className="text-sm font-semibold">RetroGaming Agent</div>
              <div className="flex items-center gap-1.5 text-[11px] text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Online · Ollama (local)
              </div>
            </div>
            <div className="ml-auto flex flex-wrap justify-end gap-1.5">
              {c.tags.map((tg) => (
                <Tag key={tg} tone="neutral">
                  {tg}
                </Tag>
              ))}
            </div>
          </div>

          <div className="space-y-4 p-5">
            {/* user bubble */}
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-secondary px-4 py-3 text-sm text-bg shadow-[0_8px_24px_-10px_rgb(0_184_255/0.7)]">
                {c.user}
              </div>
            </div>

            {/* agent steps */}
            <div className="space-y-2.5">
              {c.steps.map((s, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-xs transition",
                    s.state === "done" && "border-primary/30 bg-primary/5 text-text",
                    s.state === "approval" && "border-accent/40 bg-accent/10 text-text shadow-[0_0_10px_rgb(255_214_0/0.2)]",
                    s.state === "pending" && "border-border bg-bg/40 text-muted",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono rounded px-1.5 py-0.5 text-[10px] uppercase",
                      s.state === "done" && "bg-primary/20 text-primary font-semibold",
                      s.state === "approval" && "bg-accent/20 text-accent font-bold animate-pulse",
                      s.state === "pending" && "bg-border text-muted",
                    )}
                  >
                    {s.label}
                  </span>
                  <div className="flex-1 font-mono">{s.text}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
