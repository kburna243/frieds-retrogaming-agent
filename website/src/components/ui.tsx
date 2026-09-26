import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from "react";
import { cn } from "../utils/cn";

/* ---------- Section wrapper ---------- */
export function Section({
  id,
  children,
  className,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn("relative scroll-mt-24 py-20 sm:py-28", className)}>
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

/* ---------- Section heading with pixel label ---------- */
export function Heading({
  eyebrow,
  title,
  sub,
  align = "left",
  accent = "primary",
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  align?: "left" | "center";
  accent?: "primary" | "secondary" | "accent";
}) {
  const accentClass = {
    primary: "text-primary",
    secondary: "text-secondary",
    accent: "text-accent",
  }[accent];
  return (
    <div className={cn("reveal mb-12 max-w-3xl", align === "center" && "mx-auto text-center")}>
      <div className={cn("font-pixel mb-4 text-[10px] tracking-widest uppercase", accentClass)}>
        <span className="mr-2 opacity-60">▶</span>
        {eyebrow}
      </div>
      <h2 className="font-display text-4xl leading-[0.95] sm:text-5xl lg:text-6xl">{title}</h2>
      {sub && <p className="mt-5 text-base leading-relaxed text-muted sm:text-lg">{sub}</p>}
    </div>
  );
}

/* ---------- Badges / tags ---------- */
type Tone = "primary" | "secondary" | "accent" | "success" | "warning" | "error" | "neutral";

const toneMap: Record<Tone, string> = {
  primary: "bg-primary/15 text-primary border-primary/30",
  secondary: "bg-secondary/15 text-secondary border-secondary/30",
  accent: "bg-accent/15 text-accent border-accent/30",
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  error: "bg-error/15 text-error border-error/30",
  neutral: "bg-border/60 text-muted border-border",
};

export function Tag({
  children,
  tone = "neutral",
  className,
  dot,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium tracking-wide uppercase",
        toneMap[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Buttons ---------- */
const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-50 active:translate-y-px";

const btnVariants = {
  primary:
    "bg-primary text-bg shadow-[0_0_0_1px_rgb(0_230_118/0.4),0_8px_24px_-8px_rgb(0_230_118/0.6)] hover:bg-[#33ee92] hover:shadow-[0_0_0_1px_rgb(0_230_118/0.6),0_12px_32px_-8px_rgb(0_230_118/0.8)]",
  secondary:
    "bg-secondary text-bg shadow-[0_8px_24px_-8px_rgb(0_184_255/0.6)] hover:bg-[#33c9ff]",
  outline:
    "border border-border bg-surface/60 text-text hover:border-primary/60 hover:text-primary",
  ghost: "text-muted hover:text-text",
  danger: "border border-error/40 bg-error/10 text-error hover:bg-error/20",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btnVariants;
};

export function Button({ variant = "primary", className, ...rest }: ButtonProps) {
  return <button className={cn(btnBase, btnVariants[variant], className)} {...rest} />;
}

type LinkButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: keyof typeof btnVariants;
};

export function LinkButton({ variant = "primary", className, ...rest }: LinkButtonProps) {
  return <a className={cn(btnBase, btnVariants[variant], className)} {...rest} />;
}

/* ---------- Simple icons (inline SVG, no deps) ---------- */
const iconProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  viewBox: "0 0 24 24",
};

export const Icon = {
  Github: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  ),
  Brain: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M9.5 3a3 3 0 0 0-3 3v.5A3.5 3.5 0 0 0 4 10a3.5 3.5 0 0 0 1 6.9V17a3.5 3.5 0 0 0 7 0V6a3 3 0 0 0-2.5-3Z" />
      <path d="M14.5 3a3 3 0 0 1 3 3v.5A3.5 3.5 0 0 1 20 10a3.5 3.5 0 0 1-1 6.9V17a3.5 3.5 0 0 1-7 0V6a3 3 0 0 1 2.5-3Z" />
      <path d="M12 8h.01M9 12h3M15 12h-3" />
    </svg>
  ),
  Shield: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M12 2.5 4.5 5.5v6c0 5 3.3 8.6 7.5 10 4.2-1.4 7.5-5 7.5-10v-6L12 2.5Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  ),
  Terminal: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="m7 9 3 3-3 3M12 15h5" />
    </svg>
  ),
  Cloud: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M7 18a4 4 0 0 1-.5-7.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9H7Z" />
    </svg>
  ),
  Gamepad: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M6 9h12a4 4 0 0 1 3.9 4.9l-.9 4.2a2 2 0 0 1-3.6.7L15.5 16h-7l-1.9 2.8a2 2 0 0 1-3.6-.7l-.9-4.2A4 4 0 0 1 6 9Z" />
      <path d="M8 12v3M6.5 13.5h3M15 12.5h.01M17.5 14h.01" />
    </svg>
  ),
  Database: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  ),
  Zap: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
    </svg>
  ),
  Check: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="m5 12 5 5L20 7" />
    </svg>
  ),
  X: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  ),
  Eye: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  User: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  ),
  Lock: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  Plug: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5" />
    </svg>
  ),
  Search: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Arrow: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  ),
  Crown: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />
    </svg>
  ),
  Monitor: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  ),
  Crosshair: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  ),
  Box: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <path d="m12 2 9 5v10l-9 5-9-5V7l9-5Z" />
      <path d="M3 7l9 5 9-5M12 12v10" />
    </svg>
  ),
  Play: ({ className }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Skull: ({ className }: { className?: string }) => (
    <svg className={className} {...iconProps}>
      <circle cx="12" cy="11" r="7" />
      <path d="M8 18v2h8v-2M9 13v1M15 13v1M10 17h4" />
    </svg>
  ),
};

/* ---------- Pixel heart / coin decorative ---------- */
export function PixelCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges">
      <rect x="5" y="1" width="6" height="1" fill="#ffd600" />
      <rect x="3" y="2" width="10" height="1" fill="#ffd600" />
      <rect x="2" y="3" width="12" height="10" fill="#ffd600" />
      <rect x="3" y="13" width="10" height="1" fill="#ffd600" />
      <rect x="5" y="14" width="6" height="1" fill="#ffd600" />
      <rect x="4" y="4" width="2" height="7" fill="#fff5b0" />
      <rect x="7" y="4" width="2" height="8" fill="#b8960a" />
      <rect x="6" y="5" width="1" height="1" fill="#b8960a" />
      <rect x="6" y="10" width="1" height="1" fill="#b8960a" />
      <rect x="9" y="5" width="1" height="1" fill="#b8960a" />
      <rect x="9" y="10" width="1" height="1" fill="#b8960a" />
    </svg>
  );
}
