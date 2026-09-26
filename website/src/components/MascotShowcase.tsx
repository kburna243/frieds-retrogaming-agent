import { useState } from "react";
import { MASCOT_POSES, Mascot, type MascotPose } from "./Mascot";
import { Heading, Section, Tag } from "./ui";
import { useLanguage } from "../i18n/LanguageContext";
import charSheetPng from "../assets/mascot/fried-rgsp-charactersheet.png";
import logoSheetPng from "../assets/mascot/fried-rgsp-logostylesheet.png";

export function MascotShowcase() {
  const { lang, t } = useLanguage();
  const [selectedPose, setSelectedPose] = useState<MascotPose>("controller");

  const poseInfo = MASCOT_POSES[selectedPose];

  return (
    <Section id="mascot" className="relative overflow-hidden bg-surface/40">
      <div className="pixel-grid absolute inset-0 -z-10" />

      <Heading
        eyebrow={t("Brand Identity · Mascot Studio", "Brand Identity · Mascot Studio")}
        accent="accent"
        title={
          <>
            {t("Lerne ", "Meet ")}
            <span className="text-primary glow-green">Fried</span>
            {t(" kennen – Das CRT-Maskottchen", " – The CRT Mascot")}
          </>
        }
        sub={t(
          "Retro-Gaming-Expertise trifft moderne Agentic AI. Fried vereint den Charme eines klassischen Röhrenmonitors mit königlicher Krone und pixelgenauer Sorgfalt.",
          "Retro gaming expertise meets modern agentic AI. Fried unites the charm of a classic CRT monitor with a royal crown and pixel-perfect care.",
        )}
      />

      <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: Interactive Pose Soundboard / Explorer */}
        <div className="sticker p-6 sm:p-8">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <span className="font-mono text-xs uppercase tracking-wider text-muted">
                {t("Aktive Pose", "Active Pose")}
              </span>
              <h3 className="font-display text-2xl text-text">
                {lang === "en" ? poseInfo.titleEn : poseInfo.titleDe}
              </h3>
            </div>
            <Tag tone="accent">
              <span className="font-pixel text-[10px]">CRT v1.0</span>
            </Tag>
          </div>

          {/* Big stage */}
          <div className="relative my-8 flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-border/80 bg-bg/70 p-6 shadow-inner">
            <div className="scanlines pointer-events-none absolute inset-0 rounded-2xl" />
            <Mascot
              pose={selectedPose}
              size="xl"
              float
              interactive
              speech={lang === "en" ? poseInfo.vibeEn : poseInfo.vibeDe}
            />
          </div>

          {/* Pose Selector Grid */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-xs text-muted">
                {t("Klicke eine Pose zum Ausprobieren:", "Click a pose to test:")}
              </span>
              <span className="font-mono text-[10px] text-primary">
                9 {t("Ausdrücke", "Expressions")}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-9">
              {(Object.keys(MASCOT_POSES) as MascotPose[]).map((key) => {
                const item = MASCOT_POSES[key];
                const active = selectedPose === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedPose(key)}
                    className={`group relative flex flex-col items-center rounded-xl border p-2 transition ${
                      active
                        ? "border-primary bg-primary/10 shadow-[0_0_12px_rgb(0_230_118/0.3)]"
                        : "border-border bg-surface/60 hover:border-primary/40 hover:bg-surface"
                    }`}
                  >
                    <img
                      src={item.src}
                      alt={item.titleDe}
                      className="h-10 w-10 object-contain transition-transform group-hover:scale-110"
                    />
                    <span className="mt-1 line-clamp-1 font-mono text-[9px] text-muted">
                      {lang === "en" ? item.titleEn : item.titleDe}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Character Anatomy & Design Sheet */}
        <div className="space-y-6">
          <div className="sticker p-6">
            <h4 className="font-display text-xl text-primary">
              {t("Die Anatomie des Charakters", "The Character Anatomy")}
            </h4>
            <div className="mt-4 grid gap-3 font-mono text-xs">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-bg/50 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-accent/20 text-accent">
                  ♛
                </span>
                <div>
                  <strong className="text-text">{t("Goldene Krone:", "Golden Crown:")}</strong>{" "}
                  <span className="text-muted">
                    {t(
                      "Symbolisiert Meister-Expertise in Retro-Gaming und Cabinet-Konfiguration.",
                      "Symbolizes master expertise in retro gaming and cabinet configuration.",
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-bg/50 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary/20 text-primary">
                  ▣
                </span>
                <div>
                  <strong className="text-text">
                    {t("CRT-Monitor & Scanlines:", "CRT Monitor & Scanlines:")}
                  </strong>{" "}
                  <span className="text-muted">
                    {t(
                      "Klassisches 4:3-Gehäuse in Warm-Grau mit sanft leuchtendem Phosphor-Display.",
                      "Classic 4:3 chassis in warm grey with softly glowing green phosphor display.",
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-bg/50 p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-secondary/20 text-secondary">
                  ⌨
                </span>
                <div>
                  <strong className="text-text">
                    {t("Controller & Laptop:", "Controller & Laptop:")}
                  </strong>{" "}
                  <span className="text-muted">
                    {t(
                      "Zwei Welten vereint: Zocken am Flipper/Arcade und präzises Hacking im Terminal.",
                      "Two worlds united: Gaming at the pinball/arcade and precise terminal operations.",
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Model Sheets Previews */}
          <div className="sticker p-6">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-xl text-text">
                {t("Offizielle Model Sheets", "Official Model Sheets")}
              </h4>
              <span className="font-mono text-[10px] text-muted">PNG · High-Res</span>
            </div>
            <p className="mt-2 text-xs text-muted">
              {t(
                "Konzipiert für konsistente visuelle Welten in GitHub-Dokus, Web-UIs und Automaten-Overlays.",
                "Engineered for consistent visual branding across GitHub docs, web UIs and cabinet overlays.",
              )}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <a
                href={charSheetPng}
                target="_blank"
                rel="noreferrer"
                className="group relative block overflow-hidden rounded-xl border border-border bg-bg"
              >
                <img
                  src={charSheetPng}
                  alt="Character Sheet"
                  className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-bg/90 p-1.5 text-center font-mono text-[10px] text-text">
                  Character Sheet ↗
                </div>
              </a>

              <a
                href={logoSheetPng}
                target="_blank"
                rel="noreferrer"
                className="group relative block overflow-hidden rounded-xl border border-border bg-bg"
              >
                <img
                  src={logoSheetPng}
                  alt="Logo Style Sheet"
                  className="h-28 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 bg-bg/90 p-1.5 text-center font-mono text-[10px] text-text">
                  Logo Style Sheet ↗
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </Section>
  );
}
