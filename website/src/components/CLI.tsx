import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Mascot } from "./Mascot";
import { Heading, Icon, Section } from "./ui";

function CopyButton({ text }: { text: string }) {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked – ignore */
        }
      }}
      className={cn(
        "shrink-0 rounded-md border px-2 py-1 font-mono text-[10px] tracking-wider uppercase transition",
        copied
          ? "border-primary/60 bg-primary/10 text-primary"
          : "border-border text-muted hover:border-primary/40 hover:text-text",
      )}
      aria-label={t("Befehl kopieren", "Copy command")}
    >
      {copied ? t("kopiert", "copied") : t("kopieren", "copy")}
    </button>
  );
}

export function CLI() {
  const { lang, t } = useLanguage();
  const [active, setActive] = useState(0);

  const commands = [
    {
      cmd: "fagent doctor --transport mcp",
      descDe: "Systemdiagnose & Anbindungstest – prüft Node, SQLite, Kit-Pfad & MCP Server stdio.",
      descEn: "System diagnostics & transport test – checks Node, SQLite, Kit path & MCP stdio transport.",
      tag: "diagnose",
    },
    {
      cmd: "fagent status",
      descDe: "Live-Gesundheitscheck des Kabinetts (Virtual Pinball & Lightgun-Subsysteme).",
      descEn: "Live health check of the cabinet (Virtual Pinball & Lightgun subsystems).",
      tag: "read-only",
    },
    {
      cmd: "fagent tools --level operator",
      descDe: "Verfügbare Aktionen für den Operator auflisten (10 Tools gemappt aus 34 Kit-Operationen).",
      descEn: "List available operator tools (10 tools mapped from 34 kit operations).",
      tag: "read-only",
    },
    {
      cmd: "fagent run step.lightgun.01-detect --level operator --param RetroBatRoot=C:\\RetroBat",
      descDe: "Sichere, geführte Ausführung eines Einzelschritts mit Dry-Run, Plan & Mensch-Freigabe.",
      descEn: "Safe, guided execution of a single step with dry-run, plan preview & human approval.",
      tag: "operator",
    },
    {
      cmd: "fagent chat --model llama3.2:3b --message \"Status prüfen\"",
      descDe: "Interaktive Diagnose im Chat-Modus mit lokalem Ollama-Modell oder Cloud-Schnittstelle.",
      descEn: "Interactive chat diagnosis using local Ollama models (Llama 3.2, Qwen 2.5) or cloud models.",
      tag: "local llm",
    },
    {
      cmd: "fagent report --since 7d",
      descDe: "M6 Meilenstein: Automatische Zusammenfassung von Sitzungen, Plänen & Ablehnungen aus dem Audit-Trail.",
      descEn: "M6 Milestone: Automatic summary of sessions, plans & refusals directly from the SQLite audit trail.",
      tag: "report (m6)",
    },
    {
      cmd: "fagent history --last 20",
      descDe: "Revisionssichere Historie aller Eingriffe und Entscheidungen einsehen.",
      descEn: "Audit history of all previous intervention steps and human decisions.",
      tag: "audit",
    },
  ];

  return (
    <Section id="cli" className="bg-surface/30">
      <Heading
        eyebrow={t("Level 5 · Das Werkzeug", "Level 5 · The CLI Tool")}
        title={
          <>
            <span className="font-mono text-primary">$ fagent</span> –{" "}
            {t("Direkte Kontrolle am Kabinett", "Direct Control on the Cabinet")}
          </>
        }
        sub={t(
          "Global installierbares CLI (Meilenstein M2). Kurz, sprechend, und ohne eine einzige Option, die dich am Menschen vorbeibringt.",
          "Globally installable CLI (Milestone M2). Concise, expressive, and without a single flag that could bypass human approval.",
        )}
      />

      <div className="reveal grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        {/* Command list */}
        <ul className="space-y-2">
          {commands.map((c, i) => (
            <li key={c.cmd}>
              <button
                onClick={() => setActive(i)}
                className={cn(
                  "w-full rounded-xl border p-4 text-left transition",
                  active === i
                    ? "border-primary/50 bg-primary/5 shadow-[0_0_15px_-4px_rgb(0_230_118/0.3)]"
                    : "border-border bg-surface/50 hover:border-border/80 hover:bg-surface",
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "font-pixel text-[10px]",
                      active === i ? "text-primary" : "text-muted",
                    )}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-mono text-sm break-all text-text">{c.cmd}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Detail panel with Laptop Mascot */}
        <div className="terminal sticky top-24 self-start overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <Icon.Terminal className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted">fagent --help</span>
            <span className="ml-auto rounded bg-border/60 px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted uppercase">
              {commands[active].tag}
            </span>
          </div>
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-start gap-3">
                  <pre className="flex-1 overflow-x-auto whitespace-pre-wrap text-sm text-primary">
                    <span className="text-muted">$ </span>
                    {commands[active].cmd}
                  </pre>
                  <CopyButton text={commands[active].cmd} />
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted">
                  {lang === "en" ? commands[active].descEn : commands[active].descDe}
                </p>
              </div>

              {/* Mini laptop mascot in CLI details */}
              <div className="hidden sm:block shrink-0">
                <Mascot pose="laptop" size="sm" glow={false} />
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-border bg-bg/60 p-4">
              <div className="mb-2 font-mono text-[10px] tracking-wider text-muted uppercase">
                {t("Was du garantiert nicht findest", "What you will never find")}
              </div>
              <div className="flex flex-wrap gap-2 font-mono text-xs">
                {["--yes", "--force", "--auto-approve", "--skip-dry-run"].map((f) => (
                  <span
                    key={f}
                    className="rounded border border-error/30 bg-error/5 px-2 py-1 text-error line-through decoration-2"
                  >
                    {f}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">
                {t(
                  "Diese Flags existieren nicht. Das ist kein fehlendes Feature – das ist das Kernprinzip.",
                  "These flags do not exist. That is not a missing feature – that is the core design principle.",
                )}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center font-mono text-xs">
              {[
                ["npm i -g .", t("Global CLI", "Global CLI")],
                ["node ≥ 24", t("Laufzeit", "Runtime")],
                ["0 deps", t("0 Abhängigkeiten", "0 Dependencies")],
              ].map(([a, b]) => (
                <div key={b} className="rounded-lg border border-border bg-bg/40 px-2 py-3">
                  <div className="font-mono text-sm text-text">{a}</div>
                  <div className="text-[11px] text-muted">{b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
