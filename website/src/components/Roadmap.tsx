import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Heading, Section, Tag } from "./ui";

export function Roadmap() {
  const { t } = useLanguage();

  const milestones = [
    {
      id: "M1",
      title: "Memory Digest",
      textDe: "Persistente SQLite-Zusammenfassung früherer Sitzungen im Systemprompt.",
      textEn: "Persistent SQLite summary of past sessions inside system prompt.",
      done: true,
    },
    {
      id: "M2",
      title: "Packaging & Migrations",
      textDe: "Global installierbares CLI fagent, versionierte DB-Schema-Migrationen.",
      textEn: "Globally installable CLI fagent, numbered DB schema migrations.",
      done: true,
    },
    {
      id: "M4",
      title: "MCP Server Transport",
      textDe: "Vollständige stdio-Integration des Model Context Protocols gegen Kit 0.3.1 (API 1.1).",
      textEn: "Full stdio integration of the Model Context Protocol against Kit 0.3.1 (API 1.1).",
      done: true,
    },
    {
      id: "M5",
      title: "Local LLM Live",
      textDe: "Live am Automaten verifiziert: Autonome Diagnose mit Ollama (Llama 3.2, Qwen 2.5).",
      textEn: "Verified live on real cabinet: Autonomous diagnosis with Ollama (Llama 3.2, Qwen 2.5).",
      done: true,
    },
    {
      id: "M6",
      title: "Report Mode",
      textDe: "fagent report – Zusammenfassung von Plänen, Ablehnungen und Cabinet-Gesundheit.",
      textEn: "fagent report – Summary of plans, refusals and cabinet health from audit trail.",
      done: true,
    },
    {
      id: "M3",
      title: "Terminal Streaming & Continuing",
      textDe: "Token-Streaming für lokale Modelle, chat --continue und lückenloses --json.",
      textEn: "Token streaming for local models, chat --continue and consistent --json outputs.",
      done: true,
    },
    {
      id: "HAL",
      title: "Hardware Layer",
      textDe: "Über Wiimotes hinaus: Direkte Treiberprofile für Sinden, Gun4IR und AimTrak.",
      textEn: "Beyond Wiimotes: Dedicated driver profiles for Sinden, Gun4IR, and AimTrak.",
      done: false,
    },
  ];

  return (
    <Section id="roadmap">
      <Heading
        eyebrow={t("World Map · Roadmap", "World Map · Roadmap")}
        title={
          <>
            Level <span className="text-primary">{t("geschafft", "cleared")}</span> –{" "}
            {t("und was noch kommt", "and what lies ahead")}
          </>
        }
        sub={t(
          "Fünf Meilensteine sind bereits vollständig live am Automaten verifiziert. Die nächsten Level sind freigeschaltet.",
          "Five milestones are fully implemented and verified on the real cabinet. The next stages are unlocked.",
        )}
      />

      <div className="reveal relative">
        {/* Track line */}
        <div className="absolute top-8 right-0 left-0 hidden h-1 rounded bg-border lg:block">
          <div className="h-full w-[72%] rounded bg-gradient-to-r from-primary via-primary to-accent" />
        </div>

        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {milestones.map((m, i) => (
            <li key={m.id} className="relative">
              <div
                className={cn(
                  "sticker flex h-full flex-col justify-between p-5 transition",
                  m.done
                    ? "border-primary/40 bg-surface shadow-[0_0_15px_-4px_rgb(0_230_118/0.25)]"
                    : "border-border bg-surface/50 opacity-90",
                )}
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <span
                      className={cn(
                        "font-pixel grid h-8 w-8 place-items-center rounded-lg text-[10px]",
                        m.done ? "bg-primary text-bg" : "bg-border text-muted",
                      )}
                    >
                      {m.done ? "✔" : i + 1}
                    </span>
                    <Tag tone={m.done ? "primary" : "neutral"}>
                      {m.done ? t("DONE", "DONE") : t("NEXT", "NEXT")}
                    </Tag>
                  </div>
                  <div className="font-pixel text-[9px] text-muted">{m.id}</div>
                  <h3 className="font-display mt-1 text-lg text-text">{m.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {t(m.textDe, m.textEn)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  );
}
