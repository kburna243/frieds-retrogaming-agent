import { useLanguage } from "../i18n/LanguageContext";
import { Mascot } from "./Mascot";
import { Icon, Tag } from "./ui";

export function HardwareDetails() {
  const { t } = useLanguage();

  const setups = [
    {
      title: "Virtual Pinball (3-Screen Setup)",
      descDe: "Die Königsklasse des Flipper-Baus: Drei synchronisierte Bildschirme mit millimetergenauer Geometrie.",
      descEn: "The premier league of pinball builds: Three synchronized screens with pixel-accurate geometry.",
      specs: [
        { label: "Playfield", val: "4K 120Hz / 60Hz · VPX 10.8" },
        { label: "Backglass", val: "1080p · DirectOutput Framework (DOF)" },
        { label: "DMD Screen", val: "Ultra-wide / Real DMD · DmdDevice.ini" },
        { label: "Frontend", val: "PinUP Popper (SQLite-basierte Datenbank)" },
      ],
      checks: [
        t("Screen-Rollen im Kit hinterlegt", "Screen roles stored in kit"),
        t("Offset-Prüfung gegen DmdDevice.ini", "Offset verification against DmdDevice.ini"),
        t("Automatische Backups vor jeder Geometrie-Änderung", "Automated backups before geometry edits"),
      ],
    },
    {
      title: "Lightgun System (Wiimote & DolphinBar)",
      descDe: "Präzises Zielen für Arcade-Klassiker wie Time Crisis, House of the Dead und Virtua Cop.",
      descEn: "Pinpoint accuracy for arcade classics like Time Crisis, House of the Dead and Virtua Cop.",
      specs: [
        { label: "Controller", val: "Nintendo Wiimote ×2 mit MotionPlus" },
        { label: "Sensor Bar", val: "Mayflash DolphinBar (Hardware Mode 4)" },
        { label: "Hook Engine", val: "DemulShooter (RawInput / DirectInput)" },
        { label: "Driver", val: "ViGEmBus (Virtual Gamepad Emulation)" },
      ],
      checks: [
        t("DolphinBar Modus-Erkennung (Mode 4)", "DolphinBar Mode 4 detection"),
        t("DemulShooter Profil-Verifikation", "DemulShooter profile verification"),
        t("ViGEmBus Treiberstatus & Autostart", "ViGEmBus driver health & autostart"),
      ],
    },
    {
      title: "Arcade & Racing (Wheels, Sticks & Gamepads)",
      descDe: "Volle Kontrolle für Arcade-Fighter, Racing-Simulationen und Mehrspieler-Konsolen.",
      descEn: "Full control for arcade fighters, racing sims and multi-player console gaming.",
      specs: [
        { label: "Racing Wheels", val: "Logitech G25-G923, Thrustmaster, Fanatec" },
        { label: "Arcade Sticks", val: "Brook UFB, GP2040-CE, Ultimarc I-PAC, Hori" },
        { label: "Gamepads", val: "Xbox, DualShock 4 / DualSense, Switch Pro, 8BitDo" },
        { label: "Emulatoren", val: "MAME, Supermodel (Model 3), Model 2, RetroBat" },
      ],
      checks: [
        t("Automatische VID:PID HID-Erkennung", "Automatic VID:PID HID detection"),
        t("Steam-Controller-Blacklist Guard", "Steam controller blacklist guard"),
        t("Multi-Controller retrobat.ini Mapping", "Multi-controller retrobat.ini mapping"),
      ],
    },
  ];

  const liveReportFindings = [
    {
      check: "fagent doctor --transport mcp",
      status: "OK",
      detail: t("mcp-stdio · kit v0.3.0 · schema v2", "mcp-stdio · kit v0.3.0 · schema v2"),
    },
    {
      check: "fagent status --transport mcp",
      status: "11 OK",
      detail: t("0 Fehler, 0 Warnungen am Automaten", "0 errors, 0 warnings on cabinet"),
    },
    {
      check: "fagent chat --model llama3.2:3b",
      status: "VERIFIED",
      detail: t("Autonomer Tool-Call cabinet_status {} ausgeführt", "Autonomous cabinet_status {} tool-call executed"),
    },
    {
      check: "fagent run support.bundle",
      status: "AUDITED",
      detail: t("Dry-Run gezeigt, Ablehnung 'no' in SQLite protokolliert", "Dry-run rendered, refusal 'no' logged to SQLite"),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Setups grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {setups.map((s, idx) => (
          <div key={idx} className="sticker p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-display text-2xl text-text">{s.title}</h4>
                <Tag tone={idx === 0 ? "secondary" : "accent"}>
                  {idx === 0 ? "Pinball" : "Lightgun"}
                </Tag>
              </div>
              <p className="mt-3 text-sm text-muted">{t(s.descDe, s.descEn)}</p>

              {/* Specs definition */}
              <div className="mt-5 space-y-2 font-mono text-xs">
                {s.specs.map((sp) => (
                  <div key={sp.label} className="flex justify-between rounded bg-bg/50 px-3 py-1.5 border border-border">
                    <span className="text-muted">{sp.label}:</span>
                    <span className="text-primary font-semibold">{sp.val}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <span className="font-mono text-[10px] uppercase text-muted tracking-wider block mb-2">
                {t("Agent-Sicherheitsprüfungen:", "Agent safety checks:")}
              </span>
              <ul className="space-y-1 text-xs text-muted">
                {s.checks.map((ck) => (
                  <li key={ck} className="flex items-center gap-2">
                    <span className="text-primary font-mono">✔</span>
                    {ck}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Live Machine Verification Report Card */}
      <div className="sticker p-6 sm:p-7 border-primary/40 bg-surface/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/20 text-primary">
              <Icon.Check className="h-6 w-6" />
            </span>
            <div>
              <h4 className="font-display text-2xl text-text">
                {t("Hardware-Verifikationsbericht (M4 & M5)", "Hardware Verification Report (M4 & M5)")}
              </h4>
              <span className="font-mono text-xs text-muted">
                {t("Direkt am physischen Automaten getestet", "Directly verified on physical arcade hardware")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Tag tone="primary" dot>
              {t("Live Bestanden", "Live Passed")}
            </Tag>
            <Mascot pose="celebrate" size="xs" glow={false} />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {liveReportFindings.map((f, i) => (
            <div key={i} className="rounded-xl border border-border bg-bg/60 p-3.5 font-mono text-xs">
              <div className="text-muted truncate mb-1">{f.check}</div>
              <div className="text-primary font-bold text-sm">{f.status}</div>
              <div className="text-[11px] text-muted mt-1 leading-snug">{f.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
