import { getFellowshipHistory, getFellowshipOpportunities } from '@/lib/salesforce';
import { FellowshipData, FellowshipHistoryOpp, FellowshipRelationship } from '@/types';

// ── Cohort configuration ───────────────────────────────────────────────────────
// Cohort and programme year are 1:1 — "Fellowship Programme 2026" === Cohort 12.
// Cohort number = programme year − 2014 (2026→12, 2025→11).
export const CURRENT_COHORT_YEAR = 2026;
const COHORT_OFFSET = 2014;

// Prior cohorts used to classify each partner's "relationship with fellowship".
// The most recent of these (CURRENT_COHORT_YEAR − 1) is "last year".
const RELATIONSHIP_HISTORY_YEARS = [2023, 2024, 2025];

// Cohort years drawn on the year-on-year confirmed comparison line chart.
// Prior years come from confirmed history; the current year from live opps.
const YOY_YEARS = [2024, 2025, CURRENT_COHORT_YEAR];

export function cohortNumber(year: number): number {
  return year - COHORT_OFFSET;
}

// Programme year parsed off "Fellowship Programme 2025" → 2025.
function programmeYear(name: string | undefined): number | null {
  const m = (name ?? '').match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

function monthOf(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + 'T12:00:00');
  return d.getMonth(); // 0–11
}

export async function buildFellowshipData(): Promise<FellowshipData> {
  const [opportunities, history] = await Promise.all([
    getFellowshipOpportunities(CURRENT_COHORT_YEAR),
    getFellowshipHistory(RELATIONSHIP_HISTORY_YEARS),
  ]);

  // ── Relationship classification ──────────────────────────────────────────────
  // For each account, find the prior cohort years it has a confirmed opp in,
  // then bucket by a priority cascade (most-recent wins).
  const lastYear = CURRENT_COHORT_YEAR - 1;
  const confirmedYearsByAccount = new Map<string, Set<number>>();
  for (const h of history) {
    const accId = h.Account?.Id;
    const y = programmeYear(h.Programme__r?.Name);
    if (!accId || y === null) continue;
    if (!confirmedYearsByAccount.has(accId)) confirmedYearsByAccount.set(accId, new Set());
    confirmedYearsByAccount.get(accId)!.add(y);
  }

  const relationshipByAccount: Record<string, FellowshipRelationship> = {};
  for (const opp of opportunities) {
    const accId = opp.Account?.Id;
    if (!accId || relationshipByAccount[accId]) continue;
    const years = confirmedYearsByAccount.get(accId);
    let rel: FellowshipRelationship = 'new';
    if (years?.has(lastYear)) rel = 'sent-last-year';
    else if (years && years.size > 0) rel = 'returning';
    relationshipByAccount[accId] = rel;
  }

  // ── Year-on-year confirmed (cumulative by calendar month) ───────────────────
  // Prior years from confirmed history; current cohort from live confirmed opps.
  const currentConfirmed: FellowshipHistoryOpp[] = opportunities
    .filter(o => o.StageName === 'Confirmed')
    .map(o => ({ Account: o.Account, Programme__r: o.Programme__r, Amount: o.Amount, CloseDate: o.CloseDate, StageName: o.StageName }));
  const allConfirmed = [...history, ...currentConfirmed];

  const yoy = YOY_YEARS.map(year => {
    const monthlyRaw = new Array(12).fill(0) as number[];
    for (const o of allConfirmed) {
      if (programmeYear(o.Programme__r?.Name) !== year) continue;
      const m = monthOf(o.CloseDate);
      if (m === null) continue;
      monthlyRaw[m] += o.Amount ?? 0;
    }
    // Cumulative across the calendar year
    const monthly: number[] = [];
    let running = 0;
    for (let i = 0; i < 12; i++) { running += monthlyRaw[i]; monthly.push(running); }
    return { year, label: `Cohort ${cohortNumber(year)} (${year})`, monthly };
  });

  return {
    cohortYear: CURRENT_COHORT_YEAR,
    cohortNumber: cohortNumber(CURRENT_COHORT_YEAR),
    opportunities,
    relationshipByAccount,
    yoy,
    lastUpdated: new Date().toISOString(),
  };
}
