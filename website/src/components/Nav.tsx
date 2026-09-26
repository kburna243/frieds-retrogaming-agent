import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { cn } from "../utils/cn";
import { Mascot } from "./Mascot";
import { Icon, LinkButton } from "./ui";

export interface NavProps {
  currentView?: string;
  onSelectView?: (view: string) => void;
}

export function Nav({ currentView = "overview", onSelectView }: NavProps) {
  const { lang, setLang, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "overview", href: "#top", label: t("Übersicht", "Overview") },
    { id: "architecture", href: "#architektur", label: t("Architektur", "Architecture") },
    { id: "demo", href: "#demo", label: t("Policy Gate", "Policy Gate") },
    { id: "cli", href: "#cli", label: "CLI & Docs" },
    { id: "hardware", href: "#hardware", label: t("Hardware", "Hardware") },
    { id: "mascot", href: "#mascot", label: t("Maskottchen", "Mascot") },
    { id: "roadmap", href: "#roadmap", label: "Roadmap" },
  ];

  const handleNavClick = (id: string, href?: string) => {
    setOpen(false);
    if (onSelectView) {
      onSelectView(id);
    } else if (href) {
      window.location.hash = href;
    }
  };

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border/80 bg-bg/85 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a
          href="#top"
          onClick={() => handleNavClick("overview", "#top")}
          className="group flex items-center gap-3"
        >
          {/* Brand icon with mascot avatar */}
          <span className="relative grid h-10 w-10 place-items-center rounded-xl border border-primary/40 bg-surface shadow-[0_0_20px_-4px_rgb(0_230_118/0.6)]">
            <Mascot pose="friendly" size="xs" glow={false} />
            <Icon.Crown className="absolute -top-1.5 -right-1.5 h-4 w-4 rotate-12 text-accent" />
          </span>
          <span className="leading-none">
            <span className="font-display block text-xl tracking-wide">
              Fried's <span className="text-primary">Retrogaming</span> Agent
            </span>
            <span className="font-mono text-[10px] text-muted">fagent · v0.1.0</span>
          </span>
        </a>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-1 xl:flex">
          {links.map((l) => {
            const active = currentView === l.id;
            return (
              <a
                key={l.id}
                href={l.href}
                onClick={() => handleNavClick(l.id, l.href)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted hover:bg-surface hover:text-text",
                )}
              >
                {l.label}
              </a>
            );
          })}
        </nav>

        {/* Controls: Language Switcher + GitHub & Kit links */}
        <div className="hidden items-center gap-3 sm:flex">
          {/* Retro Language Switcher Toggle */}
          <div className="flex items-center rounded-lg border border-border bg-surface/80 p-0.5 font-mono text-xs">
            <button
              type="button"
              onClick={() => setLang("de")}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-semibold transition",
                lang === "de"
                  ? "bg-primary text-bg shadow-[0_0_10px_rgb(0_230_118/0.5)]"
                  : "text-muted hover:text-text",
              )}
            >
              DE
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn(
                "rounded px-2.5 py-1 text-[11px] font-semibold transition",
                lang === "en"
                  ? "bg-primary text-bg shadow-[0_0_10px_rgb(0_230_118/0.5)]"
                  : "text-muted hover:text-text",
              )}
            >
              EN
            </button>
          </div>

          <LinkButton
            variant="outline"
            href="https://github.com/kburna243/frieds-retrogaming-kit"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs"
          >
            Kit
          </LinkButton>
          <LinkButton
            href="https://github.com/kburna243/frieds-retrogaming-agent"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-1.5 text-xs"
          >
            <Icon.Github className="h-4 w-4" />
            GitHub
          </LinkButton>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-2 sm:hidden">
          {/* Mobile language toggle */}
          <div className="flex rounded-md border border-border bg-surface p-0.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setLang("de")}
              className={cn("px-1.5 py-0.5 rounded", lang === "de" ? "bg-primary text-bg" : "text-muted")}
            >
              DE
            </button>
            <button
              type="button"
              onClick={() => setLang("en")}
              className={cn("px-1.5 py-0.5 rounded", lang === "en" ? "bg-primary text-bg" : "text-muted")}
            >
              EN
            </button>
          </div>

          <button
            aria-label="Menü"
            onClick={() => setOpen((o) => !o)}
            className="grid h-9 w-9 place-items-center rounded-md border border-border text-text"
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={cn(
                  "absolute left-0 top-0 h-0.5 w-5 bg-current transition",
                  open && "top-1.5 rotate-45",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-1.5 h-0.5 w-5 bg-current transition",
                  open && "opacity-0",
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-3 h-0.5 w-5 bg-current transition",
                  open && "top-1.5 -rotate-45",
                )}
              />
            </span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-border bg-bg/95 px-5 py-4 backdrop-blur lg:hidden">
          <div className="grid gap-1">
            {links.map((l) => (
              <a
                key={l.id}
                href={l.href}
                onClick={() => handleNavClick(l.id, l.href)}
                className="rounded-md px-3 py-2 text-sm text-muted hover:bg-surface hover:text-text"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex gap-2 border-t border-border pt-3">
              <LinkButton
                variant="outline"
                href="https://github.com/kburna243/frieds-retrogaming-kit"
                target="_blank"
                rel="noreferrer"
                className="flex-1 justify-center py-2 text-xs"
              >
                Kit
              </LinkButton>
              <LinkButton
                href="https://github.com/kburna243/frieds-retrogaming-agent"
                target="_blank"
                rel="noreferrer"
                className="flex-1 justify-center py-2 text-xs"
              >
                <Icon.Github className="h-4 w-4" />
                GitHub
              </LinkButton>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
