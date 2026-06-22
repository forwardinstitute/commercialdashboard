// Shared, dependency-free helpers for place products. Safe to import into client
// components (no server-only imports).

export const PLACE_BUCKETS = ['Private', 'Public', 'Social', 'Free'] as const;
export type PlaceBucket = (typeof PLACE_BUCKETS)[number];

// Product code scheme across programmes: FI{PROG}{SECTOR}, suffix PRIV/PUB/SOC/FREE.
//   Fellowship → FIFP* · Exchange → FIEXPR* · LtD → FILTD*
// LTD has a Salesforce data bug: its bursary product carries FILTDSOC (identical
// to LTD Social), so code-suffix matching alone would miscount bursary as Social.
// We therefore check the product NAME for bursary/free first to disambiguate.
export function productBucket(code?: string | null, name?: string | null): PlaceBucket | null {
  const n = (name ?? '').toLowerCase();
  if (n.includes('bursary') || n.includes('free')) return 'Free';
  const c = (code ?? '').toUpperCase();
  if (c.endsWith('FREE')) return 'Free';
  if (c.endsWith('PRIV')) return 'Private';
  if (c.endsWith('PUB')) return 'Public';
  if (c.endsWith('SOC')) return 'Social';
  return null;
}

// Funnel order, lowest → highest confidence. Tolerates either Expecting/Expected
// spelling; unknown stages sort last.
const STAGE_RANK: Record<string, number> = {
  Hopeful: 0, Possible: 1, Expecting: 2, Expected: 2, Confirmed: 3,
};
export function stageRank(stage: string): number {
  return STAGE_RANK[stage] ?? 99;
}

export const SECTOR_COLOURS: Record<string, string> = {
  Private: '#195e47',
  Public: '#85d1e3',
  Social: '#ffcc12',
  Free: '#dd6945',
};
