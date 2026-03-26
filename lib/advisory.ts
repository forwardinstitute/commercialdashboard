import { getAdvisoryOpportunities, getAdvisoryOpportunitiesLY, getProgrammeFinanceRecords } from '@/lib/salesforce';
import { AdvisoryData, AdvisoryOpportunity, MonthlyData } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// FY 2025/26: March 2025 through February 2026 — last year's equivalent months (0-indexed)
const LY_MONTHS = [
  { year: 2025, month: 2 },  // March 2025
  { year: 2025, month: 3 },  // April 2025
  { year: 2025, month: 4 },  // May 2025
  { year: 2025, month: 5 },  // June 2025
  { year: 2025, month: 6 },  // July 2025
  { year: 2025, month: 7 },  // August 2025
  { year: 2025, month: 8 },  // September 2025
  { year: 2025, month: 9 },  // October 2025
  { year: 2025, month: 10 }, // November 2025
  { year: 2025, month: 11 }, // December 2025
  { year: 2026, month: 0 },  // January 2026
  { year: 2026, month: 1 },  // February 2026
];

// FY 2026/27: March 2026 through February 2027 (month is 0-indexed)
const FY_MONTHS = [
  { year: 2026, month: 2 },  // March
  { year: 2026, month: 3 },  // April
  { year: 2026, month: 4 },  // May
  { year: 2026, month: 5 },  // June
  { year: 2026, month: 6 },  // July
  { year: 2026, month: 7 },  // August
  { year: 2026, month: 8 },  // September
  { year: 2026, month: 9 },  // October
  { year: 2026, month: 10 }, // November
  { year: 2026, month: 11 }, // December
  { year: 2027, month: 0 },  // January
  { year: 2027, month: 1 },  // February
];

// Last day of a given month as a Date
function lastDayOf(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

// ISO date string for the last day of a month (matches Salesforce end-of-month format)
function monthEndIso(year: number, month: number): string {
  return lastDayOf(year, month).toISOString().slice(0, 10);
}

// Is this calendar month on or before today?
function isCurrentOrPast(year: number, month: number, today: Date): boolean {
  return year * 100 + month <= today.getFullYear() * 100 + today.getMonth();
}

// Is this exactly the current calendar month?
function isThisMonth(year: number, month: number, today: Date): boolean {
  return year === today.getFullYear() && month === today.getMonth();
}

// Does this opportunity run during the given calendar month?
function oppCoversMonth(opp: AdvisoryOpportunity, year: number, month: number): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const oppStart   = new Date(opp.Start_Date_All__c);
  const oppEnd     = new Date(opp.End_DateAll__c);
  const monthStart = new Date(year, month, 1);
  const monthEnd   = lastDayOf(year, month);
  return oppStart <= monthEnd && oppEnd >= monthStart;
}

// Prorated monthly slice for an opportunity.
// Falls back to deriving duration from start/end if Number_of_Months__c is missing.
function monthlySlice(opp: AdvisoryOpportunity): number {
  if (!opp.Amount || opp.Amount <= 0) return 0;

  let months = opp.Number_of_Months__c;
  if (!months || months <= 0) {
    // Fallback: calculate from start/end dates
    if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return 0;
    const s = new Date(opp.Start_Date_All__c);
    const e = new Date(opp.End_DateAll__c);
    months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  }

  return opp.Amount / months;
}

function isConfirmedStage(opp: AdvisoryOpportunity): boolean {
  return opp.StageName === 'Confirmed';
}

export async function buildAdvisoryData(): Promise<AdvisoryData> {
  const [opps, oppsLY, financeRecords] = await Promise.all([
    getAdvisoryOpportunities(),
    getAdvisoryOpportunitiesLY(),
    getProgrammeFinanceRecords(),
  ]);

  const today = new Date();

  // Targets come from Programme Finance records — the flow bug doesn't affect targets,
  // only the confirmed income tracking. Build a month-end-date → target map.
  const targetByMonth = new Map<string, number>();
  for (const r of financeRecords) {
    if (!(r.Programme__r?.Name ?? '').includes('Advisory Practice')) continue;
    const key = r.Recruitment_Target_Month__c;
    targetByMonth.set(key, (targetByMonth.get(key) ?? 0) + (r.Target_Amount__c ?? 0));
  }

  // Build last year confirmed: prorate LY opps across their LY months, keyed by FY month index (0–11)
  const confirmedLYByIndex: number[] = LY_MONTHS.map(({ year, month }) => {
    let total = 0;
    for (const opp of oppsLY) {
      if (!oppCoversMonth(opp, year, month)) continue;
      total += monthlySlice(opp);
    }
    return total;
  });

  // Build monthly data by prorating each opportunity across the months it covers
  const months: MonthlyData[] = FY_MONTHS.map(({ year, month }, idx) => {
    const endIso        = monthEndIso(year, month);
    const isPast        = isCurrentOrPast(year, month, today);
    const isCurrentMonth = isThisMonth(year, month, today);

    let confirmed = 0;
    let expected  = 0;
    let potential = 0;

    for (const opp of opps) {
      if (!oppCoversMonth(opp, year, month)) continue;
      const slice = monthlySlice(opp);
      if (isConfirmedStage(opp)) {
        confirmed += slice;
      } else {
        // Probability-weight the open pipeline:
        // expected = slice × probability%; potential = the remaining upside
        const prob = (opp.Probability ?? 0) / 100;
        expected  += slice * prob;
        potential += slice * (1 - prob);
      }
    }

    return {
      month:     MONTH_NAMES[month],
      monthDate: endIso,
      target:    targetByMonth.get(endIso) ?? 0,
      confirmed,
      expected,
      potential,
      costs:  0,
      margin: 0,
      isPast,
      isCurrentMonth,
      confirmedLY: confirmedLYByIndex[idx] ?? 0,
    };
  });

  const ytdMonths    = months.filter(m => m.isPast);
  const ytdConfirmed = ytdMonths.reduce((s, m) => s + m.confirmed, 0);
  const ytdTarget    = ytdMonths.reduce((s, m) => s + m.target,    0);

  return {
    ytdConfirmed,
    ytdTarget,
    ytdCosts:  0,
    ytdMargin: 0,
    variance:  ytdConfirmed - ytdTarget,
    months,
    opportunities: opps,
    lastUpdated: new Date().toISOString(),
  };
}
