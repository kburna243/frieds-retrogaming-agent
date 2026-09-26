import { useEffect, useState } from "react";
import { Architecture } from "./components/Architecture";
import { CLI } from "./components/CLI";
import { Footer } from "./components/Footer";
import { HardwareDetails } from "./components/HardwareDetails";
import { Hero } from "./components/Hero";
import { Marquee } from "./components/Marquee";
import { MascotShowcase } from "./components/MascotShowcase";
import { Memory } from "./components/Memory";
import { Nav } from "./components/Nav";
import { Pillars } from "./components/Pillars";
import { PolicyGateDemo } from "./components/PolicyGateDemo";
import { Problem } from "./components/Problem";
import { Roadmap } from "./components/Roadmap";
import { Specs } from "./components/Specs";
import { SubpageCards } from "./components/SubpageCards";
import { SubpageHeader } from "./components/SubpageHeader";
import { UseCases } from "./components/UseCases";
import { useReveal } from "./hooks/useReveal";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";

export type ViewMode =
  | "overview"
  | "architecture"
  | "cli"
  | "hardware"
  | "mascot"
  | "roadmap"
  | "all";

function AppContent() {
  const { t } = useLanguage();
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
      if (
        [
          "overview",
          "architecture",
          "cli",
          "hardware",
          "mascot",
          "roadmap",
          "all",
        ].includes(hash)
      ) {
        return hash as ViewMode;
      }
    }
    return "overview";
  });

  useReveal(view);

  // Sync hash changes
  useEffect(() => {
    const onHashChange = () => {
      const hash = window.location.hash.replace(/^#\/?/, "").toLowerCase();
      if (
        [
          "overview",
          "architecture",
          "cli",
          "hardware",
          "mascot",
          "roadmap",
          "all",
        ].includes(hash)
      ) {
        setView(hash as ViewMode);
      } else if (hash === "demo") {
        setView("overview");
        setTimeout(() => {
          document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else if (hash === "sicherheit") {
        setView("overview");
        setTimeout(() => {
          document.getElementById("sicherheit")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      } else if (hash === "top" || !hash) {
        setView("overview");
      }
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const handleSelectView = (newView: string) => {
    const target = newView === "top" ? "overview" : newView;
    if (target === "demo") {
      setView("overview");
      window.location.hash = "#demo";
      setTimeout(() => {
        document.getElementById("demo")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
      return;
    }
    setView(target as ViewMode);
    window.location.hash = `#/${target}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleToggleAll = () => {
    const next = view === "all" ? "overview" : "all";
    setView(next);
    window.location.hash = `#/${next}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="relative min-h-screen">
      <Nav currentView={view} onSelectView={handleSelectView} />

      <main>
        {/* VIEW 1: OVERVIEW / HOME */}
        {view === "overview" && (
          <>
            <Hero />
            <Marquee />
            <Pillars />
            <PolicyGateDemo />
            <SubpageCards onSelectView={handleSelectView} />
          </>
        )}

        {/* VIEW 2: ARCHITECTURE & POLICY */}
        {view === "architecture" && (
          <div>
            <SubpageHeader
              title={t("Architektur & Policy Engine", "Architecture & Policy Engine")}
              category={t("Architektur", "Architecture")}
              description={t(
                "Drei getrennte Schichten, 6 Gate-Stufen und persistentes SQLite-Gedächtnis. Das Modell redet nie direkt mit der Hardware.",
                "Three decoupled layers, 6-stage policy gate, and persistent SQLite memory. The model never talks directly to hardware.",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={false}
            />
            <Problem />
            <Architecture />
            <Memory />
          </div>
        )}

        {/* VIEW 3: CLI & REFERENCE */}
        {view === "cli" && (
          <div>
            <SubpageHeader
              title={t("CLI-Dokumentation & Befehle", "CLI Documentation & Reference")}
              category="CLI & Docs"
              description={t(
                "Vollständige Referenz für fagent doctor, status, tools, run, chat, history und den neuen fagent report (M6).",
                "Complete reference for fagent doctor, status, tools, run, chat, history, and the new fagent report (M6).",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={false}
            />
            <CLI />
          </div>
        )}

        {/* VIEW 4: HARDWARE & SCENARIOS */}
        {view === "hardware" && (
          <div>
            <SubpageHeader
              title={t("Hardware-Setups & Verifikation", "Hardware Setups & Verification")}
              category={t("Hardware & Scenarios", "Hardware & Scenarios")}
              description={t(
                "Praxisszenarien für Virtual Pinball 3-Screens, Wiimote-Lightguns mit DemulShooter und reale Cabinet-Testergebnisse.",
                "Real scenarios for Virtual Pinball 3-screen setups, Wiimote lightguns with DemulShooter, and live cabinet test findings.",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={false}
            />
            <UseCases />
            <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-16">
              <HardwareDetails />
            </div>
          </div>
        )}

        {/* VIEW 5: MASCOT & BRAND IDENTITY */}
        {view === "mascot" && (
          <div>
            <SubpageHeader
              title={t("Maskottchen-Studio & Brand Identity", "Mascot Studio & Brand Identity")}
              category={t("Maskottchen", "Mascot")}
              description={t(
                "Entdecke Fried's CRT-Charakter: Design-Philosophie, interaktives Soundboard mit 9 Posen und offizielle Model Sheets.",
                "Discover Fried's CRT character: Design philosophy, interactive soundboard with 9 poses, and official model sheets.",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={false}
            />
            <MascotShowcase />
          </div>
        )}

        {/* VIEW 6: ROADMAP & SPECS */}
        {view === "roadmap" && (
          <div>
            <SubpageHeader
              title={t("Roadmap, Meilensteine & Specs", "Roadmap, Milestones & Specs")}
              category="Roadmap & Specs"
              description={t(
                "Der Entwicklungsstand von M1 bis M6, Hall of Fame der Spezifikationen und Ausblick auf zukünftige Hardware-Profile.",
                "Development status from M1 to M6, Hall of Fame technical specifications, and roadmap to future hardware profiles.",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={false}
            />
            <Roadmap />
            <Specs />
          </div>
        )}

        {/* VIEW 7: ALL SECTIONS (CONTINUOUS SCROLL) */}
        {view === "all" && (
          <div>
            <SubpageHeader
              title={t("Vollständige Gesamtdarstellung", "Complete Full Page View")}
              category={t("Alle Sektionen", "All Sections")}
              description={t(
                "Alle Sektionen, Simulatoren, Use Cases und Spezifikationen in einer nahtlosen Ansicht.",
                "All sections, simulators, use cases, and technical specifications in a single seamless view.",
              )}
              onBack={() => handleSelectView("overview")}
              onShowAll={handleToggleAll}
              isAllView={true}
            />
            <Hero />
            <Marquee />
            <Problem />
            <Architecture />
            <Pillars />
            <PolicyGateDemo />
            <Memory />
            <CLI />
            <UseCases />
            <div className="mx-auto max-w-7xl px-5 sm:px-8 pb-16">
              <HardwareDetails />
            </div>
            <MascotShowcase />
            <Specs />
            <Roadmap />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}
