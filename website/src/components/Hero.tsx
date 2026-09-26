import { useMemo, useState } from "react";
import { useTypewriter, type TerminalLine } from "../hooks/useTypewriter";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Mascot, type MascotPose } from "./Mascot";
import { Icon, LinkButton, PixelCoin, Tag } from "./ui";

const lineColor: Record<NonNullable<TerminalLine["kind"]>, string> = {
  cmd: "text-text",
  ok: "text-primary",
  warn: "text-warning",
  err: "text-error",
  info: "text-secondary",
  dim: "text-muted",
  plain: "text-text/90",
};

function TerminalView({ lines, current }: { lines: TerminalLine[]; current: string }) {
  return (
    <div className="terminal relative overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-error/80" />
        <span className="h-3 w-3 rounded-full bg-warning/80" />
        <span className="h-3 w-3 rounded-full bg-primary/80" />
        <span className="ml-3 text-xs text-muted">operator@cabinet — fagent</span>
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> MCP · stdio
        </span>
      </div>
      <div className="relative min-h-[320px] px-4 py-4 text-[13px] leading-relaxed sm:min-h-[360px]">
        <div className="scanlines pointer-events-none absolute inset-0" />
        {lines.map((l, i) => (
          <div key={i} className={cn("whitespace-pre-wrap", lineColor[l.kind ?? "plain"])}>
            {l.kind === "cmd" && <span className="mr-2 text-primary">❯</span>}
            {l.text}
          </div>
        ))}
        <div className="cursor whitespace-pre-wrap text-text">
          <span className="mr-2 text-primary">❯</span>
          {current}
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const { lang, t } = useLanguage();
  const [mascotPose, setMascotPose] = useState<MascotPose>("controller");

  const script = useMemo<TerminalLine[]>(
    () => [
      { kind: "cmd", text: "fagent status", delay: 600 },
      {
        kind: "dim",
        text:
          lang === "en"
            ? "→ Kit-API v1.1 (Kit v0.3.1) · 34 operations · Fake-Cabinet: off"
            : "→ Kit-API v1.1 (Kit v0.3.1) · 34 Operationen · Fake-Cabinet: off",
      },
      { kind: "ok", text: "✔ Virtual Pinball    VPX 10.8 · PinUP Popper · 3 Screens" },
      { kind: "ok", text: "✔ Lightgun           Wiimote ×2 · DemulShooter OK" },
      {
        kind: "warn",
        text:
          lang === "en"
            ? "⚠ DolphinBar         Mode 1 detected (expected: Mode 4)"
            : "⚠ DolphinBar         Mode 1 erkannt (erwartet: Mode 4)",
      },
      {
        kind: "err",
        text:
          lang === "en"
            ? "✖ ViGEmBus           Driver conflict (0x1F)"
            : "✖ ViGEmBus           Treiberkonflikt (0x1F)",
      },
      { kind: "cmd", text: "fagent run step.lightgun.02-hardware --level operator", delay: 900 },
      {
        kind: "info",
        text:
          lang === "en"
            ? "▸ Policy Gate: Level operator ✓ · Params checked ✓"
            : "▸ Policy-Gate: Level operator ✓ · Params geprüft ✓",
      },
      { kind: "dim", text: "▸ Dry-Run (-WhatIf) …" },
      { kind: "plain", text: "  PLAN  1. DolphinBar → Mode 4" },
      {
        kind: "plain",
        text: lang === "en" ? "        2. Reconnect ViGEmBus" : "        2. ViGEmBus neu einbinden",
      },
      {
        kind: "plain",
        text: "        3. Backup: DemulShooter.ini → .bak",
      },
      { kind: "dim", text: " " },
      {
        kind: "warn",
        text:
          lang === "en"
            ? "? Execute plan? Type [yes/no]:"
            : "? Plan ausführen? Tippe [yes/no]:",
        delay: 500,
      },
      { kind: "cmd", text: "yes", delay: 1200 },
      {
        kind: "ok",
        text:
          lang === "en"
            ? "✔ Apply (-Approved by human) … 3/3 steps"
            : "✔ Apply (-Approved by human) … 3/3 Schritte",
      },
      {
        kind: "ok",
        text:
          lang === "en"
            ? "✔ Verify: ViGEmBus OK · DolphinBar Mode 4 · Audit #1042 recorded"
            : "✔ Verify: ViGEmBus OK · DolphinBar Mode 4 · Audit #1042 gespeichert",
      },
    ],
    [lang],
  );
  const { lines, current } = useTypewriter(script);

  const mascotSpeech =
    lang === "en"
      ? "Hi, I'm Fried! Never without your YES."
      : "Hi, ich bin Fried! Niemals ohne dein YES.";

  return (
    <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-36 sm:pb-24">
      <div className="pixel-grid absolute inset-0 -z-10" />
      {/* moving scan bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 animate-scan bg-gradient-to-b from-transparent via-primary/[0.06] to-transparent" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="animate-rise">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <Tag tone="primary" dot>
              {t("v0.1.0 · Aktive Entwicklung", "v0.1.0 · Active Development")}
            </Tag>
            <Tag tone="secondary">MCP stdio</Tag>
            <Tag tone="accent">MIT</Tag>
            <Tag tone="neutral">Node ≥ 24</Tag>
          </div>

          <h1 className="font-display text-6xl leading-[0.9] sm:text-7xl lg:text-8xl">
            <span className="block">Your Cabinet.</span>
            <span className="glow-green block text-primary">Smarter.</span>
            <span className="block text-3xl text-muted sm:text-4xl lg:text-5xl">
              {t("Niemals ohne dein ", "Never without your ")}
              <span className="text-accent">yes</span>.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted">
            <strong className="text-text">Fried's Retrogaming Agent</strong>{" "}
            {t(
              "ist das policy-gesteuerte KI-Harness für Virtual-Pinball- und Lightgun-Kabinette. Lokales LLM oder Cloud – das Gehirn plant, das Retrogaming Kit führt aus. Dazwischen: ein Gate, das keine Änderung ohne Dry-Run, Plan und menschliche Freigabe durchlässt.",
              "is the policy-guided AI harness for Virtual Pinball and Lightgun cabinets. Local LLM or Cloud – the brain plans, the Retrogaming Kit executes. In between: a gate that allows no change without dry-run, plan, and explicit human approval.",
            )}
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <LinkButton
              href="https://github.com/kburna243/frieds-retrogaming-agent"
              target="_blank"
              rel="noreferrer"
              className="px-6 py-3.5 text-base"
            >
              <Icon.Github className="h-5 w-5" />
              {t("Repository öffnen", "Open Repository")}
            </LinkButton>
            <LinkButton variant="outline" href="#demo" className="px-6 py-3.5 text-base">
              <Icon.Shield className="h-5 w-5 text-primary" />
              {t("Policy-Gate ausprobieren", "Try Policy Gate")}
            </LinkButton>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-xs text-muted">
            <span className="flex items-center gap-2">
              <PixelCoin className="h-4 w-4" /> 0 Runtime-Deps
            </span>
            <span className="flex items-center gap-2">
              <PixelCoin className="h-4 w-4" /> 116 Vitest-Tests grün
            </span>
            <span className="flex items-center gap-2">
              <PixelCoin className="h-4 w-4" /> 34 Kit-Operationen
            </span>
          </div>
        </div>

        <div className="relative animate-rise [animation-delay:150ms]">
          {/* Integrated Vector Mascot */}
          <div className="absolute -top-16 -right-2 z-30 hidden sm:block lg:-right-6">
            <Mascot
              pose={mascotPose}
              size="lg"
              float
              interactive
              speech={mascotSpeech}
              onPoseChange={setMascotPose}
            />
          </div>

          <div className="marker absolute -left-3 -top-8 z-20 text-2xl sm:text-3xl">
            Think. Plan. Solve. Play.
          </div>
          <TerminalView lines={lines} current={current} />
          {/* workflow ribbon */}
          <div className="mt-4 grid grid-cols-4 gap-2 font-mono text-[10px] tracking-widest text-muted uppercase sm:text-[11px]">
            {["Plan", "Analyze", "Execute", "Verify"].map((s, i) => (
              <div
                key={s}
                className="flex items-center gap-2 rounded-md border border-border bg-surface/60 px-2.5 py-2"
              >
                <span className="grid h-5 w-5 place-items-center rounded bg-primary/15 text-primary">
                  {i + 1}
                </span>
                {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
