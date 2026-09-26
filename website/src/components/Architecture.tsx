import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Heading, Icon, Section, Tag } from "./ui";

function Connector({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-2">
      <div className="h-6 w-px bg-gradient-to-b from-border to-primary/60" />
      <div className="font-mono text-[10px] tracking-wider text-muted uppercase">{label}</div>
      <div className="h-6 w-px bg-gradient-to-b from-primary/60 to-border" />
      <div className="-mt-1 text-primary">▼</div>
    </div>
  );
}

export function Architecture() {
  const { t } = useLanguage();
  const [hover, setHover] = useState<number | null>(null);

  const gateSteps = [
    {
      n: 1,
      name: t("Level-Filter", "Level Filter"),
      desc: t("read-only (nur Status) vs. operator", "read-only (status only) vs. operator"),
    },
    {
      n: 2,
      name: t("Parameter-Guard", "Parameter Guard"),
      desc: t("Nur primitive Typen, keine Code-Injections", "Only primitive types, no code injections"),
    },
    {
      n: 3,
      name: t("Dry-Run-Zwang", "Dry-Run Enforcement"),
      desc: t("Erster Aufruf IMMER mit -WhatIf", "First execution ALWAYS with -WhatIf"),
    },
    {
      n: 4,
      name: t("Human Approval", "Human Approval"),
      desc: t("Plan anzeigen, Mensch muss „yes“ tippen", "Display plan, human must type 'yes'"),
    },
    {
      n: 5,
      name: t("Ausführung", "Execution"),
      desc: t("Aufruf mit -Apply und -Approved", "Execution with -Apply and -Approved"),
    },
    {
      n: 6,
      name: t("Verifikation", "Verification"),
      desc: t("Neuer Statusabgleich (Verify)", "Post-check and state verification"),
    },
  ];

  return (
    <Section id="architektur" className="bg-surface/30">
      <Heading
        eyebrow={t("Level 2 · Architektur", "Level 2 · Architecture")}
        accent="secondary"
        title={
          <>
            {t("Drei Schichten. ", "Three Layers. ")}
            <span className="text-secondary">{t("Ein Gate. ", "One Gate. ")}</span>
            {t("Kein Bypass.", "No Bypass.")}
          </>
        }
        sub={t(
          "Das LLM redet nie direkt mit der Maschine. Jeder Tool-Call durchläuft die Policy Engine, bevor er das Kit erreicht – als JSON über stdio oder über das Model Context Protocol.",
          "The LLM never talks directly to the hardware. Every tool call passes through the Policy Engine before reaching the kit – as JSON over stdio or via the Model Context Protocol.",
        )}
      />

      <div className="reveal mx-auto max-w-3xl">
        {/* Layer 1: Brain */}
        <div className="sticker relative overflow-hidden p-6 sm:p-7">
          <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-secondary/10 blur-3xl" />
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary">
              <Icon.Brain className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl">{t("LLM / Gehirn", "LLM / Brain")}</h3>
                <Tag tone="secondary">Local Ollama</Tag>
                <Tag tone="secondary">Cloud API</Tag>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t(
                  "Lokal via Ollama (Qwen 2.5, Llama 3.2, Mistral) oder über datengeschützte Cloud-Schnittstellen (OpenAI, Anthropic Claude). Sieht nur Tools, nie apply oder approved Flags.",
                  "Local via Ollama (Qwen 2.5, Llama 3.2, Mistral) or via privacy-preserving cloud APIs (OpenAI, Anthropic Claude). Sees only tools, never receives apply or approved flags.",
                )}
              </p>
            </div>
          </div>
        </div>

        <Connector label="Tool-Calls · run_step · status" />

        {/* Layer 2: Policy Engine */}
        <div className="sticker relative overflow-hidden border-primary/40 p-6 sm:p-7 shadow-[0_0_60px_-20px_rgb(0_230_118/0.4)]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary animate-pulse-ring">
              <Icon.Shield className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl">Policy Engine</h3>
                <Tag tone="primary" dot>
                  {t("Das Sicherheits-Gate", "The Security Gate")}
                </Tag>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t(
                  "Mathematisch geschlossen: sechs Stufen, keine überspringbar. Keine Script-Freigaben (--yes existiert nicht).",
                  "Mathematically closed: six stages, none can be skipped. Zero automated approvals (--yes does not exist).",
                )}
              </p>
            </div>
          </div>

          <ol className="mt-6 grid gap-2 sm:grid-cols-2">
            {gateSteps.map((s) => (
              <li
                key={s.n}
                onMouseEnter={() => setHover(s.n)}
                onMouseLeave={() => setHover(null)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border border-border bg-bg/60 px-3 py-2.5 transition",
                  hover === s.n && "border-primary/60 bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "font-pixel grid h-8 w-8 shrink-0 place-items-center rounded-md text-[10px]",
                    s.n === 4 ? "bg-accent text-bg" : "bg-primary/15 text-primary",
                  )}
                >
                  {s.n}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{s.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted">{s.desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Connector label={t("JSON über stdio · oder MCP (JSON-RPC 2.0)", "JSON over stdio · or MCP (JSON-RPC 2.0)")} />

        {/* Layer 3: Kit */}
        <div className="sticker relative overflow-hidden p-6 sm:p-7">
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-accent/10 blur-3xl" />
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
              <Icon.Terminal className="h-7 w-7" />
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-2xl">Fried's Retrogaming Kit</h3>
                <Tag tone="accent">v0.3.0+</Tag>
              </div>
              <p className="mt-1 text-sm text-muted">
                {t(
                  "Der deterministische Kern: 34 geprüfte, idempotente Operationen – Backups, Migration, Doctor, Hardware.",
                  "The deterministic core: 34 verified, idempotent operations – backups, migration, doctor diagnostics, hardware.",
                )}
              </p>
              <div className="mt-4 grid gap-2 font-mono text-xs sm:grid-cols-2">
                <div className="rounded-md border border-border bg-bg/60 px-3 py-2 text-muted">
                  <span className="text-accent">api\</span>Invoke-KitApi.ps1
                </div>
                <div className="rounded-md border border-border bg-bg/60 px-3 py-2 text-muted">
                  <span className="text-accent">api\</span>Start-KitMcpServer.ps1
                </div>
              </div>
              <a
                href="https://github.com/kburna243/frieds-retrogaming-kit"
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
              >
                {t("Kit-Repository ansehen", "View Kit Repository")} <Icon.Arrow className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
