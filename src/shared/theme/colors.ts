/**
 * The JuanWise palette, copied verbatim from juanwise-app-v2
 * `src/shared/theme/colors.ts` so the console and the game read as one product.
 * The first three are the Philippine flag colours the game is built around.
 *
 * Anything below `--- console only ---` exists because a dense admin table
 * needs greys the game never had a use for; the brand colours above are the
 * ones that must not drift.
 */
export const colors = {
  primaryBlue: '#0038A8',
  primaryRed: '#CE1126',
  gold: '#FCD116',
  white: '#FFFFFF',
  black: '#1A1A1A',
  gray: '#8E8E93',
  lightGray: '#F2F2F7',
  success: '#34C759',
  danger: '#FF3B30',

  /* --- console only --- */
  ink: '#101828',
  muted: '#667085',
  border: '#E4E7EC',
  surface: '#FFFFFF',
  canvas: '#F7F8FB',
  blueDark: '#002A80',
  blueTint: '#EAF0FC',
  goldTint: '#FFF7DB',
  redTint: '#FDECEE',
  greenTint: '#E7F8EC',
};

/** The six game categories, with the colours the app's screens already use. */
export const categoryMeta = [
  { key: 'history', label: 'Philippine History', color: '#2E6FB8' },
  { key: 'culture', label: 'Culture & Tradition', color: '#C9631D' },
  { key: 'geography', label: 'Geography', color: '#3E9E4F' },
  { key: 'festival', label: 'Festival Arts', color: '#B84FA0' },
  { key: 'national', label: 'National Symbols', color: '#C4304A' },
  { key: 'heroes', label: 'Filipino Heroes', color: '#8A5A2B' },
] as const;

export type CategoryKey = (typeof categoryMeta)[number]['key'];

export const categoryLabel = (key: string) =>
  categoryMeta.find((c) => c.key === key)?.label ?? key;

export const categoryColor = (key: string) =>
  categoryMeta.find((c) => c.key === key)?.color ?? colors.primaryBlue;

export default colors;
