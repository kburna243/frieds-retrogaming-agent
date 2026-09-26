import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Mascot, type MascotPose } from "./Mascot";
import { Button, Heading, Icon, Section, Tag } from "./ui";

/* ---------------- Scenario data ---------------- */

type Level = "read-only" | "operator";

interface Scenario {
  id: string;
  labelDe: string;
  labelEn: string;
  step: string;
  params: Record<string, string>;
  findingsDe: { kind: "ok" | "warn" | "err"; text: string }[];
  findingsEn: { kind: "ok" | "warn" | "err"; text: string }[];
  planDe: string[];
  planEn: string[];
  verifyDe: string[];
  verifyEn: string[];
}

const scenarios: Scenario[] = [
  {
    id: "lightgun",
    labelDe: "Wiimote zielt daneben",
    labelEn: "Wiimote aiming misaligned",
    step: "step.lightgun.02-hardware",
    params: { RetroBatRoot: "C:\\RetroBat" },
    findingsDe: [
      { kind: "ok", text: "Wiimote ×2 gepaart" },
      { kind: "warn", text: "DolphinBar: Mode 1 (erwartet Mode 4)" },
      { kind: "err", text: "ViGEmBus meldet Konflikt (0x1F)" },
    ],
    findingsEn: [
      { kind: "ok", text: "Wiimote ×2 paired" },
      { kind: "warn", text: "DolphinBar: Mode 1 (expected Mode 4)" },
      { kind: "err", text: "ViGEmBus reports conflict (0x1F)" },
    ],
    planDe: [
      "Kalibrierungsdaten prüfen (Player 2)",
      "ViGEmBus-Treiber neu einbinden",
      "Backup: DemulShooter.ini → DemulShooter.ini.bak",
    ],
    planEn: [
      "Check calibration offsets (Player 2)",
      "Re-bind ViGEmBus driver",
      "Backup: DemulShooter.ini → DemulShooter.ini.bak",
    ],
    verifyDe: ["ViGEmBus OK", "DolphinBar Mode 4", "HotD2 Profil: XInput mapping OK"],
    verifyEn: ["ViGEmBus OK", "DolphinBar Mode 4", "HotD2 profile: XInput mapping OK"],
  },
  {
    id: "dmd",
    labelDe: "DMD wird abgeschnitten",
    labelEn: "DMD display cut off",
    step: "step.pinball.04-geometry",
    params: { PinballRoot: "C:\\vPinball" },
    findingsDe: [
      { kind: "ok", text: "3 Screens erkannt (Playfield / Backglass / DMD)" },
      { kind: "warn", text: "DmdDevice.ini: Offset 1920×0 ≠ Backglass 1680×0" },
      { kind: "ok", text: "VPX 10.8 · PinUP Popper DB erreichbar" },
    ],
    findingsEn: [
      { kind: "ok", text: "3 screens detected (Playfield / Backglass / DMD)" },
      { kind: "warn", text: "DmdDevice.ini: Offset 1920×0 ≠ Backglass 1680×0" },
      { kind: "ok", text: "VPX 10.8 · PinUP Popper DB reachable" },
    ],
    planDe: [
      "DmdDevice.ini: virtualdmd.left 1920 → 1680",
      "virtualdmd.width 1024 → 1280 (pixelgenau)",
      "Backup: DmdDevice.ini → DmdDevice.ini.bak",
    ],
    planEn: [
      "DmdDevice.ini: virtualdmd.left 1920 → 1680",
      "virtualdmd.width 1024 → 1280 (pixel-exact)",
      "Backup: DmdDevice.ini → DmdDevice.ini.bak",
    ],
    verifyDe: ["DMD innerhalb Backglass-Bounds", "Screen-Rollen konsistent", "Backup vorhanden"],
    verifyEn: ["DMD inside backglass bounds", "Screen roles consistent", "Backup verified"],
  },
  {
    id: "migrate",
    labelDe: "Kabinett-Umzug A → B",
    labelEn: "Cabinet Migration A → B",
    step: "step.migrate.01-export",
    params: { Target: "D:\\export\\cab-A.zip" },
    findingsDe: [
      { kind: "ok", text: "Tokenisierung: {PinballRoot}, {RetroBatRoot}" },
      { kind: "ok", text: "1.284 Konfig-Dateien indiziert" },
      { kind: "warn", text: "2 absolute Pfade ohne Token gefunden" },
    ],
    findingsEn: [
      { kind: "ok", text: "Tokenization: {PinballRoot}, {RetroBatRoot}" },
      { kind: "ok", text: "1,284 config files indexed" },
      { kind: "warn", text: "2 absolute paths without tokens found" },
    ],
    planDe: [
      "Konfigurationen tokenisieren",
      "Archiv schreiben: cab-A.zip (≈ 48 MB)",
      "Manifest + SHA-256 Prüfsummen erzeugen",
    ],
    planEn: [
      "Tokenize configurations",
      "Write archive: cab-A.zip (≈ 48 MB)",
      "Generate manifest + SHA-256 checksums",
    ],
    verifyDe: ["Archiv lesbar", "Prüfsummen OK", "Import-Plan für Zielrechner bereit"],
    verifyEn: ["Archive readable", "Checksums OK", "Import plan ready for target machine"],
  },
];

type Phase =
  | "idle"
  | "level"
  | "guard"
  | "dryrun"
  | "approval"
  | "apply"
  | "verify"
  | "done"
  | "blocked"
  | "rejected";

interface AuditRow {
  id: number;
  ts: string;
  event: string;
  decidedBy: "human" | "policy" | "—";
  tone: "primary" | "accent" | "error" | "neutral" | "secondary";
}

const phaseOrder: Phase[] = ["level", "guard", "dryrun", "approval", "apply", "verify", "done"];

const now = () =>
  new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export function PolicyGateDemo() {
  const { lang, t } = useLanguage();
  const [scenario, setScenario] = useState<Scenario>(scenarios[0]);
  const [level, setLevel] = useState<Level>("operator");
  const [phase, setPhase] = useState<Phase>("idle");
  const [log, setLog] = useState<{ kind: string; text: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [applyProgress, setApplyProgress] = useState(0);
  const [shake, setShake] = useState(false);
  const auditId = useRef(1041);
  const logRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const push = (kind: string, text: string) => setLog((l) => [...l, { kind, text }]);
  const addAudit = (event: string, decidedBy: AuditRow["decidedBy"], tone: AuditRow["tone"]) =>
    setAudit((a) => [{ id: ++auditId.current, ts: now(), event, decidedBy, tone }, ...a].slice(0, 8));

  const schedule = (fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms);
    timers.current.push(t);
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [log]);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setPhase("idle");
    setLog([]);
    setAnswer("");
    setApplyProgress(0);
  };

  const startRun = () => {
    reset();

    const isEn = lang === "en";
    push("cmd", `fagent run ${scenario.step} --level ${level}`);
    setPhase("level");

    // Stage 1: Level Check
    schedule(() => {
      if (level === "read-only") {
        setPhase("blocked");
        push(
          "err",
          isEn
            ? "✖ Policy Engine: LEVEL_DENIED — step requires operator level (current: read-only)"
            : "✖ Policy Engine: LEVEL_DENIED — Schritt erfordert Level operator (aktuell: read-only)",
        );
        addAudit(`LEVEL_DENIED (${scenario.step})`, "policy", "error");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      push(
        "ok",
        isEn
          ? "✔ Stage 1/6 (Level-Filter): operator granted for " + scenario.step
          : "✔ Stufe 1/6 (Level-Filter): operator zulässig für " + scenario.step,
      );
      setPhase("guard");

      // Stage 2: Param Guard
      schedule(() => {
        push(
          "ok",
          isEn
            ? "✔ Stage 2/6 (Param-Guard): Primitives valid · -Anonymize active"
            : "✔ Stufe 2/6 (Param-Guard): Primitive Typen valide · -Anonymize aktiv",
        );
        setPhase("dryrun");

        // Stage 3: Dry-Run
        schedule(() => {
          push(
            "info",
            isEn
              ? `▸ Stage 3/6 (Dry-Run): executing ${scenario.step} with -WhatIf …`
              : `▸ Stufe 3/6 (Dry-Run): führe ${scenario.step} mit -WhatIf aus …`,
          );

          const findings = isEn ? scenario.findingsEn : scenario.findingsDe;
          findings.forEach((f) => push(f.kind, `  ${f.kind === "ok" ? "✔" : f.kind === "warn" ? "⚠" : "✖"} ${f.text}`));

          push(
            "plain",
            isEn
              ? "──────────────────────────────────────────────────────\n" +
                `PLAN FÜR ${scenario.step}:\n` +
                scenario.planEn.map((p, i) => `  ${i + 1}. ${p}`).join("\n") +
                "\n──────────────────────────────────────────────────────"
              : "──────────────────────────────────────────────────────\n" +
                `PLAN FÜR ${scenario.step}:\n` +
                scenario.planDe.map((p, i) => `  ${i + 1}. ${p}`).join("\n") +
                "\n──────────────────────────────────────────────────────",
          );

          setPhase("approval");
          push(
            "warn",
            isEn
              ? "? Stage 4/6 (Human Approval): Apply this change? Type [yes/no]:"
              : "? Stufe 4/6 (Human Approval): Plan jetzt ausführen? Tippe [yes/no]:",
          );
          addAudit(
            isEn ? `Plan generated: ${scenario.step}` : `Plan generiert: ${scenario.step}`,
            "—",
            "accent",
          );
        }, 600);
      }, 500);
    }, 450);
  };

  const submitAnswer = (override?: string) => {
    if (phase !== "approval") return;
    const isEn = lang === "en";
    const text = (override ?? answer).trim().toLowerCase();
    setAnswer("");
    push("cmd", text);

    if (text === "yes") {
      setPhase("apply");
      addAudit(
        isEn ? `APPROVED: ${scenario.step}` : `GENEHMIGT: ${scenario.step}`,
        "human",
        "primary",
      );
      push(
        "ok",
        isEn
          ? "✔ Stage 5/6 (Apply): executing with -Approved and -Apply …"
          : "✔ Stufe 5/6 (Apply): Ausführung mit -Approved und -Apply …",
      );

      let p = 0;
      const interval = window.setInterval(() => {
        p += 0.34;
        if (p >= 1) {
          window.clearInterval(interval);
          setApplyProgress(1);
          setPhase("verify");

          schedule(() => {
            push(
              "info",
              isEn
                ? "▸ Stage 6/6 (Verify): Re-running health checks on machine …"
                : "▸ Stufe 6/6 (Verify): Führe Zustandsprüfung auf Maschine durch …",
            );
            const verifyList = isEn ? scenario.verifyEn : scenario.verifyDe;
            verifyList.forEach((v) => push("ok", `  ✔ ${v}`));
            push(
              "ok",
              isEn
                ? "✔ ALL GREEN — Session #1042 successfully committed to SQLite."
                : "✔ ALLES GRÜN — Sitzung #1042 erfolgreich in SQLite festgeschrieben.",
            );
            setPhase("done");
            addAudit(
              isEn ? `APPLIED & VERIFIED: ${scenario.step}` : `ANGEWENDET & VERIFIZIERT: ${scenario.step}`,
              "policy",
              "primary",
            );
          }, 500);
        } else {
          setApplyProgress(p);
        }
      }, 250);
    } else {
      setPhase("rejected");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      push(
        "err",
        isEn
          ? `✖ ABORTED: Input "${text}" ≠ "yes". No changes were written to disk.`
          : `✖ ABGEBROCHEN: Eingabe „${text}“ ≠ „yes“. Keine Änderungen geschrieben.`,
      );
      addAudit(
        isEn ? `REFUSED: ${scenario.step} (${text || "empty"})` : `ABGELEHNT: ${scenario.step} (${text || "leer"})`,
        "human",
        "error",
      );
    }
  };

  const running = phase !== "idle" && phase !== "done" && phase !== "blocked" && phase !== "rejected";

  // Mascot dynamic state
  let mascotPose: MascotPose = "friendly";
  let mascotSpeech = t("Wähle ein Szenario und starte das Gate!", "Pick a scenario and test the gate!");

  if (phase === "level" || phase === "guard") {
    mascotPose = "neutral";
    mascotSpeech = t("Prüfe Level & Parameter...", "Checking level & parameters...");
  } else if (phase === "dryrun") {
    mascotPose = "laptop";
    mascotSpeech = t("Erstelle Trockenlauf (-WhatIf)...", "Creating dry-run plan (-WhatIf)...");
  } else if (phase === "approval") {
    mascotPose = "surprised";
    mascotSpeech = t("HALT! Warte auf dein 'yes'!", "HOLD ON! Waiting for your 'yes'!");
  } else if (phase === "apply") {
    mascotPose = "controller";
    mascotSpeech = t("Wende genehmigten Plan an...", "Applying approved plan...");
  } else if (phase === "verify" || phase === "done") {
    mascotPose = "celebrate";
    mascotSpeech = t("Perfekt! Alles verifiziert & grün!", "Awesome! All verified & green!");
  } else if (phase === "rejected" || phase === "blocked") {
    mascotPose = "neutral";
    mascotSpeech = t("Nichts verändert – Kabinett ist sicher!", "Nothing touched – cabinet is safe!");
  }

  const phaseLabel: Record<string, string> = {
    level: t("Level-Filter", "Level Filter"),
    guard: t("Param-Guard", "Param Guard"),
    dryrun: "Dry-Run",
    approval: "Approval",
    apply: "Apply",
    verify: "Verify",
    done: "Audit",
  };

  return (
    <Section id="demo" className="relative">
      <Heading
        eyebrow={t("Level 4 · Live-Simulator", "Level 4 · Live Simulator")}
        accent="accent"
        title={
          <>
            {t("Das Policy-Gate ", "Experience the ")}
            <span className="text-primary glow-green">{t("im Einsatz", "Policy Gate Live")}</span>
          </>
        }
        sub={t(
          "Erlebe den 6-Stufen-Sicherheitslauf interaktiv. Schalte zwischen Szenarien um oder verweigere die Freigabe, um den Schutzmechanismus zu testen.",
          "Experience the 6-stage security pipeline interactively. Switch scenarios or refuse approval to test the zero-compromise safety mechanism.",
        )}
      />

      {/* Control bar */}
      <div className="reveal sticker mb-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-muted mr-1">{t("Szenario:", "Scenario:")}</span>
          {scenarios.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setScenario(s);
                reset();
              }}
              className={cn(
                "rounded-md px-3 py-1.5 font-mono text-xs transition",
                scenario.id === s.id
                  ? "bg-primary text-bg font-semibold shadow-[0_0_10px_rgb(0_230_118/0.4)]"
                  : "bg-surface border border-border text-muted hover:text-text",
              )}
            >
              {lang === "en" ? s.labelEn : s.labelDe}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 font-mono text-xs">
            <span className="px-2 text-muted">{t("Level:", "Level:")}</span>
            <button
              onClick={() => {
                setLevel("read-only");
                reset();
              }}
              className={cn(
                "rounded px-2 py-0.5 transition",
                level === "read-only" ? "bg-secondary text-bg font-semibold" : "text-muted hover:text-text",
              )}
            >
              read-only
            </button>
            <button
              onClick={() => {
                setLevel("operator");
                reset();
              }}
              className={cn(
                "rounded px-2 py-0.5 transition",
                level === "operator" ? "bg-accent text-bg font-semibold" : "text-muted hover:text-text",
              )}
            >
              operator
            </button>
          </div>

          <Button onClick={startRun} disabled={running} className="px-4 py-1.5 text-xs">
            <Icon.Play className="h-3.5 w-3.5" />
            {t("Durchlauf starten", "Run Pipeline")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
        {/* Left: Terminal & mascot buddy */}
        <div className={cn("space-y-4", shake && "animate-shake")}>
          {/* Top Stage Tracker with Mascot Buddy */}
          <div className="sticker p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            {/* Steps indicator */}
            <div className="flex flex-1 items-center justify-between w-full">
              {phaseOrder.map((p, idx) => {
                const currentIdx = phaseOrder.indexOf(phase as Phase);
                const isFinished = phase === "done" || (currentIdx > idx && currentIdx !== -1);
                const isActive = phase === p;
                return (
                  <div key={p} className="flex flex-col items-center">
                    <div
                      className={cn(
                        "font-pixel grid h-7 w-7 place-items-center rounded-md text-[9px] transition",
                        isFinished && "bg-primary text-bg",
                        isActive && "bg-accent text-bg animate-pulse",
                        !isFinished && !isActive && "bg-surface border border-border text-muted",
                      )}
                    >
                      {idx + 1}
                    </div>
                    <span className="mt-1 hidden font-mono text-[9px] text-muted sm:block">
                      {phaseLabel[p]}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Live Mascot Buddy */}
            <div className="shrink-0 flex items-center border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 sm:pl-4">
              <Mascot pose={mascotPose} size="sm" speech={mascotSpeech} glow={false} />
            </div>
          </div>

          {/* Interactive Terminal */}
          <div className="terminal relative overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted">
              <Icon.Terminal className="h-4 w-4 text-primary" />
              fake-cabinet · policy-gate
              <span className="ml-auto flex items-center gap-2">
                {running && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
                {phase === "done" && <Tag tone="primary">{t("Erfolg", "success")}</Tag>}
                {phase === "blocked" && <Tag tone="error">{t("Blockiert", "blocked")}</Tag>}
                {phase === "rejected" && <Tag tone="error">{t("Abgelehnt", "rejected")}</Tag>}
              </span>
            </div>

            <div ref={logRef} className="h-72 overflow-y-auto px-4 py-3 text-[13px] leading-relaxed">
              {log.length === 0 && (
                <div className="text-muted">
                  <span className="text-primary">❯</span>{" "}
                  {t(
                    "Bereit. Drücke „Durchlauf starten“, um das Policy-Gate zu testen.",
                    "Ready. Click 'Run Pipeline' to test the Policy Gate.",
                  )}
                </div>
              )}
              {log.map((l, i) => (
                <div
                  key={i}
                  className={cn(
                    "whitespace-pre-wrap",
                    l.kind === "cmd" && "text-text",
                    l.kind === "ok" && "text-primary",
                    l.kind === "warn" && "text-warning",
                    l.kind === "err" && "text-error",
                    l.kind === "info" && "text-secondary",
                    l.kind === "dim" && "text-muted",
                    l.kind === "plain" && "text-text/90",
                  )}
                >
                  {l.kind === "cmd" && <span className="mr-2 text-primary">❯</span>}
                  {l.text}
                </div>
              ))}
              {phase === "apply" && (
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-border">
                  <div
                    className="h-full bg-primary transition-all duration-500"
                    style={{ width: `${applyProgress * 100}%` }}
                  />
                </div>
              )}
            </div>

            {/* Approval input form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitAnswer();
              }}
              className={cn(
                "flex items-center gap-2 border-t border-border px-3 py-2.5 transition",
                phase === "approval" ? "bg-accent/10" : "opacity-50",
              )}
            >
              <span className="font-mono text-xs text-accent">human@cabinet ❯</span>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                disabled={phase !== "approval"}
                placeholder={
                  phase === "approval"
                    ? t("Tippe 'yes' oder 'no'", "Type 'yes' or 'no'")
                    : t("wartet auf Plan …", "waiting for plan …")
                }
                className="flex-1 bg-transparent font-mono text-sm text-text outline-none placeholder:text-muted/60"
                autoComplete="off"
              />
              {phase === "approval" && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => submitAnswer("yes")}
                    className="rounded bg-primary/20 hover:bg-primary/30 border border-primary/40 px-2 py-1 font-mono text-[10px] text-primary font-bold"
                  >
                    [yes]
                  </button>
                  <button
                    type="button"
                    onClick={() => submitAnswer("no")}
                    className="rounded bg-error/20 hover:bg-error/30 border border-error/40 px-2 py-1 font-mono text-[10px] text-error font-bold"
                  >
                    [no]
                  </button>
                </div>
              )}
              <Button
                type="submit"
                variant="secondary"
                disabled={phase !== "approval"}
                className="px-3 py-1.5 text-xs"
              >
                Enter
              </Button>
            </form>
          </div>
        </div>

        {/* Right: Audit Trail table */}
        <div className="space-y-4">
          <div className="sticker p-5">
            <div className="flex items-center gap-2">
              <Icon.Database className="h-5 w-5 text-secondary" />
              <h3 className="font-display text-2xl">Audit-Trail</h3>
              <Tag tone="secondary" className="ml-auto">
                node:sqlite · WAL
              </Tag>
            </div>
            <p className="mt-1 text-xs text-muted">
              {t(
                "Unveränderliche Historie aller Ereignisse in harness.db.",
                "Immutable event log stored inside harness.db.",
              )}
            </p>

            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-bg/60">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface text-muted">
                    <th className="px-3 py-2 font-normal">#</th>
                    <th className="px-3 py-2 font-normal">Zeit</th>
                    <th className="px-3 py-2 font-normal">Event</th>
                    <th className="px-3 py-2 font-normal">Actor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {audit.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-muted">
                        {t("Noch keine Events aufgezeichnet.", "No events recorded yet.")}
                      </td>
                    </tr>
                  ) : (
                    audit.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-surface/50">
                        <td className="px-3 py-2 text-muted">#{r.id}</td>
                        <td className="px-3 py-2 text-muted">{r.ts}</td>
                        <td
                          className={cn(
                            "px-3 py-2 font-semibold",
                            r.tone === "primary" && "text-primary",
                            r.tone === "accent" && "text-accent",
                            r.tone === "error" && "text-error",
                            r.tone === "secondary" && "text-secondary",
                          )}
                        >
                          {r.event}
                        </td>
                        <td className="px-3 py-2 text-muted">{r.decidedBy}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
