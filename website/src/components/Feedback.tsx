import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Button, Heading, Icon, LinkButton, Section, Tag } from "./ui";
import {
  COMMAND_OPTIONS,
  FRONTEND_OPTIONS,
  LIGHTGUN_OPTIONS,
  MODEL_OPTIONS,
  OS_OPTIONS,
  PINBALL_OPTIONS,
  feedbackConfig,
  wantedSystems,
} from "../config/feedback";
import {
  CABINET_LABEL,
  CABINET_LABEL_EN,
  KIND_LABEL,
  KIND_LABEL_EN,
  OUTCOME_LABEL,
  OUTCOME_LABEL_EN,
  TRANSPORT_LABEL,
  TRANSPORT_LABEL_EN,
  anonymize,
  buildReport,
  clearDraft,
  copyText,
  githubIssueUrl,
  loadDraft,
  mailtoUrl,
  makeEmptyDraft,
  saveDraft,
  sendToEndpoint,
  sendToWeb3Forms,
  suggestTitle,
  type Cabinet,
  type Outcome,
  type ReportDraft,
  type ReportKind,
  type Transport,
} from "../lib/report";
import { useLanguage } from "../i18n/LanguageContext";

/* ---------------- kleine Form-Bausteine ---------------- */

function Chip({
  active,
  onClick,
  children,
  tone = "primary",
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  tone?: "primary" | "secondary" | "accent" | "error";
}) {
  const activeCls = {
    primary: "border-primary/60 bg-primary/10 text-primary",
    secondary: "border-secondary/60 bg-secondary/10 text-secondary",
    accent: "border-accent/60 bg-accent/10 text-accent",
    error: "border-error/60 bg-error/10 text-error",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition",
        active ? activeCls : "border-border bg-bg/60 text-muted hover:border-border/80 hover:text-text",
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  hint,
  required,
  requiredLabel,
  children,
}: {
  label: string;
  hint?: ReactNode;
  required?: boolean;
  requiredLabel?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-[11px] tracking-wider text-muted uppercase">{label}</span>
        {required && <span className="font-mono text-[10px] text-accent">{requiredLabel || "erforderlich"}</span>}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-bg/70 px-3 py-2.5 text-sm text-text outline-none transition placeholder:text-muted/50 focus:border-primary/60 focus:ring-2 focus:ring-primary/15";

function StageHeader({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <span className="font-pixel grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-[11px] text-bg">
        {n}
      </span>
      <div>
        <h3 className="font-display text-2xl leading-tight sm:text-3xl">{title}</h3>
        <p className="mt-1 text-sm text-muted">{sub}</p>
      </div>
    </div>
  );
}

/* ---------------- Datentabellen für Stage 1 ---------------- */

const KINDS: {
  id: ReportKind;
  icon: (p: { className?: string }) => ReactNode;
  hintDe: string;
  hintEn: string;
}[] = [
  {
    id: "compat",
    icon: Icon.Gamepad,
    hintDe: "Läuft fagent auf deinem System? Das ist die wertvollste Info.",
    hintEn: "Does fagent run on your setup? That's the most valuable info.",
  },
  {
    id: "bug",
    icon: Icon.Bug,
    hintDe: "Etwas ist abgestürzt, hing oder hat Unsinn gemacht.",
    hintEn: "Something crashed, froze, or did something unexpected.",
  },
  {
    id: "idea",
    icon: Icon.Bulb,
    hintDe: "Hardware, die unterstützt werden sollte, oder ein Feature.",
    hintEn: "Hardware that should be supported, or a feature idea.",
  },
  {
    id: "question",
    icon: Icon.Help,
    hintDe: "Du kommst nicht weiter und brauchst einen Hinweis.",
    hintEn: "Need help or guidance on a specific setup.",
  },
  {
    id: "security",
    icon: Icon.Alert,
    hintDe: "Eine Änderung ohne dein „yes“? Das melden wir privat.",
    hintEn: "A change without your 'yes'? We report this privately.",
  },
];

const OUTCOMES: { id: Outcome; tone: "primary" | "accent" | "error" | "secondary" }[] = [
  { id: "works", tone: "primary" },
  { id: "partial", tone: "accent" },
  { id: "broken", tone: "error" },
  { id: "untested", tone: "secondary" },
];

type SendState =
  | { status: "idle" }
  | { status: "sending"; channel: string }
  | { status: "sent"; channel: string; url?: string; number?: number; note?: string }
  | { status: "error"; message: string };

/* ---------------- Hauptkomponente ---------------- */

export function Feedback() {
  const { lang, t } = useLanguage();
  const base = useMemo(() => makeEmptyDraft(feedbackConfig.versions), []);
  const [draft, setDraft] = useState<ReportDraft>(base);
  const [stage, setStage] = useState(0);
  const [approved, setApproved] = useState(false);
  const [send, setSend] = useState<SendState>({ status: "idle" });
  const [copied, setCopied] = useState(false);
  const [restored, setRestored] = useState(false);
  const wizardRef = useRef<HTMLDivElement>(null);
  const mounted = useRef(false);

  const STAGES = [
    t("Art", "Type"),
    t("System", "System"),
    t("Details", "Details"),
    t("Vorschau & Senden", "Preview & Send"),
  ];

  // Entwurf wiederherstellen / sichern
  useEffect(() => {
    const d = loadDraft(base);
    if (d && (d.description || d.os || d.cabinet)) {
      setDraft(d);
      setRestored(true);
    }
  }, [base]);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    saveDraft(draft);
  }, [draft]);

  const set = <K extends keyof ReportDraft>(key: K, value: ReportDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggle = (key: "lightgun" | "pinball" | "frontends", value: string) =>
    setDraft((d) => {
      const has = d[key].includes(value);
      let next = has ? d[key].filter((v) => v !== value) : [...d[key], value];
      if (value === "Keine" && !has) next = ["Keine"];
      else next = next.filter((v) => v !== "Keine" || value === "Keine");
      return { ...d, [key]: next };
    });

  const scrollToWizard = () => {
    const el = wizardRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
  };

  const goto = (n: number) => {
    setStage(n);
    setApproved(false);
    setSend({ status: "idle" });
    requestAnimationFrame(scrollToWizard);
  };

  const applyPrefill = (p: Partial<ReportDraft>) => {
    setDraft((d) => ({ ...d, ...p }));
    goto(1);
  };

  // Validierung
  const stageOk = [
    true,
    draft.cabinet !== "" && draft.os !== "",
    draft.description.trim().length >= 20,
    approved,
  ];
  const missing = [
    "",
    [!draft.cabinet && t("Kabinett-Typ", "Cabinet type"), !draft.os && t("Betriebssystem", "Operating system")].filter(Boolean).join(" & "),
    draft.description.trim().length < 20 ? t(`noch ${20 - draft.description.trim().length} Zeichen Beschreibung`, `${20 - draft.description.trim().length} more characters needed for description`) : "",
    t("Vorschau bestätigen", "Confirm preview"),
  ];

  const report = useMemo(() => buildReport(draft), [draft]);
  const diagLive = useMemo(() => anonymize(draft.diagnostics), [draft.diagnostics]);

  const direct: "endpoint" | "web3forms" | null = feedbackConfig.endpoint
    ? "endpoint"
    : feedbackConfig.web3formsKey
      ? "web3forms"
      : null;
  const hasEmail = Boolean(feedbackConfig.email);
  const isSecurity = draft.kind === "security";

  const doCopy = async () => {
    const ok = await copyText(`# ${report.title}\n\n${report.body}`);
    setCopied(ok);
    setTimeout(() => setCopied(false), 1800);
    return ok;
  };

  const doDirect = async () => {
    if (!direct) return;
    setSend({ status: "sending", channel: direct });
    try {
      const res =
        direct === "endpoint"
          ? await sendToEndpoint(feedbackConfig.endpoint, report, draft.website)
          : await sendToWeb3Forms(feedbackConfig.web3formsKey, report, draft.allowContact ? draft.contact : "", draft.website);
      clearDraft();
      setSend({ status: "sent", channel: direct, url: res.url, number: res.number });
    } catch (e) {
      setSend({ status: "error", message: e instanceof Error ? e.message : t("Unbekannter Fehler", "Unknown error") });
    }
  };

  const doGithub = async () => {
    const { url, truncated } = githubIssueUrl(feedbackConfig.githubRepo, report);
    if (truncated) await doCopy();
    window.open(url, "_blank", "noopener");
    setSend({
      status: "sent",
      channel: "github",
      note: truncated
        ? t(
            "Der Report war zu lang für den Link – er liegt in deiner Zwischenablage. Einfach im GitHub-Formular mit Strg+V einfügen und absenden.",
            "The report was too long for the URL link – it has been copied to your clipboard. Simply press Ctrl+V in the GitHub issue form and submit.",
          )
        : t(
            "GitHub hat sich in einem neuen Tab geöffnet. Dort nur noch auf „Submit new issue“ klicken.",
            "GitHub opened in a new tab. Just click 'Submit new issue' there.",
          ),
    });
  };

  const doMail = async () => {
    const { url, truncated } = mailtoUrl(feedbackConfig.email, report);
    if (truncated) await doCopy();
    window.location.href = url;
    setSend({
      status: "sent",
      channel: "mail",
      note: truncated
        ? t(
            "Dein Mailprogramm öffnet sich. Der vollständige Report liegt in der Zwischenablage – bitte in die Mail einfügen (Strg+V) und abschicken.",
            "Your email client is opening. The complete report is in your clipboard – please paste (Ctrl+V) and send.",
          )
        : t(
            "Dein Mailprogramm öffnet sich mit dem fertigen Report. Nur noch abschicken.",
            "Your email client opens with the pre-filled report. Just send it.",
          ),
    });
  };

  const resetAll = (keepSystem: boolean) => {
    clearDraft();
    setDraft((d) =>
      keepSystem
        ? { ...base, cabinet: d.cabinet, os: d.os, lightgun: d.lightgun, pinball: d.pinball, frontends: d.frontends, fagentVersion: d.fagentVersion, kitVersion: d.kitVersion, nodeVersion: d.nodeVersion, transport: d.transport, model: d.model, nickname: d.nickname, contact: d.contact, allowContact: d.allowContact }
        : base,
    );
    setRestored(false);
    goto(0);
  };

  return (
    <Section id="feedback" className="bg-surface/30">
      <Heading
        eyebrow={t("Player 2 · Blitz-Feedback", "Player 2 · Fast Feedback")}
        accent="accent"
        title={
          lang === "en" ? (
            <>
              Is your cabinet running? <span className="text-accent">Let us know.</span>
            </>
          ) : (
            <>
              Läuft dein Cabinet? <span className="text-accent">Sag kurz Bescheid.</span>
            </>
          )
        }
        sub={t(
          "Kein Konto nötig, kein Entwickler-Wissen, kein Zeitaufwand. Wähle einfach mit 2 Klicks dein Setup aus und sag uns, ob es läuft – jeder Bericht hilft der ganzen Community!",
          "No account needed, no developer knowledge, no time commitment. Pick your setup in 2 clicks and let us know if it works – every report helps the whole community!",
        )}
      />

      {/* ---------- Most Wanted ---------- */}
      <div className="reveal mb-10">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-pixel text-[10px] text-accent glow-yellow">★ MOST WANTED ★</span>
            <span className="text-sm text-muted">
              {t("Systeme, für die wir dringend Rückmeldungen brauchen", "Systems where we urgently need community feedback")}
            </span>
          </div>
          <Tag tone="accent">{t("Klick = Formular vorbelegt", "Click = Pre-fills form")}</Tag>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wantedSystems.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => applyPrefill(w.prefill)}
              className="sticker sticker-hover group flex items-start gap-3 p-4 text-left"
            >
              <span className="font-pixel mt-0.5 shrink-0 text-[9px] text-muted group-hover:text-accent">
                {w.tag.toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {lang === "en" && w.titleEn ? w.titleEn : w.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {lang === "en" && w.whyEn ? w.whyEn : w.why}
                </span>
              </span>
              <Icon.Arrow className="mt-1 h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent" />
            </button>
          ))}
        </div>
      </div>

      <div ref={wizardRef} className="reveal grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        {/* ---------- Wizard ---------- */}
        <div className="sticker overflow-hidden">
          {/* Stepper */}
          <div className="border-b border-border bg-bg/40 px-5 py-4">
            <ol className="grid grid-cols-4 gap-2">
              {STAGES.map((s, i) => {
                const state = i < stage ? "done" : i === stage ? "active" : "todo";
                return (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={i > stage && !stageOk.slice(0, i).every(Boolean)}
                      onClick={() => i < stage && goto(i)}
                      className="w-full text-left disabled:cursor-default"
                    >
                      <div
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          state === "done" && "bg-primary",
                          state === "active" && "bg-accent",
                          state === "todo" && "bg-border",
                        )}
                      />
                      <div
                        className={cn(
                          "mt-1.5 font-mono text-[10px] tracking-wider uppercase",
                          state === "active" ? "text-accent" : state === "done" ? "text-primary" : "text-muted",
                        )}
                      >
                        <span className="hidden sm:inline">Stage {i + 1} · </span>
                        {s}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          {restored && stage === 0 && (
            <div className="flex items-center gap-3 border-b border-border bg-secondary/5 px-5 py-2.5 text-xs text-secondary">
              <Icon.Database className="h-4 w-4" />
              {t("Wir haben deinen letzten Entwurf wiederhergestellt.", "We restored your previous draft.")}
              <button type="button" className="ml-auto underline hover:text-text" onClick={() => resetAll(false)}>
                {t("Verwerfen", "Discard")}
              </button>
            </div>
          )}

          <div className="p-5 sm:p-7">
            {/* ===== Stage 1: Art ===== */}
            {stage === 0 && (
              <div>
                <StageHeader
                  n={1}
                  title={t("Was möchtest du melden?", "What would you like to report?")}
                  sub={t("Keine Sorge um Fachbegriffe – wähle einfach, was am besten passt.", "Don't worry about technical terms – simply choose what fits best.")}
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  {KINDS.map((k) => {
                    const label = lang === "en" ? KIND_LABEL_EN[k.id] : KIND_LABEL[k.id];
                    const hint = lang === "en" ? k.hintEn : k.hintDe;
                    return (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => set("kind", k.id)}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                          draft.kind === k.id
                            ? k.id === "security"
                              ? "border-error/60 bg-error/5"
                              : "border-primary/60 bg-primary/5"
                            : "border-border bg-bg/50 hover:border-border/80",
                        )}
                      >
                        <span
                          className={cn(
                            "grid h-10 w-10 shrink-0 place-items-center rounded-lg",
                            draft.kind === k.id
                              ? k.id === "security"
                                ? "bg-error text-bg"
                                : "bg-primary text-bg"
                              : "bg-border/60 text-text",
                          )}
                        >
                          <k.icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-sm font-semibold">{label}</span>
                          <span className="mt-0.5 block text-xs text-muted">{hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {draft.kind === "compat" && (
                  <div className="mt-6">
                    <Field label={t("Ergebnis auf deinem System", "Outcome on your system")} required requiredLabel={t("erforderlich", "required")}>
                      <div className="flex flex-wrap gap-2">
                        {OUTCOMES.map((o) => {
                          const outcomeLabel = lang === "en" ? OUTCOME_LABEL_EN[o.id] : OUTCOME_LABEL[o.id];
                          return (
                            <Chip key={o.id} tone={o.tone} active={draft.outcome === o.id} onClick={() => set("outcome", o.id)}>
                              {o.id === "works" && "✔ "}
                              {o.id === "partial" && "◐ "}
                              {o.id === "broken" && "✖ "}
                              {outcomeLabel}
                            </Chip>
                          );
                        })}
                      </div>
                    </Field>
                    <p className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                      {t(
                        "Auch „funktioniert“ ist ein wertvoller Report – so entsteht eine verlässliche Kompatibilitätsliste.",
                        "Even 'works' is a valuable report – that's how we build a reliable compatibility list.",
                      )}
                    </p>
                  </div>
                )}

                {isSecurity && (
                  <div className="mt-6 rounded-xl border border-error/40 bg-error/5 p-4 text-sm">
                    <div className="flex items-center gap-2 font-semibold text-error">
                      <Icon.Alert className="h-4 w-4" /> {t("Sicherheitsmeldungen bleiben privat", "Security reports stay private")}
                    </div>
                    <p className="mt-1 text-muted">
                      {t(
                        "Hat fagent etwas am Kabinett geändert, ohne dass du „yes“ getippt hast? Das ist die eine Klasse von Fehlern, die nicht öffentlich landen darf. Du kannst den Report hier trotzdem vorbereiten – am Ende bieten wir dir nur private Wege an.",
                        "Did fagent change something on your cabinet without you typing 'yes'? That's the one class of issues that must not end up in public. You can still prepare your report here – we will only offer private submission channels at the end.",
                      )}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ===== Stage 2: System ===== */}
            {stage === 1 && (
              <div className="space-y-6">
                <StageHeader
                  n={2}
                  title={t("Dein System", "Your System")}
                  sub={t("Je genauer, desto besser können wir es nachstellen. Unbekanntes einfach leer lassen.", "The more accurate, the better we can reproduce. Just leave unknown fields blank.")}
                />

                <Field label={t("Kabinett-Typ", "Cabinet Type")} required requiredLabel={t("erforderlich", "required")}>
                  <div className="flex flex-wrap gap-2">
                    {(["pinball", "lightgun", "both", "other"] as Cabinet[]).map((c) => {
                      const cabinetLabel = lang === "en" ? CABINET_LABEL_EN[c] : CABINET_LABEL[c];
                      return (
                        <Chip key={c} active={draft.cabinet === c} onClick={() => set("cabinet", c)}>
                          {cabinetLabel}
                        </Chip>
                      );
                    })}
                  </div>
                </Field>

                <Field label={t("Betriebssystem", "Operating System")} required requiredLabel={t("erforderlich", "required")}>
                  <div className="flex flex-wrap gap-2">
                    {OS_OPTIONS.map((o) => (
                      <Chip key={o} tone="secondary" active={draft.os === o} onClick={() => set("os", o)}>
                        {o}
                      </Chip>
                    ))}
                  </div>
                </Field>

                {(draft.cabinet === "lightgun" || draft.cabinet === "both" || draft.cabinet === "other") && (
                  <Field label={t("Lightgun-Hardware", "Lightgun Hardware")} hint={t("Mehrfachauswahl möglich.", "Multiple selections allowed.")}>
                    <div className="flex flex-wrap gap-2">
                      {LIGHTGUN_OPTIONS.map((o) => (
                        <Chip key={o} active={draft.lightgun.includes(o)} onClick={() => toggle("lightgun", o)}>
                          {o}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}

                {(draft.cabinet === "pinball" || draft.cabinet === "both" || draft.cabinet === "other") && (
                  <Field label={t("Pinball-Software", "Pinball Software")} hint={t("Mehrfachauswahl möglich.", "Multiple selections allowed.")}>
                    <div className="flex flex-wrap gap-2">
                      {PINBALL_OPTIONS.map((o) => (
                        <Chip key={o} active={draft.pinball.includes(o)} onClick={() => toggle("pinball", o)}>
                          {o}
                        </Chip>
                      ))}
                    </div>
                  </Field>
                )}

                <Field label={t("Frontends / Emulatoren", "Frontends / Emulators")} hint={t("Mehrfachauswahl möglich.", "Multiple selections allowed.")}>
                  <div className="flex flex-wrap gap-2">
                    {FRONTEND_OPTIONS.map((o) => (
                      <Chip key={o} tone="accent" active={draft.frontends.includes(o)} onClick={() => toggle("frontends", o)}>
                        {o}
                      </Chip>
                    ))}
                  </div>
                </Field>

                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="fagent-Version" hint={<code>fagent --version</code>}>
                    <input className={cn(inputCls, "font-mono")} value={draft.fagentVersion} onChange={(e) => set("fagentVersion", e.target.value)} placeholder="0.2.0" />
                  </Field>
                  <Field label="Kit-Version" hint={<code>fagent doctor</code>}>
                    <input className={cn(inputCls, "font-mono")} value={draft.kitVersion} onChange={(e) => set("kitVersion", e.target.value)} placeholder="0.3.1" />
                  </Field>
                  <Field label="Node.js" hint={<code>node --version</code>}>
                    <input className={cn(inputCls, "font-mono")} value={draft.nodeVersion} onChange={(e) => set("nodeVersion", e.target.value)} placeholder="v24.x" />
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Transport zum Kit", "Transport to Kit")}>
                    <div className="flex flex-wrap gap-2">
                      {(["unknown", "stdio", "mcp"] as Transport[]).map((tr) => {
                        const trLabel = tr === "unknown" ? t("weiß nicht", "don't know") : tr.toUpperCase();
                        return (
                          <Chip key={tr} tone="secondary" active={draft.transport === tr} onClick={() => set("transport", tr)}>
                            {trLabel}
                          </Chip>
                        );
                      })}
                    </div>
                  </Field>
                  <Field label={t("KI-Modell", "AI Model")}>
                    <select
                      className={cn(inputCls, "appearance-none")}
                      value={MODEL_OPTIONS.includes(draft.model) ? draft.model : draft.model ? "Anderes" : ""}
                      onChange={(e) => set("model", e.target.value === "Anderes" ? "Anderes: " : e.target.value)}
                    >
                      <option value="">{t("– bitte wählen –", "– please select –")}</option>
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    {draft.model.startsWith("Anderes") && (
                      <input className={cn(inputCls, "mt-2")} value={draft.model} onChange={(e) => set("model", e.target.value)} placeholder={t("Anderes: …", "Other: …")} />
                    )}
                  </Field>
                </div>
              </div>
            )}

            {/* ===== Stage 3: Details ===== */}
            {stage === 2 && (
              <div className="space-y-6">
                <StageHeader
                  n={3}
                  title={t("Was ist passiert?", "What happened?")}
                  sub={t("Erzähl es so, wie du es einem Kumpel am Kabinett erzählen würdest.", "Tell it just like you would to a friend standing at the cabinet.")}
                />

                <Field
                  label={t("Welcher Befehl / Schritt?", "Which command / step?")}
                  hint={t("Auswählen oder selbst eintippen – z. B. den Schrittnamen aus dem Plan.", "Select or type your own – e.g. the step name from the plan.")}
                >
                  <select className={cn(inputCls, "appearance-none font-mono")} value={COMMAND_OPTIONS.includes(draft.command) ? draft.command : ""} onChange={(e) => set("command", e.target.value)}>
                    <option value="">{t("– auswählen (optional) –", "– select (optional) –")}</option>
                    {COMMAND_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <input className={cn(inputCls, "mt-2 font-mono")} value={draft.command} onChange={(e) => set("command", e.target.value)} placeholder="fagent run step.lightgun.01-detect --level operator --param RetroBatRoot=C:\RetroBat" />
                </Field>

                <Field
                  label={t("Beschreibung", "Description")}
                  required
                  requiredLabel={t("erforderlich", "required")}
                  hint={t("Was hast du gemacht, was ist dann passiert? Fehlermeldungen gern wörtlich.", "What did you do, and what happened next? Feel free to paste error messages verbatim.")}
                >
                  <textarea
                    rows={5}
                    className={inputCls}
                    value={draft.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder={t(
                      "Beispiel: Nach „yes“ lief der Plan durch, aber die zweite Wiimote zielt in House of the Dead 2 weiterhin daneben. fagent status zeigt DolphinBar Mode 4, ViGEmBus OK.",
                      "Example: After typing 'yes' the plan completed, but the 2nd Wiimote still misses in House of the Dead 2. fagent status shows DolphinBar Mode 4, ViGEmBus OK.",
                    )}
                  />
                  <div className="mt-1 text-right font-mono text-[10px] text-muted">
                    {draft.description.trim().length} {t("Zeichen", "chars")}
                  </div>
                </Field>

                <Field
                  label={t("Was hättest du erwartet?", "What did you expect?")}
                  hint={t("Optional, hilft aber sehr bei Fehlern.", "Optional, but very helpful for troubleshooting.")}
                >
                  <textarea
                    rows={2}
                    className={inputCls}
                    value={draft.expected}
                    onChange={(e) => set("expected", e.target.value)}
                    placeholder={t("Beispiel: Beide Wiimotes treffen nach der Kalibrierung.", "Example: Both Wiimotes hit accurately after calibration.")}
                  />
                </Field>

                <Field
                  label={t("Diagnose-Ausgabe einfügen", "Insert Diagnostic Output")}
                  hint={
                    lang === "en" ? (
                      <>
                        Most helpful: the output of <code className="text-text">fagent doctor --json</code> or{" "}
                        <code className="text-text">fagent status</code>. We automatically mask usernames, profile paths, private IPs, SIDs,
                        and Bluetooth addresses – you can see the result in the preview.
                      </>
                    ) : (
                      <>
                        Am hilfreichsten: die Ausgabe von <code className="text-text">fagent doctor --json</code> oder{" "}
                        <code className="text-text">fagent status</code>. Wir maskieren Benutzernamen, Profilpfade, private IPs, SIDs
                        und Bluetooth-Adressen automatisch – du siehst das Ergebnis in der Vorschau.
                      </>
                    )
                  }
                >
                  <textarea rows={7} className={cn(inputCls, "font-mono text-xs")} value={draft.diagnostics} onChange={(e) => set("diagnostics", e.target.value)} placeholder={"❯ fagent doctor --json\n{ ... }"} spellCheck={false} />
                  {draft.diagnostics && (
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <Icon.Shield className="h-4 w-4 text-primary" />
                      {diagLive.total === 0 ? (
                        <span className="text-muted">{t("Nichts Persönliches erkannt.", "No personal data detected.")}</span>
                      ) : (
                        <>
                          <span className="text-primary">
                            {t(`${diagLive.total} Stelle(n) werden maskiert:`, `${diagLive.total} item(s) will be masked:`)}
                          </span>
                          {diagLive.hits.map((h) => (
                            <Tag key={h.label} tone="primary">
                              {h.label} ×{h.count}
                            </Tag>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </Field>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label={t("Nickname", "Nickname")} hint={t("Wie sollen wir dich nennen? Optional.", "What should we call you? Optional.")}>
                    <input className={inputCls} value={draft.nickname} onChange={(e) => set("nickname", e.target.value)} placeholder={t("z. B. FlipperFriedhelm", "e.g. PinballPete")} />
                  </Field>
                  <Field label={t("Kontakt für Rückfragen", "Contact for inquiries")} hint={t("Optional. E-Mail oder Forum-Handle.", "Optional. Email or forum handle.")}>
                    <input className={inputCls} value={draft.contact} onChange={(e) => set("contact", e.target.value)} placeholder={t("deine-email", "your-email")} />
                  </Field>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-border bg-bg/50 p-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#00e676]" checked={draft.allowContact} onChange={(e) => set("allowContact", e.target.checked)} />
                  <span className="text-muted">
                    {t("Ihr dürft mich bei Rückfragen kontaktieren.", "You may contact me with follow-up questions.")}{" "}
                    <span className="text-warning">
                      {t("Achtung: Der Kontakt steht dann im Report – bei GitHub öffentlich sichtbar.", "Note: Contact info will be included in the report – publicly visible on GitHub.")}
                    </span>
                  </span>
                </label>

                {/* Honeypot */}
                <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                  <label>
                    Website
                    <input tabIndex={-1} autoComplete="off" value={draft.website} onChange={(e) => set("website", e.target.value)} />
                  </label>
                </div>
              </div>
            )}

            {/* ===== Stage 4: Vorschau & Senden ===== */}
            {stage === 3 && (
              <div className="space-y-6">
                <StageHeader
                  n={4}
                  title={t("Vorschau & Freigabe", "Preview & Approval")}
                  sub={t("Wie beim Agenten: erst der Trockenlauf, dann dein Okay. Das hier ist exakt der Text, der verschickt wird.", "Just like with the agent: dry-run first, then your okay. This is the exact text that will be sent.")}
                />

                <Field label={t("Titel", "Title")} hint={t("Automatisch vorgeschlagen – darfst du ändern.", "Automatically suggested – feel free to edit.")}>
                  <input className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder={suggestTitle(draft)} />
                </Field>

                <div className="terminal overflow-hidden">
                  <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
                    <Icon.Eye className="h-4 w-4 text-primary" />
                    Dry-Run · report.md
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {report.labels.slice(0, 4).map((l) => (
                        <Tag key={l} tone="neutral">
                          {l}
                        </Tag>
                      ))}
                    </span>
                  </div>
                  <pre className="max-h-80 overflow-auto px-4 py-3 text-[12px] leading-relaxed whitespace-pre-wrap text-text/90">
                    <span className="text-primary"># {report.title}</span>
                    {"\n\n"}
                    {report.body}
                  </pre>
                  <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2 text-xs">
                    <Icon.Shield className="h-4 w-4 text-primary" />
                    {report.anonymized.total === 0 ? (
                      <span className="text-muted">
                        {t("Keine persönlichen Daten erkannt – bitte trotzdem kurz drüberlesen.", "No personal data detected – please review briefly anyway.")}
                      </span>
                    ) : (
                      <>
                        <span className="text-primary">
                          {t(`${report.anonymized.total} Stelle(n) anonymisiert:`, `${report.anonymized.total} item(s) anonymized:`)}
                        </span>
                        {report.anonymized.hits.map((h) => (
                          <Tag key={h.label} tone="primary">
                            {h.label} ×{h.count}
                          </Tag>
                        ))}
                      </>
                    )}
                  </div>
                </div>

                {/* Freigabe */}
                <label
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition",
                    approved ? "border-accent/60 bg-accent/5" : "border-border bg-bg/50",
                  )}
                >
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#ffd600]" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
                  <span className="text-sm">
                    <span className="font-semibold text-text">
                      {t("Ich habe die Vorschau gelesen und gebe den Report frei.", "I have reviewed the preview and approve this report.")}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      decided_by = <span className="font-mono text-accent">'human'</span> · {t("Es wird nur gesendet, was oben steht. Keine Cookies, kein Tracking.", "Only the text above will be transmitted. No cookies, no tracking.")}
                    </span>
                  </span>
                </label>

                {/* Sendewege */}
                {send.status === "sent" ? (
                  <div className="crt-vignette scanlines relative overflow-hidden rounded-xl border border-primary/40 bg-[#060a13] p-6 text-center">
                    <div className="font-pixel text-sm text-primary glow-green">LEVEL COMPLETE</div>
                    <div className="font-pixel mt-2 text-[9px] text-accent">★ ★ ★</div>
                    <p className="mx-auto mt-4 max-w-md text-sm text-muted">
                      {send.note ?? t("Danke! Dein Report ist angekommen. Genau solche Rückmeldungen machen den Agenten für alle besser.", "Thank you! Your report has arrived. Exactly these reports make the agent better for everyone.")}
                    </p>
                    {send.url && (
                      <a href={send.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-mono text-sm text-secondary hover:underline">
                        {t("Report öffentlich verfolgen", "Track report publicly")} {send.number ? `#${send.number}` : ""} <Icon.External className="h-4 w-4" />
                      </a>
                    )}
                    <div className="relative z-10 mt-5 flex flex-wrap justify-center gap-2">
                      <Button variant="outline" onClick={() => resetAll(true)}>
                        {t("Noch etwas melden (System behalten)", "Report another issue (keep system)")}
                      </Button>
                      <Button variant="ghost" onClick={() => resetAll(false)}>
                        {t("Neu anfangen", "Start over")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className={cn("space-y-3 transition", !approved && "pointer-events-none opacity-40")}>
                    {isSecurity ? (
                      <div className="rounded-xl border border-error/40 bg-error/5 p-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-error">
                          <Icon.Lock className="h-4 w-4" /> {t("Nur private Wege", "Private channels only")}
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          {t(
                            `Wir legen für Sicherheitsmeldungen kein öffentliches Issue an. Kopiere den Report und nutze GitHubs private Schwachstellenmeldung${hasEmail ? " oder die E-Mail" : ""}.`,
                            `We do not create a public issue for security reports. Copy the report and use GitHub's private vulnerability reporting${hasEmail ? " or email" : ""}.`,
                          )}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="danger" onClick={async () => { await doCopy(); window.open(feedbackConfig.securityUrl, "_blank", "noopener"); }}>
                            <Icon.Lock className="h-4 w-4" /> {t("Kopieren & privat melden", "Copy & report privately")}
                          </Button>
                          {hasEmail && (
                            <Button variant="outline" onClick={doMail}>
                              <Icon.Mail className="h-4 w-4" /> {t("Per E-Mail", "Via Email")}
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {direct && (
                            <button type="button" onClick={doDirect} disabled={send.status === "sending"} className="group flex items-center gap-3 rounded-xl border border-primary/50 bg-primary/10 p-4 text-left transition hover:bg-primary/15 disabled:opacity-60 sm:col-span-2">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary text-bg">
                                {send.status === "sending" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-bg border-t-transparent" /> : <Icon.Send className="h-5 w-5" />}
                              </span>
                              <span>
                                <span className="block text-sm font-semibold text-text">{t("Direkt senden – ohne Account", "Send directly – no account needed")}</span>
                                <span className="block text-xs text-muted">
                                  {direct === "endpoint"
                                    ? t("Landet automatisch als öffentlicher Report im Projekt. Du bekommst einen Link zum Mitverfolgen.", "Automatically lands as a public report in the project. You receive a link to track it.")
                                    : t("Geht direkt an das Projektteam. Kein Konto, keine Anmeldung.", "Goes directly to the project team. No account, no signup required.")}
                                </span>
                              </span>
                            </button>
                          )}
                          {hasEmail && (
                            <button type="button" onClick={doMail} className="flex items-center gap-3 rounded-xl border border-border bg-bg/50 p-4 text-left transition hover:border-secondary/60">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary/15 text-secondary">
                                <Icon.Mail className="h-5 w-5" />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold">{t("Per E-Mail senden", "Send via Email")}</span>
                                <span className="block text-xs text-muted">{t("Öffnet dein Mailprogramm, fertig ausgefüllt.", "Opens your email client, pre-filled.")}</span>
                              </span>
                            </button>
                          )}
                          <button type="button" onClick={doGithub} className="flex items-center gap-3 rounded-xl border border-border bg-bg/50 p-4 text-left transition hover:border-secondary/60">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-border/60 text-text">
                              <Icon.Github className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{t("Als GitHub-Issue öffnen", "Open as GitHub Issue")}</span>
                              <span className="block text-xs text-muted">{t("Falls du ein Konto hast: Formular ist vorausgefüllt.", "If you have an account: form is pre-filled.")}</span>
                            </span>
                          </button>
                          <button type="button" onClick={doCopy} className="flex items-center gap-3 rounded-xl border border-border bg-bg/50 p-4 text-left transition hover:border-accent/60">
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent/15 text-accent">
                              <Icon.Copy className="h-5 w-5" />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold">{copied ? t("Kopiert ✔", "Copied ✔") : t("Report kopieren", "Copy Report")}</span>
                              <span className="block text-xs text-muted">{t("In die Zwischenablage kopieren.", "Copy to clipboard.")}</span>
                            </span>
                          </button>
                        </div>
                        {!direct && !hasEmail && (
                          <p className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                            {t(
                              "Der Direktversand ist auf dieser Seite noch nicht aktiviert. Bitte nutze „Report kopieren“ oder den GitHub-Weg.",
                              "Direct submission is not yet enabled on this page. Please use 'Copy Report' or the GitHub option.",
                            )}
                          </p>
                        )}
                      </>
                    )}
                    {send.status === "error" && (
                      <div className="flex items-start gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-xs text-error">
                        <Icon.Alert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          {t("Direktversand fehlgeschlagen:", "Direct submission failed:")} {send.message}.{" "}
                          {t("Dein Entwurf ist gesichert – probiere „Report kopieren“ oder einen anderen Weg.", "Your draft is saved – try 'Copy Report' or another channel.")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ===== Navigation ===== */}
            {send.status !== "sent" && (
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
                <Button variant="ghost" onClick={() => goto(Math.max(0, stage - 1))} disabled={stage === 0}>
                  {t("← Zurück", "← Back")}
                </Button>
                <div className="flex items-center gap-3">
                  {!stageOk[stage] && stage < 3 && <span className="font-mono text-[11px] text-muted">{t("fehlt:", "missing:")} {missing[stage]}</span>}
                  {stage < 3 && (
                    <Button onClick={() => goto(stage + 1)} disabled={!stageOk[stage]}>
                      {stage === 2 ? t("Zur Vorschau", "To Preview") : t("Weiter", "Next")} <Icon.Arrow className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ---------- Seitenleiste ---------- */}
        <aside className="space-y-4">
          <div className="sticker p-5">
            <div className="font-pixel text-[10px] text-primary">HOW TO PLAY</div>
            <ol className="mt-3 space-y-3 text-sm">
              {[
                [t("Art wählen", "Select Type"), t("Kompatibilität, Fehler, Idee oder Frage.", "Compatibility, bug, idea, or question.")],
                [t("System beschreiben", "Describe System"), t("Ein paar Klicks – keine Fachbegriffe nötig.", "A few clicks – no jargon needed.")],
                [t("Erzählen", "Tell Your Story"), t("Was passiert ist. Diagnose-Ausgabe einfügen, wenn du sie hast.", "What happened. Paste diagnostics if available.")],
                [t("Vorschau freigeben", "Approve Preview"), t("Du siehst alles vorher. Dann senden – ohne Account.", "Review everything first. Then send – no account needed.")],
              ].map(([heading, sub], i) => (
                <li key={i} className="flex gap-3">
                  <span className="font-pixel mt-0.5 text-[9px] text-muted">0{i + 1}</span>
                  <span>
                    <span className="font-semibold">{heading}</span>
                    <span className="block text-xs text-muted">{sub}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div className="sticker p-5">
            <div className="flex items-center gap-2">
              <Icon.Terminal className="h-4 w-4 text-accent" />
              <span className="font-pixel text-[10px] text-accent">POWER-UP</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              {t(
                "Diese beiden Befehle liefern uns fast alles, was wir brauchen. Ausgabe kopieren und in Stage 3 einfügen:",
                "These two commands provide almost everything we need. Copy the output and paste it into Stage 3:",
              )}
            </p>
            <div className="mt-3 space-y-2 font-mono text-xs">
              {["fagent doctor --json", "fagent status --json"].map((c) => (
                <div key={c} className="flex items-center justify-between gap-2 rounded-md border border-border bg-bg/70 px-3 py-2">
                  <span className="text-primary">❯ {c}</span>
                  <button type="button" className="text-[10px] tracking-wider text-muted uppercase hover:text-text" onClick={() => copyText(c)}>
                    copy
                  </button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted">
              {t(
                "Läuft alles nur lokal? Perfekt – fagent sendet selbst nie etwas. Was du hier meldest, entscheidest allein du.",
                "Running locally only? Perfect – fagent never sends anything on its own. What you report here is entirely your decision.",
              )}
            </p>
          </div>

          <div className="sticker p-5">
            <div className="flex items-center gap-2">
              <Icon.Shield className="h-4 w-4 text-secondary" />
              <span className="font-pixel text-[10px] text-secondary">PRIVACY</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-muted">
              <li className="flex gap-2">
                <Icon.Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t("Kein Tracking, keine Cookies, kein Account.", "No tracking, no cookies, no account required.")}
              </li>
              <li className="flex gap-2">
                <Icon.Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t(
                  "Profilpfade, Benutzernamen, private IPs, SIDs, MAC-Adressen und Tokens werden vor dem Senden im Browser maskiert.",
                  "Profile paths, usernames, private IPs, SIDs, MAC addresses, and tokens are masked client-side before sending.",
                )}
              </li>
              <li className="flex gap-2">
                <Icon.Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t("Dein Entwurf liegt nur lokal in deinem Browser, bis du sendest.", "Your draft stays strictly local in your browser until you submit.")}
              </li>
              <li className="flex gap-2">
                <Icon.Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                {t("Öffentliche Reports sind für alle einsehbar – so profitieren alle Kabinett-Bauer davon.", "Public reports are viewable by everyone – benefiting all cabinet builders.")}
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-dashed border-border p-4 text-xs text-muted">
            {t("Du hast ein GitHub-Konto und magst es lieber klassisch?", "Have a GitHub account and prefer the classic way?")}{" "}
            <a className="text-secondary hover:underline" href={`https://github.com/${feedbackConfig.githubRepo}/issues`} target="_blank" rel="noreferrer">
              {t("Direkt zu den Issues", "Directly to Issues")}
            </a>
            .
          </div>
        </aside>
      </div>
    </Section>
  );
}

/* ---------------- Floating Action Button ---------------- */

export function FeedbackFab() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [inSection, setInSection] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 700);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const target = document.getElementById("feedback");
    let io: IntersectionObserver | undefined;
    if (target) {
      io = new IntersectionObserver(([e]) => setInSection(e.isIntersecting), { threshold: 0.05 });
      io.observe(target);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io?.disconnect();
    };
  }, []);

  return (
    <LinkButton
      href="#feedback"
      aria-label={t("System melden", "Report Setup")}
      className={cn(
        "fixed right-4 bottom-4 z-40 rounded-full px-4 py-3 shadow-[0_10px_30px_-8px_rgb(0_230_118/0.7)] transition-all duration-300 sm:right-6 sm:bottom-6",
        visible && !inSection ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
    >
      <Icon.Flag className="h-4 w-4" />
      {t("System melden", "Report Setup")}
    </LinkButton>
  );
}
