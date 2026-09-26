import { useLanguage } from "../i18n/LanguageContext";
import { Heading, Icon, Section } from "./ui";

export function Pillars() {
  const { t } = useLanguage();

  const pillars = [
    {
      n: "01",
      icon: Icon.Eye,
      title: "Dry-Run First",
      principle: t("Niemals blind schreiben", "Never write blindly"),
      detail: t(
        "Das Modell sieht die Parameter apply oder approved gar nicht. Die Policy-Engine führt jeden Befehl zuerst mit -WhatIf aus.",
        "The model does not even see apply or approved parameters. The policy engine executes every command first with -WhatIf.",
      ),
      code: "-WhatIf",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      n: "02",
      icon: Icon.User,
      title: "Human-in-the-Loop",
      principle: t("Der Mensch hat das letzte Wort", "Human has the final word"),
      detail: t(
        "Kein --yes, kein --force, kein automatischer Bypass. Selbst die SQLite-Datenbank erzwingt es per Schema-Constraint.",
        "No --yes, no --force, no automated bypass. Even the SQLite database enforces it through schema constraints.",
      ),
      code: "CHECK(decided_by = 'human')",
      color: "text-accent",
      bg: "bg-accent/10",
    },
    {
      n: "03",
      icon: Icon.Lock,
      title: "Zero-Telemetry & Privacy",
      principle: t("Private Daten verlassen nie den PC", "Private data never leaves the cabinet"),
      detail: t(
        "Cloud-Routen erzwingen -Anonymize. Benutzernamen, SIDs, IPs und Profilpfade werden in Echtzeit maskiert.",
        "Cloud routes enforce -Anonymize. User names, SIDs, IPs and system profile paths are masked in real time.",
      ),
      code: "assertSafeForCloud()",
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      n: "04",
      icon: Icon.Box,
      title: "Zero Runtime Dependencies",
      principle: t("Höchste Stabilität & Portabilität", "Maximum stability & portability"),
      detail: t(
        "Entwickelt für Node.js ≥ 24. Nutzt nativ node:sqlite und TypeScript Type-Stripping – 0 npm-Laufzeitpakete.",
        "Engineered for Node.js ≥ 24. Uses native node:sqlite and TypeScript type-stripping – 0 npm runtime packages.",
      ),
      code: "import { DatabaseSync } from 'node:sqlite'",
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      n: "05",
      icon: Icon.Plug,
      title: "Dual-Transport (MCP & CLI)",
      principle: t("Bereit für alle KI-Ökosysteme", "Ready for all AI ecosystems"),
      detail: t(
        "Klassischer Subprozess-JSON-Transport sowie das Model Context Protocol über stdio – JSON-RPC 2.0.",
        "Standard subprocess JSON transport as well as Model Context Protocol over stdio – JSON-RPC 2.0.",
      ),
      code: "fagent doctor --transport mcp",
      color: "text-secondary",
      bg: "bg-secondary/10",
    },
    {
      n: "06",
      icon: Icon.Gamepad,
      title: "The Truth is the Machine",
      principle: t("Die Maschine ist die Realität", "The machine is ground truth"),
      detail: t(
        "Was der Agent erinnert, ist Historie. Die aktuelle Wahrheit über das Kabinett liefert ausschließlich fagent status / kit doctor.",
        "What the agent remembers is history. Current ground truth about the cabinet comes exclusively from fagent status / kit doctor.",
      ),
      code: "fagent status",
      color: "text-accent",
      bg: "bg-accent/10",
    },
  ];

  return (
    <Section id="sicherheit">
      <Heading
        eyebrow={t("Level 3 · Sicherheit & Design", "Level 3 · Safety & Design")}
        title={
          <>
            {t("Sechs ", "Six ")}
            <span className="text-primary">{t("unumstößliche", "immutable")}</span>
            {t(" Säulen", " Pillars")}
          </>
        }
        sub={t(
          "Entwickelt nach strikten Leitplanken. Jedes architektonische Detail schützt die Hardware vor Halluzinationen.",
          "Designed under strict guardrails. Every architectural detail protects the cabinet hardware from model hallucinations.",
        )}
      />

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {pillars.map((p) => (
          <div key={p.n} className="sticker sticker-hover reveal flex flex-col justify-between p-6">
            <div>
              <div className="mb-4 flex items-center justify-between">
                <span className={`grid h-12 w-12 place-items-center rounded-xl ${p.bg} ${p.color}`}>
                  <p.icon className="h-6 w-6" />
                </span>
                <span className="font-pixel text-xs text-muted">{p.n}</span>
              </div>
              <h3 className="font-display text-2xl">{p.title}</h3>
              <div className="font-mono text-xs text-accent">{p.principle}</div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{p.detail}</p>
            </div>
            <div className="mt-5 rounded border border-border bg-bg/60 px-2.5 py-1.5 font-mono text-[11px] text-muted">
              <code>{p.code}</code>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
