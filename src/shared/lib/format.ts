/** Small presentation helpers shared by the tables. */

/** `2026-08-14T…` → `14 Aug 2026`. Dashes for a missing timestamp. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * `2026-08-14T06:12:…` → `14 Aug 2026, 2:12 PM`. The console asks for the
 * exact moment an account was registered or last signed in (items W2.2 and
 * W2.3), not just the day.
 */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Seconds → `mm:ss`, the same format the game's results screens use. */
export function formatDuration(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.round(seconds ?? 0));
  const mm = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const ss = (total % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * A section as the dashboard may show it: letters and digits only (item 1.4 of
 * the client evaluation). Registration refuses anything else now, but accounts
 * created before that rule can hold spaces or punctuation, so the value is
 * cleaned on the way to the screen.
 */
export function cleanSection(section: string | null | undefined): string {
  return (section ?? '').replace(/[^A-Za-z0-9]/g, '');
}

/** `Grade 6 · Infinity1`, with either half allowed to be missing. */
export function gradeSection(
  grade: string | null | undefined,
  section: string | null | undefined,
): string {
  const parts = [grade ? `Grade ${grade}` : null, cleanSection(section) || null].filter(Boolean);
  return parts.join(' · ') || '—';
}

/**
 * What the row says on hover when the stored section is not what is shown —
 * the admin is the one who would ask the student to fix it, so the raw value
 * must stay visible somewhere.
 */
export function sectionNote(section: string | null | undefined): string | undefined {
  const raw = (section ?? '').trim();
  if (!raw || raw === cleanSection(raw)) return undefined;
  return `Stored as “${raw}” — only letters and numbers are shown`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Case- and diacritic-insensitive "does this row match what was typed". */
export function matchesSearch(term: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}

export const TROPHY_ICON: Record<string, string> = {
  gold: '🏆',
  silver: '🥈',
  bronze: '🥉',
  none: '—',
};
