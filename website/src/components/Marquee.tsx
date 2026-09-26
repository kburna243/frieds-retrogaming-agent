const items = [
  "Smarter Cabinets",
  "Safer Operations",
  "More Playtime",
  "Dry-Run First",
  "Human-in-the-Loop",
  "Zero Telemetry",
  "Zero Dependencies",
  "MCP & CLI",
  "The Truth is the Machine",
];

export function Marquee() {
  const doubled = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-border bg-surface/60 py-3">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-pixel text-[10px] tracking-widest text-muted uppercase">
        {doubled.map((t, i) => (
          <span key={i} className="flex items-center gap-10">
            <span className={i % 3 === 0 ? "text-primary" : i % 3 === 1 ? "text-secondary" : "text-accent"}>
              ★
            </span>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
