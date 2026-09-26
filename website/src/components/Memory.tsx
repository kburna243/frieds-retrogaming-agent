import { useLanguage } from "../i18n/LanguageContext";
import { Heading, Icon, Section, Tag } from "./ui";

export function Memory() {
  const { t } = useLanguage();

  const sessions = [
    {
      id: "#1042",
      when: t("heute 19:32", "today 19:32"),
      topic: t("Lightgun · ViGEmBus-Konflikt behoben", "Lightgun · ViGEmBus conflict resolved"),
      status: "success",
    },
    {
      id: "#1041",
      when: t("gestern 21:05", "yesterday 21:05"),
      topic: t("DMD-Geometrie geprüft (nur Status)", "DMD geometry verified (status only)"),
      status: "info",
    },
    {
      id: "#1040",
      when: t("Di 20:11", "Tue 20:11"),
      topic: t("Plan abgelehnt: TeknoParrot-Profil", "Plan refused: TeknoParrot profile"),
      status: "rejected",
    },
    {
      id: "#1039",
      when: t("So 17:48", "Sun 17:48"),
      topic: t("Backup-Rotation · 3 .bak erstellt", "Backup rotation · 3 .bak generated"),
      status: "success",
    },
    {
      id: "#1038",
      when: t("Sa 14:20", "Sat 14:20"),
      topic: t("Migration-Export vorbereitet", "Migration export prepared"),
      status: "success",
    },
  ];

  return (
    <Section>
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Heading
            eyebrow={t("Meilenstein M1 · Memory", "Milestone M1 · Memory")}
            accent="secondary"
            title={
              <>
                {t("Ein Gedächtnis, das ", "A memory that ")}
                <span className="text-secondary">{t("erinnert", "remembers")}</span>
                {t(" – aber nie ", " – but never ")}
                <span className="text-accent">{t("freischaltet", "authorizes")}</span>.
              </>
            }
            sub={t(
              "Persistentes SQLite-Gedächtnis unterscheidet den Agenten von simplen Chatbots. Historie ist Kontext, nicht Berechtigung.",
              "Persistent SQLite memory separates the agent from simple chatbots. History is context, never authorization.",
            )}
          />
          <div className="reveal space-y-4">
            {[
              {
                icon: Icon.Database,
                title: t("Audit-Trail", "Audit Trail"),
                text: t(
                  "Jede Sitzung, jeder Tool-Call, jeder Plan, jede Ablehnung und Genehmigung wird manipulationssicher mit Zeitstempel protokolliert.",
                  "Every session, tool call, plan, refusal, and approval is tamper-proof recorded with millisecond timestamps.",
                ),
              },
              {
                icon: Icon.Brain,
                title: t("Session-Digest", "Session Digest"),
                text: t(
                  "Zu Beginn liest der Agent die letzten 5 Sitzungen ein und erzeugt eine kompakte, anonymisierte Zusammenfassung im Systemprompt.",
                  "At startup, the agent reads the last 5 sessions and generates a compact, anonymized summary into the system prompt.",
                ),
              },
              {
                icon: Icon.Lock,
                title: t("Keine Scheingenehmigungen", "Zero Phantom Authorizations"),
                text: t(
                  "Ein in der Vergangenheit genehmigter Plan schaltet niemals eine zukünftige Aktion frei. Jede Änderung erfordert eine frische Bestätigung.",
                  "A plan approved in the past never authorizes a future action. Every change mandates a fresh, explicit human confirmation.",
                ),
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save-slot style memory card */}
        <div className="reveal relative">
          <div className="marker absolute -top-6 right-4 z-10 text-2xl">Save Slots</div>
          <div className="sticker overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="font-pixel text-[10px] text-secondary">LOAD GAME · HARNESS.DB</span>
              <Tag tone="neutral">{t("letzte 5 Sitzungen", "last 5 sessions")}</Tag>
            </div>
            <ul className="divide-y divide-border">
              {sessions.map((s, i) => (
                <li
                  key={s.id}
                  className="group flex items-center gap-4 px-5 py-3.5 transition hover:bg-bg/50"
                >
                  <span className="font-pixel text-[10px] text-muted group-hover:text-primary">
                    {i === 0 ? "▶" : " "} SLOT {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm">{s.topic}</div>
                    <div className="font-mono text-[11px] text-muted">
                      {s.id} · {s.when}
                    </div>
                  </div>
                  <Tag
                    tone={
                      s.status === "success" ? "primary" : s.status === "rejected" ? "error" : "secondary"
                    }
                  >
                    {s.status}
                  </Tag>
                </li>
              ))}
            </ul>
            <div className="border-t border-border bg-bg/60 px-5 py-3 font-mono text-[11px] text-muted">
              <span className="text-secondary">digest →</span> systemprompt ({t("anonymisiert, ~420 Tokens", "anonymized, ~420 tokens")}) ·{" "}
              <span className="text-accent">grants: 0</span>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
