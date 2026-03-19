import { getProgrammeFinanceRecords } from '@/lib/salesforce';
import { DashboardData, MonthlyData, ProgrammeGroup } from '@/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                     'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ADVISORY_PROGRAMMES = ['Advisory Practice 2026'];
const PROGRAMME_NAMES = [
  'Fellowship Programme 2026',
  'Exchange 2026',
  'Leading Through Disruption 2026',
];

export async function buildDashboardData(): Promise<DashboardData> {
  const records = await getProgrammeFinanceRecords();
  const today = new Date();

  // Group by programme name
  const grouped: Record<string, typeof records> = {};
  for (const record of records) {
    const name = record.Programme__r?.Name || 'Unknown';
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push(record);
  }

  const buildMonths = (recs: typeof records): MonthlyData[] =>
    recs.map((r) => {
      const d = new Date(r.Recruitment_Target_Month__c);
      return {
        month: MONTH_NAMES[d.getMonth()],
        monthDate: r.Recruitment_Target_Month__c,
        target: r.Target_Amount__c || 0,
        confirmed: r.Confirmed__c || 0,
        expected: r.Expected__c || 0,
        potential: r.Potential__c || 0,
        isPast: d <= today,
      };
    });

  const sumField = (recs: typeof records, field: keyof typeof records[0]) =>
    recs.reduce((acc, r) => acc + ((r[field] as number) || 0), 0);

  // Build advisory
  const advisoryRecords = ADVISORY_PROGRAMMES.flatMap((n) => grouped[n] || []);
  const advisoryMonths = buildMonths(advisoryRecords);
  const advisoryYtd = advisoryRecords.filter(
    (r) => new Date(r.Recruitment_Target_Month__c) <= today
  );

  // Build programmes
  const progRecords = PROGRAMME_NAMES.flatMap((n) => grouped[n] || []);
  const progMonths = buildMonths(progRecords);
  const progYtd = progRecords.filter(
    (r) => new Date(r.Recruitment_Target_Month__c) <= today
  );

  const breakdown: ProgrammeGroup[] = PROGRAMME_NAMES.map((name) => {
    const recs = grouped[name] || [];
    return {
      name,
      type: 'programmes',
      totalTarget: sumField(recs, 'Target_Amount__c'),
      totalConfirmed: sumField(recs, 'Confirmed__c'),
      totalExpected: sumField(recs, 'Expected__c'),
      totalPotential: sumField(recs, 'Potential__c'),
      months: buildMonths(recs),
    };
  });

  return {
    advisory: {
      ytdTarget: sumField(advisoryYtd, 'Target_Amount__c'),
      ytdConfirmed: sumField(advisoryYtd, 'Confirmed__c'),
      variance: sumField(advisoryYtd, 'Confirmed__c') - sumField(advisoryYtd, 'Target_Amount__c'),
      months: advisoryMonths,
    },
    programmes: {
      ytdTarget: sumField(progYtd, 'Target_Amount__c'),
      ytdConfirmed: sumField(progYtd, 'Confirmed__c'),
      variance: sumField(progYtd, 'Confirmed__c') - sumField(progYtd, 'Target_Amount__c'),
      months: progMonths,
      breakdown,
    },
    lastUpdated: new Date().toISOString(),
  };
}
