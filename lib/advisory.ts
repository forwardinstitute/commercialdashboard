import { getProgrammeFinanceRecords } from '@/lib/salesforce';
import { AdvisoryData, MonthlyData, ProgrammeFinanceRecord } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ADVISORY_TYPE = 'Advisory Practice';

function isOnOrBeforeCurrentMonth(dateStr: string, today: Date): boolean {
  const d = new Date(dateStr);
  const recordYM = d.getFullYear() * 100 + d.getMonth();
  const todayYM  = today.getFullYear() * 100 + today.getMonth();
  return recordYM <= todayYM;
}

function aggregateAdvisoryByMonth(
  records: ProgrammeFinanceRecord[],
  today: Date
): MonthlyData[] {
  const byMonth = new Map<string, MonthlyData>();

  for (const r of records) {
    const key = r.Recruitment_Target_Month__c;
    const d   = new Date(key);

    if (!byMonth.has(key)) {
      byMonth.set(key, {
        month:     MONTH_NAMES[d.getMonth()],
        monthDate: key,
        target:    0,
        confirmed: 0,
        expected:  0,
        potential: 0,
        costs:     0,
        margin:    0,
        isPast:    isOnOrBeforeCurrentMonth(key, today),
      });
    }

    const entry    = byMonth.get(key)!;
    entry.target   += r.Target_Amount__c    || 0;
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

export async function buildAdvisoryData(): Promise<AdvisoryData> {
  const records = await getProgrammeFinanceRecords();
  const today   = new Date();

  const advisoryRecords = records.filter(r => r.Type__c === ADVISORY_TYPE);
  const ytdRecords      = advisoryRecords.filter(r =>
    isOnOrBeforeCurrentMonth(r.Recruitment_Target_Month__c, today)
  );

  const sum = (recs: ProgrammeFinanceRecord[], field: keyof ProgrammeFinanceRecord) =>
    recs.reduce((acc, r) => acc + ((r[field] as number) || 0), 0);

  const ytdConfirmed = sum(ytdRecords, 'Monthly_Confirmed__c');
  const ytdTarget    = sum(ytdRecords, 'Target_Amount__c');
  const ytdCosts     = sum(ytdRecords, 'Monthly_Costs__c');

  return {
    ytdConfirmed,
    ytdTarget,
    ytdCosts,
    ytdMargin:  ytdConfirmed - ytdCosts,
    variance:   ytdConfirmed - ytdTarget,
    months:     aggregateAdvisoryByMonth(advisoryRecords, today),
    lastUpdated: new Date().toISOString(),
  };
}
