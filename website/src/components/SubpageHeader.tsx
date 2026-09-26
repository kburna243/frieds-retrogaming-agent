import { useLanguage } from "../i18n/LanguageContext";
import { Icon } from "./ui";

interface SubpageHeaderProps {
  title: string;
  category: string;
  description: string;
  onBack: () => void;
  onShowAll: () => void;
  isAllView: boolean;
}

export function SubpageHeader({
  title,
  category,
  description,
  onBack,
  onShowAll,
  isAllView,
}: SubpageHeaderProps) {
  const { t } = useLanguage();

  return (
    <div className="pt-24 pb-8 border-b border-border/70 bg-surface/30">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 font-mono text-xs text-muted">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 hover:text-primary transition"
            >
              <Icon.Arrow className="h-3.5 w-3.5 rotate-180" />
              {t("Übersicht", "Overview")}
            </button>
            <span>/</span>
            <span className="text-text font-semibold">{category}</span>
          </div>

          {/* View Mode Toggle: Focused view vs Full single page */}
          <button
            onClick={onShowAll}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 font-mono text-xs text-muted hover:border-primary/50 hover:text-text transition"
          >
            <span className={`h-2 w-2 rounded-full ${isAllView ? "bg-accent" : "bg-primary"}`} />
            {isAllView
              ? t("Fokusansicht aktivieren", "Switch to Focused View")
              : t("Alle Sektionen anzeigen", "Show All Sections")}
          </button>
        </div>

        <div className="mt-4">
          <h1 className="font-display text-4xl sm:text-5xl text-text">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm sm:text-base text-muted">{description}</p>
        </div>
      </div>
    </div>
  );
}
