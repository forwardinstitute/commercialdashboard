import { getProgrammeOpportunities, getProgrammeOpportunitiesLY, getProgrammeFinanceRecords } from '@/lib/salesforce';
import { MonthlyData, ProgrammeOpportunity, ProgrammesData, ProgrammeType } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Programmes often have longer recruitment periods that close in Jan/Feb
// before the FY officially starts in March. We include those two months
// so that income isn't invisible — targets will simply be zero for them.
const FY_MONTHS = [
  { year: 2026, month: 0, preFY: true  },  // January (pre-FY)
  { year: 2026, month: 1, preFY: true  },  // February (pre-FY)
  { year: 2026, month: 2, preFY: false },  // March
  { year: 2026, month: 3, preFY: false },  // April
  { year: 2026, month: 4, preFY: false },  // May
  { year: 2026, month: 5, preFY: false },  // June
  { year: 2026, month: 6, preFY: false },  // July
  { year: 2026, month: 7, preFY: false },  // August
  { year: 2026, month: 8, preFY: false },  // September
  { year: 2026, month: 9, preFY: false },  // October
  { year: 2026, month: 10, preFY: false }, // November
  { year: 2026, month: 11, preFY: false }, // December
  { year: 2027, month: 0, preFY: false },  // January
  { year: 2027, month: 1, preFY: false },  // February
];

function lastDayOf(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

function monthEndIso(year: number, month: number): string {
  return lastDayOf(year, month).toISOString().slice(0, 10);
}

function isCurrentOrPast(year: number, month: number, today: Date): boolean {
  return year * 100 + month <= today.getFullYear() * 100 + today.getMonth();
}

function isThisMonth(year: number, month: number, today: Date): boolean {
  return year === today.getFullYear() && month === today.getMonth();
}

// Derive programme type from programme name.
// Fellowship must match 'Fellowship Programme 2026' specifically (not loose substring).
export function getProgrammeType(name: string): Exclude<ProgrammeType, 'all'> {
  const n = name.toLowerCase();
  if (n.includes('fellowship programme')) return 'fellowship';
  if (n.includes('exchange')) return 'exchange';
  if (n.includes('leading through disruption') || n.includes('disruption')) return 'ltd';
  return 'other';
}

// Check if an opp's CloseDate falls in a given calendar month
function closesInMonth(opp: ProgrammeOpportunity, year: number, month: number): boolean {
  if (!opp.CloseDate) return false;
  // Parse as noon to avoid timezone edge cases
  const d = new Date(opp.CloseDate + 'T12:00:00');
  return d.getFullYear() === year && d.getMonth() === month;
}

export async function buildProgrammesData(): Promise<ProgrammesData> {
  const [rawOpps, rawOppsLY, financeRecords] = await Promise.all([
    getProgrammeOpportunities(),
    getProgrammeOpportunitiesLY(),
    getProgrammeFinanceRecords(),
  ]);

  // Exclude Advisory Practice opps — NOT LIKE is invalid SOQL so we filter here
  // Also exclude old fellowship cohorts (e.g. Fellowship Programme 2025) from the current
  // year view — the pre-FY Jan/Feb window is for early-closing *current* programme opps,
  // not last year's late stragglers. LY opps keep all fellowships for the LY comparison line.
  const isOldFellowship = (o: ProgrammeOpportunity) => {
    const name = (o.Programme__r?.Name ?? '').toLowerCase();
    return name.includes('fellowship') && !name.includes('fellowship programme 2026');
  };

  const opps = rawOpps.filter(o =>
    !(o.Programme__r?.Name ?? '').includes('Advisory Practice') && !isOldFellowship(o)
  );
  const oppsLY = rawOppsLY.filter(o =>
    !(o.Programme__r?.Name ?? '').includes('Advisory Practice')
  );

  const today = new Date();

  // ── Targets ──────────────────────────────────────────────────────────────────
  // Finance records for non-Advisory programmes. Targets are stored per
  // Programme Finance record, so we can split them by programme type.
  const progFinance = financeRecords.filter(
    r => !(r.Programme__r?.Name ?? '').includes('Advisory Practice')
  );

  const allTargets:  Record<string, number> = {};
  const fellowshipTargets: Record<string, number> = {};
  const exchangeTargets:   Record<string, number> = {};
  const ltdTargets:        Record<string, number> = {};
  const otherTargets:      Record<string, number> = {};

  for (const r of progFinance) {
    const key = r.Recruitment_Target_Month__c;
    const amount = r.Target_Amount__c ?? 0;
    allTargets[key] = (allTargets[key] ?? 0) + amount;

    const type = getProgrammeType(r.Programme__r?.Name ?? '');
    if (type === 'fellowship') fellowshipTargets[key] = (fellowshipTargets[key] ?? 0) + amount;
    else if (type === 'exchange') exchangeTargets[key] = (exchangeTargets[key] ?? 0) + amount;
    else if (type === 'ltd')      ltdTargets[key]      = (ltdTargets[key]      ?? 0) + amount;
    else                          otherTargets[key]    = (otherTargets[key]    ?? 0) + amount;
  }

  // ── Monthly data (all types combined) ────────────────────────────────────────
  const months: MonthlyData[] = FY_MONTHS.map(({ year, month, preFY }, _idx) => {
    const endIso        = monthEndIso(year, month);
    const isPast        = isCurrentOrPast(year, month, today);
    const isCurrentMonth = isThisMonth(year, month, today);

    let confirmed = 0;
    let expected  = 0;
    let potential = 0;

    for (const opp of opps) {
      if (!closesInMonth(opp, year, month)) continue;
      const amount = opp.Amount ?? 0;
      if (opp.StageName === 'Confirmed') {
        confirmed += amount;
      } else {
        const prob = (opp.Probability ?? 0) / 100;
        expected  += amount * prob;
        potential += amount * (1 - prob);
      }
    }

    // Last year confirmed: same calendar month, one year prior
    const lyYear = year - 1;
    let confirmedLY = 0;
    for (const opp of oppsLY) {
      if (!closesInMonth(opp, lyYear, month)) continue;
      confirmedLY += opp.Amount ?? 0;
    }

    return {
      month:     MONTH_NAMES[month],
      monthDate: endIso,
      target:    preFY ? 0 : (allTargets[endIso] ?? 0),
      confirmed,
      expected,
      potential,
      costs:  0,
      margin: 0,
      isPast,
      isCurrentMonth,
      confirmedLY,
      preFY,
    };
  });

  // Pre-FY months (Jan/Feb) are visible on the chart but excluded from YTD totals
  const ytdMonths    = months.filter(m => m.isPast && !m.preFY);
  const ytdConfirmed = ytdMonths.reduce((s, m) => s + m.confirmed, 0);
  const ytdTarget    = ytdMonths.reduce((s, m) => s + m.target,    0);

  return {
    ytdConfirmed,
    ytdTarget,
    variance: ytdConfirmed - ytdTarget,
    months,
    opportunities:   opps,
    opportunitiesLY: oppsLY,
    targetsByType: {
      all:        allTargets,
      fellowship: fellowshipTargets,
      exchange:   exchangeTargets,
      ltd:        ltdTargets,
      other:      otherTargets,
    },
    lastUpdated: new Date().toISOString(),
  };
}
