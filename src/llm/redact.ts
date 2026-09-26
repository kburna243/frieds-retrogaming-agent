/**
 * The outbound trap-net.
 *
 * The kit does the real anonymization (`-Anonymize`, same rules as its support bundle): it replaces profile paths,
 * user and computer names, SIDs, private IPs and e-mail addresses with `<USERPROFILE>`, `<USER>`, `<COMPUTER>`,
 * `<SID>`, `<IP>`, `<EMAIL>`.
 *
 * This module is the second line: before anything is serialized into a request that leaves the PC, it looks for
 * the shapes that must not be there. It is deliberately a trap-net and not a replacement — the flag decides, this
 * only fails closed when the flag was forgotten.
 */

export interface PersonalDataFinding {
  rule: string;
  /** What matched, already cut short: the finding must not smuggle the value into a log line. */
  sample: string;
}

interface Rule {
  id: string;
  pattern: RegExp;
}

/** Account names that are not a person: CI images and Windows defaults. Everything else under a Users root counts. */
const SERVICE_ACCOUNTS = 'public|defaultuser0|containeradministrator|runner(?:admin|-\\w+)?|vsts|ci';

const RULES: Rule[] = [
  { id: 'windows-profile-path', pattern: new RegExp(`[A-Za-z]:[\\\\/]+[Uu]sers[\\\\/]+(?!${SERVICE_ACCOUNTS}[\\\\/"])[A-Za-z0-9._-]+`, 'g') },
  { id: 'unix-home-path', pattern: new RegExp(`/(?:home|Users)/(?!${SERVICE_ACCOUNTS}\\b)[A-Za-z0-9._-]{2,}`, 'g') },
  { id: 'windows-user-folder', pattern: new RegExp(`[A-Za-z]:[\\\\/]+Users[\\\\/]+[A-Za-z0-9._-]+[\\\\/]+(Desktop|Documents|Downloads|AppData)`, 'g') },
  { id: 'sid', pattern: /S-1-[0-9]-[0-9-]{6,}/g },
  { id: 'private-ipv4', pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.\d{1,3}\.\d{1,3})\b/g },
  { id: 'email', pattern: /(?<!<EMAIL>)[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { id: 'api-key-like', pattern: /\b(?:sk|ghp|gho|xox[baprs|k]-)[A-Za-z0-9_-]{16,}\b/g },
];

/** Every rule that matches, with a short sample. Empty means: no known personal shape found. */
export function findPersonalData(text: string): PersonalDataFinding[] {
  const findings: PersonalDataFinding[] = [];
  for (const rule of RULES) {
    const re = new RegExp(rule.pattern.source, rule.pattern.flags.replace('g', ''));
    const match = re.exec(text);
    if (match) findings.push({ rule: rule.id, sample: match[0].slice(0, 24) });
  }
  return findings;
}

/** Throws with the rule names when something that looks personal would leave the PC. */
export function assertSafeForCloud(text: string, context: string): void {
  const findings = findPersonalData(text);
  if (findings.length === 0) return;
  throw new Error(
    `refusing to send a request to a cloud model (${context}): it contains ${findings.map((f) => f.rule).join(', ')} — ` +
      'the kit call that produced it must run with -Anonymize (see docs/POLICY.md)',
  );
}
