/**
 * Report-Logik für „System melden“: Datenmodell, Anonymisierung,
 * Markdown-Erzeugung und die Sendewege. Bewusst UI-frei.
 */

export type ReportKind = "compat" | "bug" | "idea" | "question" | "security";
export type Outcome = "works" | "partial" | "broken" | "untested";
export type Cabinet = "" | "pinball" | "lightgun" | "both" | "other";
export type Transport = "unknown" | "stdio" | "mcp";

export interface ReportDraft {
  kind: ReportKind;
  outcome: Outcome;
  cabinet: Cabinet;
  os: string;
  lightgun: string[];
  pinball: string[];
  frontends: string[];
  fagentVersion: string;
  kitVersion: string;
  nodeVersion: string;
  transport: Transport;
  model: string;
  command: string;
  title: string;
  description: string;
  expected: string;
  diagnostics: string;
  nickname: string;
  contact: string;
  allowContact: boolean;
  /** Honeypot – bleibt leer, Bots füllen es aus. */
  website: string;
}

export const KIND_LABEL: Record<ReportKind, string> = {
  compat: "Kompatibilitätsbericht",
  bug: "Fehler / Problem",
  idea: "Idee / Wunsch",
  question: "Frage",
  security: "Sicherheitsproblem",
};

export const KIND_LABEL_EN: Record<ReportKind, string> = {
  compat: "Compatibility Report",
  bug: "Bug / Issue",
  idea: "Idea / Feature",
  question: "Question",
  security: "Security Issue",
};

export const KIND_SHORT: Record<ReportKind, string> = {
  compat: "Report",
  bug: "Bug",
  idea: "Idee",
  question: "Frage",
  security: "Security",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  works: "funktioniert",
  partial: "funktioniert teilweise",
  broken: "funktioniert nicht",
  untested: "noch nicht getestet",
};

export const OUTCOME_LABEL_EN: Record<Outcome, string> = {
  works: "works",
  partial: "works partially",
  broken: "does not work",
  untested: "not yet tested",
};

export const CABINET_LABEL: Record<Cabinet, string> = {
  "": "–",
  pinball: "Virtual Pinball",
  lightgun: "Lightgun / Arcade",
  both: "Pinball + Lightgun",
  other: "Anderes / Test-Setup",
};

export const CABINET_LABEL_EN: Record<Cabinet, string> = {
  "": "–",
  pinball: "Virtual Pinball",
  lightgun: "Lightgun / Arcade",
  both: "Pinball + Lightgun",
  other: "Other / Test Setup",
};

export const TRANSPORT_LABEL: Record<Transport, string> = {
  unknown: "weiß nicht",
  stdio: "stdio (Invoke-KitApi.ps1)",
  mcp: "MCP (Start-KitMcpServer.ps1)",
};

export const TRANSPORT_LABEL_EN: Record<Transport, string> = {
  unknown: "don't know",
  stdio: "stdio (Invoke-KitApi.ps1)",
  mcp: "MCP (Start-KitMcpServer.ps1)",
};

export function makeEmptyDraft(versions: { fagent: string; kit: string }): ReportDraft {
  return {
    kind: "compat",
    outcome: "broken",
    cabinet: "",
    os: "",
    lightgun: [],
    pinball: [],
    frontends: [],
    fagentVersion: versions.fagent,
    kitVersion: versions.kit,
    nodeVersion: "",
    transport: "unknown",
    model: "",
    command: "",
    title: "",
    description: "",
    expected: "",
    diagnostics: "",
    nickname: "",
    contact: "",
    allowContact: false,
    website: "",
  };
}

/* ---------- Anonymisierung (Spiegel von assertSafeForCloud) ---------- */

export interface AnonymizeResult {
  text: string;
  hits: { label: string; count: number }[];
  total: number;
}

const RULES: { re: RegExp; to: string; label: string }[] = [
  { re: /([A-Za-z]:\\+Users\\+)[^\\/\s"'`]+/gi, to: "$1{user}", label: "Profilpfad" },
  { re: /(\/(?:home|Users)\/)[^/\s"'`]+/g, to: "$1{user}", label: "Profilpfad" },
  { re: /S-1-5-21(?:-\d+){3,4}/g, to: "{sid}", label: "SID" },
  { re: /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g, to: "{mac}", label: "MAC/Bluetooth-Adresse" },
  {
    // private, CGNAT- und Link-Local-Bereiche (wie der Repo-Checker)
    re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3}|169\.254\.\d{1,3}\.\d{1,3})\b/g,
    to: "{ip}",
    label: "Private IP",
  },
  { re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, to: "{email}", label: "E-Mail" },
  { re: /\\\\([A-Za-z0-9\-_.]+)\\/g, to: "\\\\{host}\\", label: "Hostname (UNC)" },
  { re: /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9\-_]{20,})\b/g, to: "{token}", label: "Token / API-Key" },
];

export function anonymize(input: string): AnonymizeResult {
  let text = input ?? "";
  const counts = new Map<string, number>();
  for (const rule of RULES) {
    const n = (text.match(rule.re) ?? []).length;
    if (n > 0) {
      counts.set(rule.label, (counts.get(rule.label) ?? 0) + n);
      text = text.replace(rule.re, rule.to);
    }
  }
  const hits = [...counts.entries()].map(([label, count]) => ({ label, count }));
  return { text, hits, total: hits.reduce((s, h) => s + h.count, 0) };
}

/* ---------- Titel, Labels, Markdown ---------- */

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

function shortCommand(cmd: string): string {
  const step = cmd.match(/step\.[a-z0-9.\-_]+/i);
  if (step) return step[0];
  const m = cmd.trim().match(/^fagent\s+([a-z\-]+)/i);
  return m ? `fagent ${m[1]}` : cmd.trim().slice(0, 40);
}

export function suggestTitle(d: ReportDraft): string {
  const hw = d.lightgun.filter((g) => g !== "Keine")[0] ?? d.pinball.filter((p) => p !== "Keine")[0];
  const parts = [hw ?? CABINET_LABEL[d.cabinet], d.os, d.command ? shortCommand(d.command) : ""].filter(
    (p) => p && p !== "–",
  );
  const tail = d.kind === "compat" ? ` → ${OUTCOME_LABEL[d.outcome]}` : "";
  return `[${KIND_SHORT[d.kind]}] ${parts.join(" · ") || "Rückmeldung"}${tail}`;
}

export function buildLabels(d: ReportDraft): string[] {
  const labels = ["community-report", `type:${d.kind}`];
  if (d.kind === "compat") labels.push(`outcome:${d.outcome}`);
  if (d.os) labels.push(`os:${slug(d.os)}`);
  if (d.cabinet) labels.push(`cabinet:${d.cabinet}`);
  for (const g of d.lightgun) if (g !== "Keine") labels.push(`hw:${slug(g)}`);
  return [...new Set(labels)].slice(0, 8);
}

const list = (a: string[]) => (a.length ? a.join(", ") : "–");
const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

export interface BuiltReport {
  title: string;
  body: string;
  labels: string[];
  anonymized: AnonymizeResult;
}

export function buildReport(d: ReportDraft): BuiltReport {
  const title = anonymize(d.title.trim() || suggestTitle(d)).text.slice(0, 180);
  const desc = anonymize(d.description.trim());
  const expected = anonymize(d.expected.trim());
  const diag = anonymize(d.diagnostics.trim());
  const cmd = anonymize(d.command.trim());

  const counts = new Map<string, number>();
  for (const r of [desc, expected, diag, cmd]) for (const h of r.hits) counts.set(h.label, (counts.get(h.label) ?? 0) + h.count);
  const hits = [...counts.entries()].map(([label, count]) => ({ label, count }));
  const total = hits.reduce((s, h) => s + h.count, 0);

  const system: [string, string][] = [
    ["Kabinett", CABINET_LABEL[d.cabinet]],
    ["Betriebssystem", d.os || "–"],
    ["Lightgun-Hardware", list(d.lightgun)],
    ["Pinball-Software", list(d.pinball)],
    ["Frontends / Emulatoren", list(d.frontends)],
    ["fagent", d.fagentVersion || "–"],
    ["Kit", d.kitVersion || "–"],
    ["Node.js", d.nodeVersion || "–"],
    ["Transport", TRANSPORT_LABEL[d.transport]],
    ["Modell", d.model || "–"],
  ];

  const L: string[] = [];
  L.push(`## ${KIND_LABEL[d.kind]}${d.kind === "compat" ? ` · ${OUTCOME_LABEL[d.outcome]}` : ""}`);
  L.push("");
  L.push(`> Eingereicht über die Projekt-Website von **${cell(d.nickname.trim()) || "anonym"}** – ohne GitHub-Account.`);
  L.push("");
  L.push("### System");
  L.push("| Feld | Wert |");
  L.push("| :-- | :-- |");
  for (const [k, v] of system) L.push(`| ${k} | ${cell(v)} |`);
  L.push("");
  if (cmd.text) {
    L.push("### Befehl / Schritt");
    L.push("```");
    L.push(cmd.text);
    L.push("```");
    L.push("");
  }
  L.push("### Was ist passiert?");
  L.push(desc.text || "_(keine Beschreibung)_");
  L.push("");
  if (expected.text) {
    L.push("### Was hättest du erwartet?");
    L.push(expected.text);
    L.push("");
  }
  if (diag.text) {
    L.push("### Diagnose-Ausgabe (anonymisiert)");
    L.push("<details><summary>Ausgabe anzeigen</summary>");
    L.push("");
    L.push("```text");
    L.push(diag.text.slice(0, 20000).replace(/```/g, "'''"));
    L.push("```");
    L.push("");
    L.push("</details>");
    L.push("");
  }
  L.push("### Kontakt");
  L.push(
    d.allowContact && d.contact.trim()
      ? `Rückfragen erlaubt: ${cell(d.contact.trim())}`
      : "Keine Rückfragen gewünscht bzw. kein Kontakt angegeben.",
  );
  L.push("");

  const machine = {
    schema: "fagent-community-report/1",
    kind: d.kind,
    outcome: d.kind === "compat" ? d.outcome : null,
    cabinet: d.cabinet || null,
    os: d.os || null,
    lightgun: d.lightgun,
    pinball: d.pinball,
    frontends: d.frontends,
    versions: { fagent: d.fagentVersion || null, kit: d.kitVersion || null, node: d.nodeVersion || null },
    transport: d.transport,
    model: d.model || null,
    command: cmd.text || null,
    anonymizedHits: total,
    submittedAt: new Date().toISOString(),
  };
  L.push("<details><summary>Maschinenlesbar</summary>");
  L.push("");
  L.push("```json");
  L.push(JSON.stringify(machine, null, 2));
  L.push("```");
  L.push("");
  L.push("</details>");
  L.push("");
  L.push(`_Clientseitig anonymisiert: ${total} Stelle(n) · Website v${machine.schema.split("/")[1]}_`);

  return { title, body: L.join("\n"), labels: buildLabels(d), anonymized: { text: "", hits, total } };
}

/* ---------- Sendewege ---------- */

export interface SendResult {
  number?: number;
  url?: string;
}

export async function sendToEndpoint(endpoint: string, r: BuiltReport, honeypot: string): Promise<SendResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ title: r.title, body: r.body, labels: r.labels, website: honeypot }),
  });
  let data: { ok?: boolean; number?: number; url?: string; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    /* leerer Body */
  }
  if (!res.ok || data.ok === false) {
    const reason = data.error === "rate_limited" ? "Zu viele Reports in kurzer Zeit – bitte später erneut versuchen." : data.error;
    throw new Error(reason || `Server antwortete mit ${res.status}`);
  }
  return { number: data.number, url: data.url };
}

export async function sendToWeb3Forms(key: string, r: BuiltReport, replyTo: string, honeypot: string): Promise<SendResult> {
  const res = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: key,
      subject: r.title,
      from_name: "fagent Website · System melden",
      ...(replyTo && /\S+@\S+\.\S+/.test(replyTo) ? { email: replyTo } : {}),
      labels: r.labels.join(", "),
      message: r.body,
      botcheck: honeypot,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
  if (!res.ok || !data.success) throw new Error(data.message || `Senden fehlgeschlagen (${res.status})`);
  return {};
}

const MAX_URL_BODY = 6000;

export function githubIssueUrl(repo: string, r: BuiltReport): { url: string; truncated: boolean } {
  let body = r.body;
  let truncated = false;
  if (encodeURIComponent(body).length > MAX_URL_BODY) {
    truncated = true;
    body =
      body.slice(0, 1800) +
      "\n\n---\n_⚠️ Gekürzt: Der vollständige Report liegt in deiner Zwischenablage – bitte hier mit Strg+V einfügen._";
  }
  const params = new URLSearchParams({ title: r.title, body, labels: r.labels.join(",") });
  return { url: `https://github.com/${repo}/issues/new?${params.toString()}`, truncated };
}

export function mailtoUrl(email: string, r: BuiltReport): { url: string; truncated: boolean } {
  let body = r.body;
  let truncated = false;
  if (body.length > 1500) {
    truncated = true;
    body =
      body.slice(0, 1200) +
      "\n\n---\nGekürzt: Der vollständige Report liegt in deiner Zwischenablage – bitte hier mit Strg+V einfügen.";
  }
  return {
    url: `mailto:${email}?subject=${encodeURIComponent(r.title)}&body=${encodeURIComponent(body)}`,
    truncated,
  };
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/* ---------- Entwurf lokal sichern ---------- */

const DRAFT_KEY = "fagent-report-draft:v1";

export function loadDraft(base: ReportDraft): ReportDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ReportDraft>;
    return { ...base, ...parsed, website: "" };
  } catch {
    return null;
  }
}

export function saveDraft(d: ReportDraft) {
  try {
    const { website: _omit, ...rest } = d;
    void _omit;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(rest));
  } catch {
    /* Speicher voll / privat */
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
