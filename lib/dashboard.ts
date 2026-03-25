import { getProgrammeFinanceRecords } from '@/lib/salesforce';
import { DashboardData, MonthlyData, ProgrammeFinanceRecord, ProgrammeGroup } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ADVISORY_TYPE = 'Advisory Practice';

// Compare by year+month only — records use end-of-month dates (e.g. 2026-03-31)
// so a strict date comparison would exclude the current month until it ends.
function isOnOrBeforeCurrentMonth(dateStr: string, today: Date): boolean {
  const d = new Date(dateStr);
  const recordYM = d.getFullYear() * 100 + d.getMonth();
  const todayYM = today.getFullYear() * 100 + today.getMonth();
  return recordYM <= todayYM;
}

// Aggregate multiple programme records into a single monthly series.
// Records from different programmes (e.g. Advisory Practice 2024, 2025, 2026)
// all fall on the same month date and are summed together.
function aggregateByMonth(
  records: ProgrammeFinanceRecord[],
  today: Date
): MonthlyData[] {
  const byMonth = new Map<string, MonthlyData>();

  for (const r of records) {
    const key = r.Recruitment_Target_Month__c;
    const d = new Date(key);

    if (!byMonth.has(key)) {
      byMonth.set(key, {
        month: MONTH_NAMES[d.getMonth()],
        monthDate: key,
        target: 0,
        confirmed: 0,
        expected: 0,
        potential: 0,
        costs: 0,
        margin: 0,
        isPast: isOnOrBeforeCurrentMonth(key, today),
      });
    }

    const entry = byMonth.get(key)!;
    entry.target    += r.Target_Amount__c    || 0;
    entry.confirmed += r.Monthly_Confirmed__c || 0;
    entry.expected  += r.Monthly_Expected__c  || 0;
    entry.potential += r.Monthly_Potential__c || 0;
    entry.costs     += r.Monthly_Costs__c    || 0;
    entry.margin     = entry.confirmed - entry.costs;
  }

  return Array.from(byMonth.values()).sort((a, b) =>
    a.monthDate.localeCompare(b.monthDate)
  );
}

// Build breakdown cards grouped by programme type (Record Type via Type__c).
// e.g. "Fellowship Programme", "Exchange Programme", "Leading Through Disruption"
// Only shows types that have a target set OR some confirmed activity.
function buildBreakdown(
  records: ProgrammeFinanceRecord[],
  today: Date
): ProgrammeGroup[] {
  const byType = new Map<string, {
    recs: ProgrammeFinanceRecord[];
    totalTarget: number;
    totalConfirmed: number;
    totalExpected: number;
    totalPotential: number;
  }>();

  for (const r of records) {
    const type = r.Type__c || 'Unknown';
    if (!byType.has(type)) {
      byType.set(type, { recs: [], totalTarget: 0, totalConfirmed: 0, totalExpected: 0, totalPotential: 0 });
    }
    const entry = byType.get(type)!;
    entry.recs.push(r);
    entry.totalTarget    += r.Target_Amount__c    || 0;
    entry.totalConfirmed += r.Monthly_Confirmed__c || 0;
    entry.totalExpected  += r.Monthly_Expected__c  || 0;
    entry.totalPotential += r.Monthly_Potential__c || 0;
  }

  return Array.from(byType.entries())
    .filter(([, v]) => v.totalTarget > 0 || v.totalConfirmed > 0)
    .map(([type, v]) => ({
      name: type,
      type: 'programmes' as const,
      totalTarget: v.totalTarget,
      totalConfirmed: v.totalConfirmed,
      totalExpected: v.totalExpected,
      totalPotential: v.totalPotential,
      months: aggregateByMonth(v.recs, today),
    }))
    .sort((a, b) => b.totalTarget - a.totalTarget || b.totalConfirmed - a.totalConfirmed);
}

function sum(records: ProgrammeFinanceRecord[], field: keyof ProgrammeFinanceRecord): number {
  return records.reduce((acc, r) => acc + ((r[field] as number) || 0), 0);
}

export async function buildDashboardData(): Promise<DashboardData> {
  const records = await getProgrammeFinanceRecords();
  const today = new Date();

  const advisoryRecords  = records.filter(r => r.Type__c === ADVISORY_TYPE);
  const programmeRecords = records.filter(r => r.Type__c !== ADVISORY_TYPE);

  const advisoryYtd  = advisoryRecords.filter(r =>
    isOnOrBeforeCurrentMonth(r.Recruitment_Target_Month__c, today)
  );
  const programmeYtd = programmeRecords.filter(r =>
    isOnOrBeforeCurrentMonth(r.Recruitment_Target_Month__c, today)
  );

  return {
    advisory: {
      ytdTarget:    sum(advisoryYtd, 'Target_Amount__c'),
      ytdConfirmed: sum(advisoryYtd, 'Monthly_Confirmed__c'),
      variance:     sum(advisoryYtd, 'Monthly_Confirmed__c') - sum(advisoryYtd, 'Target_Amount__c'),
      months:       aggregateByMonth(advisoryRecords, today),
    },
    programmes: {
      ytdTarget:    sum(programmeYtd, 'Target_Amount__c'),
      ytdConfirmed: sum(programmeYtd, 'Monthly_Confirmed__c'),
      variance:     sum(programmeYtd, 'Monthly_Confirmed__c') - sum(programmeYtd, 'Target_Amount__c'),
      months:       aggregateByMonth(programmeRecords, today),
      breakdown:    buildBreakdown(programmeRecords, today),
    },
    lastUpdated: new Date().toISOString(),
  };
}
