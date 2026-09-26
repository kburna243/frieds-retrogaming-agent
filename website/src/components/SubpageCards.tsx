import { useLanguage } from "../i18n/LanguageContext";
import { Mascot, type MascotPose } from "./Mascot";
import { Icon, Section, Tag } from "./ui";

interface SubpageCardsProps {
  onSelectView: (view: string) => void;
}

export function SubpageCards({ onSelectView }: SubpageCardsProps) {
  const { t } = useLanguage();

  const cards: {
    id: string;
    titleDe: string;
    titleEn: string;
    descDe: string;
    descEn: string;
    pose: MascotPose;
    tag: string;
    tone: "primary" | "secondary" | "accent";
  }[] = [
    {
      id: "architecture",
      titleDe: "Architektur & Policy-Gate",
      titleEn: "Architecture & Policy Gate",
      descDe: "Die 3 Schichten, 6 Gate-Stufen und das SQLite-Gedächtnis im Detail.",
      descEn: "The 3 layers, 6 gate stages, and SQLite memory digest in detail.",
      pose: "neutral",
      tag: "Deep Dive",
      tone: "secondary",
    },
    {
      id: "cli",
      titleDe: "CLI-Referenz & Dokumentation",
      titleEn: "CLI Reference & Documentation",
      descDe: "Befehle von fagent doctor über status bis zum neuen fagent report (M6).",
      descEn: "Commands from fagent doctor to status and the new fagent report (M6).",
      pose: "laptop",
      tag: "Developer",
      tone: "primary",
    },
    {
      id: "hardware",
      titleDe: "Hardware & Verifikationsbericht",
      titleEn: "Hardware & Verification Report",
      descDe: "Virtual Pinball 3-Screen Geometrie, Wiimote Lightguns & Live-Cabinet-Tests.",
      descEn: "Virtual Pinball 3-screen geometry, Wiimote lightguns & live cabinet test runs.",
      pose: "controller",
      tag: "Live-Tested",
      tone: "accent",
    },
    {
      id: "mascot",
      titleDe: "Maskottchen-Studio & Brand",
      titleEn: "Mascot Studio & Brand Identity",
      descDe: "Entdecke Fried's CRT-Charakter in 9 interaktiven Posen mit Soundboard.",
      descEn: "Discover Fried's CRT mascot in 9 interactive poses with pose soundboard.",
      pose: "celebrate",
      tag: "Visuals",
      tone: "primary",
    },
    {
      id: "roadmap",
      titleDe: "Roadmap & Spezifikationen",
      titleEn: "Roadmap & Tech Specs",
      descDe: "Meilensteine M1–M6, 116 Tests grün, 0 Dependencies und Ausblick auf HAL.",
      descEn: "Milestones M1–M6, 116 tests passing, zero dependencies, and HAL roadmap.",
      pose: "thumbsup",
      tag: "Status",
      tone: "accent",
    },
  ];

  return (
    <Section className="pt-4 pb-16">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <span className="font-mono text-xs uppercase tracking-wider text-muted">
            {t("Erkunde die Themen", "Explore Topics")}
          </span>
          <h3 className="font-display text-2xl sm:text-3xl text-text">
            {t("Fokussierte Unterseiten", "Focused Subpages")}
          </h3>
        </div>
        <Tag tone="primary">{t("5 Bereiche", "5 Sections")}</Tag>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelectView(c.id)}
            className="sticker sticker-hover flex flex-col justify-between p-5 text-left transition group cursor-pointer"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <Mascot pose={c.pose} size="xs" glow={false} />
                <Tag tone={c.tone}>{c.tag}</Tag>
              </div>
              <h4 className="font-display text-lg text-text group-hover:text-primary transition">
                {t(c.titleDe, c.titleEn)}
              </h4>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                {t(c.descDe, c.descEn)}
              </p>
            </div>

            <div className="mt-4 flex items-center gap-1 font-mono text-[11px] text-primary group-hover:translate-x-1 transition-transform">
              <span>{t("Zur Seite", "Open Page")}</span>
              <Icon.Arrow className="h-3 w-3" />
            </div>
          </button>
        ))}
      </div>
    </Section>
  );
}
