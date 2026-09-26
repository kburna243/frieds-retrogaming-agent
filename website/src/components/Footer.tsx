import { useLanguage } from "../i18n/LanguageContext";
import { Mascot } from "./Mascot";
import { Icon, LinkButton, PixelCoin } from "./ui";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="relative overflow-hidden border-t border-border">
      {/* CTA */}
      <div className="pixel-grid absolute inset-0 -z-10" />
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="reveal grid items-center gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="font-pixel mb-4 flex items-center gap-3 text-[10px] text-accent">
              <PixelCoin className="h-5 w-5" />
              INSERT COIN TO CONTINUE
              <span className="animate-blink">_</span>
            </div>
            <h2 className="font-display text-5xl leading-[0.95] sm:text-6xl">
              {t("Generative KI und physische Hardware – ", "Generative AI and physical hardware – ")}
              <span className="text-primary glow-green">
                {t("kein Widerspruch.", "no contradiction.")}
              </span>
            </h2>
            <p className="mt-5 max-w-2xl text-lg text-muted">
              {t(
                "Durch die strikte Trennung von Absicht und Ausführung, kompromissloses Human-in-the-Loop-Design und den Verzicht auf externe Laufzeit-Abhängigkeiten ist der Agent das verlässlichste Werkzeug für jeden Arcade-Enthusiasten und Flipper-Bauer.",
                "Through strict separation of intent and execution, uncompromising human-in-the-loop policy, and zero runtime dependencies, the agent is the most reliable companion for arcade enthusiasts and pinball builders.",
              )}
            </p>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row lg:flex-col lg:items-end">
            {/* Friendly farewell mascot */}
            <div className="hidden sm:block">
              <Mascot
                pose="thumbsup"
                size="md"
                speech={t("Game on! Dein Automat ist safe.", "Game on! Your cabinet is safe.")}
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <LinkButton
                href="https://github.com/kburna243/frieds-retrogaming-agent"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 text-base"
              >
                <Icon.Github className="h-5 w-5" /> Retrogaming Agent
              </LinkButton>
              <LinkButton
                variant="outline"
                href="https://github.com/kburna243/frieds-retrogaming-kit"
                target="_blank"
                rel="noreferrer"
                className="px-6 py-4 text-base"
              >
                <Icon.Terminal className="h-5 w-5 text-accent" /> Retrogaming Kit
              </LinkButton>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-surface/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 py-6 sm:flex-row sm:px-8">
          <div className="flex items-center gap-3">
            <span className="relative grid h-8 w-8 place-items-center rounded-lg bg-primary text-bg">
              <Icon.Gamepad className="h-4 w-4" />
              <Icon.Crown className="absolute -top-1.5 -right-1 h-3 w-3 text-accent" />
            </span>
            <div className="text-sm">
              <div className="font-semibold">Fried's Retrogaming Agent</div>
              <div className="text-xs text-muted">
                © {new Date().getFullYear()} Friedrich Börner · MIT License
              </div>
            </div>
          </div>
          <div className="font-mono text-[11px] tracking-widest text-muted uppercase">
            Smarter Cabinets · Safer Operations · More Playtime
          </div>
          <div className="flex items-center gap-4 text-sm text-muted">
            <a
              className="hover:text-text"
              href="https://github.com/kburna243/frieds-retrogaming-agent"
              target="_blank"
              rel="noreferrer"
            >
              Agent
            </a>
            <a
              className="hover:text-text"
              href="https://github.com/kburna243/frieds-retrogaming-kit"
              target="_blank"
              rel="noreferrer"
            >
              Kit
            </a>
            <a className="hover:text-text" href="#top">
              ↑ {t("Nach oben", "Top")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
