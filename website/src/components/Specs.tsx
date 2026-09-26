import { useLanguage } from "../i18n/LanguageContext";
import { Heading, Section, Tag } from "./ui";

export function Specs() {
  const { t } = useLanguage();

  const specs: { k: string; v: React.ReactNode }[] = [
    {
      k: t("Programmiersprache", "Programming Language"),
      v: "TypeScript / Modern ECMAScript (ES2024)",
    },
    {
      k: t("Laufzeitumgebung", "Runtime Environment"),
      v: "Node.js ≥ 24.0.0 (empfohlen: Node.js 24 LTS)",
    },
    {
      k: t("Laufzeit-Abhängigkeiten", "Runtime Dependencies"),
      v: (
        <>
          <span className="font-display text-2xl text-primary">0</span> –{" "}
          {t(
            "kein Express, kein Prisma, kein Axios. Reines Node-Ökosystem.",
            "no Express, no Prisma, no Axios. Pure Node standard library.",
          )}
        </>
      ),
    },
    {
      k: t("Datenbank", "Database Engine"),
      v: t(
        "Integrierte SQLite-Engine (node:sqlite) mit WAL-Modus, Foreign Keys & Schema-Migrationen",
        "Built-in SQLite engine (node:sqlite) with WAL mode, foreign keys & schema migrations",
      ),
    },
    {
      k: t("Plattform", "Platform Support"),
      v: (
        <>
          <b className="text-text">Windows 10/11</b>{" "}
          {t("(reale Hardware-Steuerung, PS 5.1)", "(physical hardware execution, PS 5.1)")} ·{" "}
          <b className="text-text">Linux & macOS</b>{" "}
          {t("(vollständig testbar via Fake-Cabinet)", "(fully testable via Fake Cabinet emulator)")}
        </>
      ),
    },
    {
      k: t("Schnittstellen", "Protocols & Transports"),
      v: "Kit-API v1.1 over stdio · Model Context Protocol (MCP) JSON-RPC 2.0",
    },
    {
      k: t("Unterstützte Modelle", "Supported Models"),
      v: "Ollama (lokal: Llama 3.2, Qwen 2.5, Mistral) · OpenAI API · Anthropic Claude",
    },
  ];

  const highscore = [
    { rank: "1ST", name: t("TESTS GRÜN", "TESTS GREEN"), score: "138 / 138", tone: "text-accent" },
    { rank: "2ND", name: t("KIT-OPERATIONEN", "KIT OPERATIONS"), score: "34", tone: "text-text" },
    { rank: "3RD", name: t("GATE-STUFEN", "GATE STAGES"), score: "6", tone: "text-text" },
    { rank: "4TH", name: t("RUNTIME-DEPS", "RUNTIME DEPS"), score: "0", tone: "text-primary" },
    { rank: "5TH", name: t("BYPASSES", "BYPASSES"), score: "0", tone: "text-primary" },
  ];

  return (
    <Section id="specs" className="bg-surface/30">
      <Heading
        eyebrow={t("Level 7 · Technische Spezifikationen", "Level 7 · Technical Specifications")}
        accent="secondary"
        title={
          <>
            {t("Unter der ", "Under the ")}
            <span className="text-secondary">{t("Haube", "Hood")}</span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="sticker reveal overflow-hidden">
          <dl className="divide-y divide-border">
            {specs.map((s) => (
              <div key={s.k} className="grid gap-1 px-6 py-4 sm:grid-cols-[220px_1fr] sm:gap-6">
                <dt className="font-mono text-[11px] tracking-wider text-muted uppercase sm:pt-1">
                  {s.k}
                </dt>
                <dd className="text-sm leading-relaxed text-text">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Arcade highscore board */}
        <div className="sticker reveal flex flex-col justify-between p-6">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-pixel text-xs text-accent">HALL OF FAME</span>
              <Tag tone="accent">TOP STATS</Tag>
            </div>
            <ul className="mt-4 space-y-3 font-mono text-sm">
              {highscore.map((h) => (
                <li key={h.rank} className="flex items-center justify-between">
                  <span className="font-pixel text-[11px] text-muted">{h.rank}</span>
                  <span className="text-muted">{h.name}</span>
                  <span className={`font-bold ${h.tone}`}>{h.score}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-6 rounded-lg border border-border bg-bg/50 p-3 text-center font-mono text-[11px] text-muted">
            {t("100% deterministisch · Volle CI-Pipeline", "100% deterministic · Full CI pipeline")}
          </div>
        </div>
      </div>
    </Section>
  );
}
