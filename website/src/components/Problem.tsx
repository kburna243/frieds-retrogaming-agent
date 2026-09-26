import { useLanguage } from "../i18n/LanguageContext";
import { Heading, Icon, Section, Tag } from "./ui";

export function Problem() {
  const { t } = useLanguage();

  const fragile = [
    {
      title: "Virtual Pinball",
      icon: Icon.Monitor,
      tone: "secondary" as const,
      items: [
        t("3 Bildschirme, asymmetrische Geometrien", "3 screens, asymmetric geometries"),
        t("DirectInput-Encoder & DmdDevice-Routinen", "DirectInput encoders & DmdDevice routines"),
        t("COM-Objekte, SQLite-DBs (PinUP Popper)", "COM objects, SQLite DBs (PinUP Popper)"),
        "VPX · Future Pinball · PinUP",
      ],
    },
    {
      title: "Lightgun-Systeme",
      icon: Icon.Crosshair,
      tone: "accent" as const,
      items: [
        t("DolphinBar Mode 4 & Wiimote-Bluetooth", "DolphinBar Mode 4 & Wiimote Bluetooth"),
        t("ViGEmBus-Treiber & DemulShooter-Hooks", "ViGEmBus drivers & DemulShooter hooks"),
        t("TeknoParrot-XMLs & RawInput", "TeknoParrot XML configs & RawInput"),
        t("Steam-Desktop-Controller-Konflikte", "Steam Desktop controller conflicts"),
      ],
    },
  ];

  const damage = [
    t("Überschreibt INI-Dateien blind", "Blindly overwrites INI config files"),
    t("Manipuliert globale Windows Registry-Keys", "Manipulates global Windows Registry keys"),
    t("Übersieht kritische Vorbedingungen", "Misses critical hardware prerequisites"),
    t("Sperrt Controller-Eingaben im Spiel", "Blocks controller inputs mid-game"),
  ];

  return (
    <Section id="problem">
      <Heading
        eyebrow={t("Level 1 · Das Problem", "Level 1 · The Problem")}
        title={
          <>
            {t("Warum herkömmliche KI an ", "Why generic AI fails on ")}
            <span className="text-error">{t("Retro-Hardware", "Retro Hardware")}</span>
            {t(" scheitert", "")}
          </>
        }
        sub={t(
          "Ein modernes Arcade- oder Flipper-Kabinett ist ein hochempfindliches Meisterwerk aus Software und Treibern. Ein falscher Schreibzugriff – und der Abend ist gelaufen.",
          "A modern arcade or virtual pinball cabinet is a delicate balance of legacy drivers and software. One blind write operation – and your gaming night is ruined.",
        )}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {fragile.map((f) => (
          <div key={f.title} className="sticker sticker-hover reveal p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-border/60 text-text">
                <f.icon className="h-6 w-6" />
              </span>
              <Tag tone={f.tone}>{t("fragil", "fragile")}</Tag>
            </div>
            <h3 className="font-display text-2xl">{f.title}</h3>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              {f.items.map((i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-primary font-mono">▸</span>
                  {i}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="sticker border-error/40 bg-error/[0.04] p-6 reveal">
          <div className="mb-4 flex items-center justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-error/15 text-error">
              <Icon.Skull className="h-6 w-6" />
            </span>
            <Tag tone="error">{t("Gefahr", "Danger")}</Tag>
          </div>
          <h3 className="font-display text-2xl text-error">
            {t("Klassische LLMs im Blindflug", "Unrestricted LLMs Blind Flight")}
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {damage.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="text-error font-mono">✖</span>
                {d}
              </li>
            ))}
          </ul>
          <div className="mt-6 rounded-lg border border-error/30 bg-bg/60 p-3 text-xs text-muted font-mono">
            {t(
              "Ein Prompt wie „Repariere meine Lightgun“ führt ohne Gate oft zu totalem Datenverlust.",
              "A prompt like 'Fix my lightgun' without a gate often leads to total configuration loss.",
            )}
          </div>
        </div>
      </div>
    </Section>
  );
}
