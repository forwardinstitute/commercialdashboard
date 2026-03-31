import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getAdvisoryOpportunities,
  getProgrammeOpportunities,
  getProgrammeFinanceRecords,
  getPartnerAccounts,
} from '@/lib/salesforce';
import { getProgrammeType } from '@/lib/programmes';
import { AdvisoryOpportunity, OrganisationAccount, ProgrammeOpportunity } from '@/types';

export const dynamic = 'force-dynamic';

// ── FY months (Mar 2026 – Feb 2027) ──────────────────────────────────────────
const FY_MONTHS = [
  { year: 2026, month: 2,  label: '2026-03' },
  { year: 2026, month: 3,  label: '2026-04' },
  { year: 2026, month: 4,  label: '2026-05' },
  { year: 2026, month: 5,  label: '2026-06' },
  { year: 2026, month: 6,  label: '2026-07' },
  { year: 2026, month: 7,  label: '2026-08' },
  { year: 2026, month: 8,  label: '2026-09' },
  { year: 2026, month: 9,  label: '2026-10' },
  { year: 2026, month: 10, label: '2026-11' },
  { year: 2026, month: 11, label: '2026-12' },
  { year: 2027, month: 0,  label: '2027-01' },
  { year: 2027, month: 1,  label: '2027-02' },
];

// ── Advisory proration helpers ────────────────────────────────────────────────
function advisoryCoversMonth(opp: AdvisoryOpportunity, year: number, month: number): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const oppStart = new Date(opp.Start_Date_All__c);
  const oppEnd   = new Date(opp.End_DateAll__c);
  return oppStart <= new Date(year, month + 1, 0) && oppEnd >= new Date(year, month, 1);
}

function advisoryMonthlySlice(opp: AdvisoryOpportunity): number {
  if (!opp.Amount || opp.Amount <= 0) return 0;
  let months = opp.Number_of_Months__c;
  if (!months || months <= 0) {
    if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return 0;
    const s = new Date(opp.Start_Date_All__c);
    const e = new Date(opp.End_DateAll__c);
    months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
  }
  return opp.Amount / months;
}

// ── Programme helpers ─────────────────────────────────────────────────────────
function closesInMonth(opp: ProgrammeOpportunity, year: number, month: number): boolean {
  if (!opp.CloseDate) return false;
  const d = new Date(opp.CloseDate + 'T12:00:00');
  return d.getFullYear() === year && d.getMonth() === month;
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  try {
    const [advisoryOpps, rawProgrammeOpps, financeRecords] = await Promise.all([
      getAdvisoryOpportunities(),
      getProgrammeOpportunities(),
      getProgrammeFinanceRecords(),
    ]);

    const programmeOpps = rawProgrammeOpps.filter(
      o => !(o.Programme__r?.Name ?? '').includes('Advisory Practice')
    );

    // Fetch partner accounts for weighted potential
    const accountIds = [...new Set([
      ...advisoryOpps.map(o => o.Account?.Id),
      ...programmeOpps.map(o => o.Account?.Id),
    ].filter(Boolean))] as string[];

    const accounts = await getPartnerAccounts(accountIds);
    const accountMap = new Map<string, OrganisationAccount>(accounts.map(a => [a.Id, a]));

    // ── Targets by month from finance records ─────────────────────────────────
    // Key: 'YYYY-MM', value: { advisory, all, fellowship, exchange, ltd, other }
    type MonthTargets = Record<string, number>;
    const advTargetByMonth: MonthTargets = {};
    const progTargetByMonth: Record<string, MonthTargets> = {};

    for (const r of financeRecords) {
      const progName = r.Programme__r?.Name ?? '';
      const amount   = r.Target_Amount__c ?? 0;
      // Finance records use end-of-month date e.g. '2026-03-31' → label '2026-03'
      const raw = r.Recruitment_Target_Month__c ?? '';
      const label = raw.slice(0, 7); // 'YYYY-MM'
      if (!label) continue;

      if (progName.includes('Advisory Practice')) {
        advTargetByMonth[label] = (advTargetByMonth[label] ?? 0) + amount;
      } else {
        if (!progTargetByMonth[label]) progTargetByMonth[label] = { all: 0, fellowship: 0, exchange: 0, ltd: 0, other: 0 };
        progTargetByMonth[label].all += amount;
        const type = getProgrammeType(progName);
        progTargetByMonth[label][type] = (progTargetByMonth[label][type] ?? 0) + amount;
      }
    }

    // ── Weighted potential: sum across all advisory accounts (FY total, static) ─
    let totalWeightedPotential = 0;
    const seenAdvisoryAccounts = new Set<string>();
    for (const opp of advisoryOpps) {
      const id = opp.Account?.Id;
      if (!id || seenAdvisoryAccounts.has(id)) continue;
      seenAdvisoryAccounts.add(id);
      const acc = accountMap.get(id);
      if (acc?.Advisory_Potential__c && acc?.Advisory_Potential_Percent__c) {
        totalWeightedPotential += acc.Advisory_Potential__c * (acc.Advisory_Potential_Percent__c / 100);
      }
    }

    // ── Advisory: 12 rows, one per pipeline month ─────────────────────────────
    type MonthBucket = {
      confirmed: number; expected: number; possible: number; opp_count: number;
    };
    type SectorKey = string; // 'stream|sector'

    const advRows = [];
    const sectorRows: Map<string, { pipeline_month: string; stream: string; sector: string } & MonthBucket> = new Map();

    for (const { year, month, label } of FY_MONTHS) {
      const bucket: MonthBucket = { confirmed: 0, expected: 0, possible: 0, opp_count: 0 };

      for (const opp of advisoryOpps) {
        if (!advisoryCoversMonth(opp, year, month)) continue;
        const slice  = advisoryMonthlySlice(opp);
        const sector = opp.Organisation_Sector__c ?? 'Unknown';
        const sKey: SectorKey = `${label}|advisory|${sector}`;

        if (!sectorRows.has(sKey)) sectorRows.set(sKey, { pipeline_month: label, stream: 'advisory', sector, confirmed: 0, expected: 0, possible: 0, opp_count: 0 });
        const sc = sectorRows.get(sKey)!;

        if (opp.StageName === 'Confirmed') {
          bucket.confirmed  += slice;
          bucket.opp_count  += 1;
          sc.confirmed      += slice;
          sc.opp_count      += 1;
        } else if (opp.StageName !== 'Opportunity lost') {
          const prob         = (opp.Probability ?? 0) / 100;
          bucket.expected   += slice * prob;
          bucket.possible   += slice * (1 - prob);
          bucket.opp_count  += 1;
          sc.expected       += slice * prob;
          sc.possible       += slice * (1 - prob);
          sc.opp_count      += 1;
        }
      }

      advRows.push({
        snapshot_date:      today,
        pipeline_month:     label,
        confirmed:          Math.round(bucket.confirmed),
        expected:           Math.round(bucket.expected),
        possible:           Math.round(bucket.possible),
        opp_count:          bucket.opp_count,
        target:             Math.round(advTargetByMonth[label] ?? 0),
        weighted_potential: Math.round(totalWeightedPotential), // same each month — the FY total
      });
    }

    // ── Programmes: 12 months × 5 types ──────────────────────────────────────
    const progRows = [];

    for (const { year, month, label } of FY_MONTHS) {
      const buckets: Record<string, MonthBucket & { places: number }> = {
        all:        { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 },
        fellowship: { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 },
        exchange:   { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 },
        ltd:        { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 },
        other:      { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 },
      };

      for (const opp of programmeOpps) {
        if (!closesInMonth(opp, year, month)) continue;
        const amount = opp.Amount ?? 0;
        const places = opp.Total_Places__c ?? 0;
        const type   = getProgrammeType(opp.Programme__r?.Name ?? '');
        const sector = opp.Organisation_Sector__c ?? 'Unknown';
        const sKey: SectorKey = `${label}|${type}|${sector}`;

        if (!sectorRows.has(sKey)) sectorRows.set(sKey, { pipeline_month: label, stream: type, sector, confirmed: 0, expected: 0, possible: 0, opp_count: 0 });
        const sc = sectorRows.get(sKey)!;

        if (opp.StageName === 'Confirmed') {
          buckets.all.confirmed    += amount; buckets.all.opp_count  += 1; buckets.all.places  += places;
          buckets[type].confirmed  += amount; buckets[type].opp_count += 1; buckets[type].places += places;
          sc.confirmed             += amount; sc.opp_count            += 1;
        } else {
          const prob = (opp.Probability ?? 0) / 100;
          buckets.all.expected     += amount * prob;    buckets.all.possible    += amount * (1 - prob);
          buckets.all.opp_count    += 1;                buckets.all.places      += places;
          buckets[type].expected   += amount * prob;    buckets[type].possible  += amount * (1 - prob);
          buckets[type].opp_count  += 1;                buckets[type].places    += places;
          sc.expected              += amount * prob;    sc.possible             += amount * (1 - prob);
          sc.opp_count             += 1;
        }
      }

      for (const [programme_type, b] of Object.entries(buckets)) {
        progRows.push({
          snapshot_date:  today,
          pipeline_month: label,
          programme_type,
          confirmed:      Math.round(b.confirmed),
          expected:       Math.round(b.expected),
          possible:       Math.round(b.possible),
          opp_count:      b.opp_count,
          places:         b.places,
          target:         Math.round(progTargetByMonth[label]?.[programme_type] ?? 0),
        });
      }
    }

    // ── Org snapshots (FY totals per org — not monthly) ───────────────────────
    const orgMap = new Map<string, ReturnType<typeof buildOrgBucket>>();

    function buildOrgBucket(accountId: string, name: string, sector: string) {
      const acc    = accountMap.get(accountId);
      const advPot = acc?.Advisory_Potential__c  ?? 0;
      const advPct = acc?.Advisory_Potential_Percent__c ?? 0;
      const prgPot = acc?.Programme_Potential__c ?? 0;
      const prgPct = acc?.Programme_Potential_Percent__c ?? 0;
      return {
        account_id: accountId, account_name: name, sector,
        advisory_confirmed: 0,   advisory_expected: 0,   advisory_possible: 0,   advisory_opp_count: 0,
        advisory_potential: advPot, advisory_weighted: advPot * (advPct / 100),
        programme_confirmed: 0,  programme_expected: 0,  programme_possible: 0,  programme_opp_count: 0, programme_places: 0,
        programme_potential: prgPot, programme_weighted: prgPot * (prgPct / 100),
        total_potential: advPot + prgPot, total_weighted: advPot * (advPct / 100) + prgPot * (prgPct / 100),
      };
    }

    for (const opp of advisoryOpps) {
      const id = opp.Account?.Id; if (!id) continue;
      if (!orgMap.has(id)) orgMap.set(id, buildOrgBucket(id, opp.Account?.Name ?? '', opp.Organisation_Sector__c ?? 'Unknown'));
      const org = orgMap.get(id)!;
      const fyAmount = FY_MONTHS.reduce((sum, { year, month }) => advisoryCoversMonth(opp, year, month) ? sum + advisoryMonthlySlice(opp) : sum, 0);
      if (opp.StageName === 'Confirmed') {
        org.advisory_confirmed += fyAmount; org.advisory_opp_count += 1;
      } else if (opp.StageName !== 'Opportunity lost') {
        const prob = (opp.Probability ?? 0) / 100;
        org.advisory_expected += fyAmount * prob; org.advisory_possible += fyAmount * (1 - prob); org.advisory_opp_count += 1;
      }
    }

    for (const opp of programmeOpps) {
      const id = opp.Account?.Id; if (!id) continue;
      if (!orgMap.has(id)) orgMap.set(id, buildOrgBucket(id, opp.Account?.Name ?? '', opp.Organisation_Sector__c ?? 'Unknown'));
      const org    = orgMap.get(id)!;
      const amount = opp.Amount ?? 0;
      const places = opp.Total_Places__c ?? 0;
      if (opp.StageName === 'Confirmed') {
        org.programme_confirmed += amount; org.programme_opp_count += 1; org.programme_places += places;
      } else {
        const prob = (opp.Probability ?? 0) / 100;
        org.programme_expected += amount * prob; org.programme_possible += amount * (1 - prob);
        org.programme_opp_count += 1; org.programme_places += places;
      }
    }

    const orgRows = [...orgMap.values()].map(o => ({
      snapshot_date:        today,
      account_id:           o.account_id,
      account_name:         o.account_name,
      sector:               o.sector,
      advisory_confirmed:   Math.round(o.advisory_confirmed),
      advisory_expected:    Math.round(o.advisory_expected),
      advisory_possible:    Math.round(o.advisory_possible),
      advisory_opp_count:   o.advisory_opp_count,
      advisory_potential:   Math.round(o.advisory_potential),
      advisory_weighted:    Math.round(o.advisory_weighted),
      programme_confirmed:  Math.round(o.programme_confirmed),
      programme_expected:   Math.round(o.programme_expected),
      programme_possible:   Math.round(o.programme_possible),
      programme_opp_count:  o.programme_opp_count,
      programme_places:     o.programme_places,
      programme_potential:  Math.round(o.programme_potential),
      programme_weighted:   Math.round(o.programme_weighted),
      total_potential:      Math.round(o.total_potential),
      total_weighted:       Math.round(o.total_weighted),
    }));

    // ── Upserts ───────────────────────────────────────────────────────────────
    const [r1, r2, r3, r4] = await Promise.all([
      supabase.from('advisory_monthly_snapshots').upsert(advRows,    { onConflict: 'snapshot_date,pipeline_month' }),
      supabase.from('programme_monthly_snapshots').upsert(progRows,  { onConflict: 'snapshot_date,pipeline_month,programme_type' }),
      supabase.from('sector_monthly_snapshots').upsert([...sectorRows.values()].map(r => ({ snapshot_date: today, ...r, confirmed: Math.round(r.confirmed), expected: Math.round(r.expected), possible: Math.round(r.possible) })), { onConflict: 'snapshot_date,pipeline_month,stream,sector' }),
      supabase.from('org_snapshots').upsert(orgRows, { onConflict: 'snapshot_date,account_id' }),
    ]);

    if (r1.error) throw new Error(`Advisory upsert failed: ${r1.error.message}`);
    if (r2.error) throw new Error(`Programme upsert failed: ${r2.error.message}`);
    if (r3.error) throw new Error(`Sector upsert failed: ${r3.error.message}`);
    if (r4.error) throw new Error(`Org upsert failed: ${r4.error.message}`);

    return NextResponse.json({
      success: true,
      date: today,
      rows: { advisory: advRows.length, programmes: progRows.length, sectors: sectorRows.size, orgs: orgRows.length },
    });

  } catch (err) {
    console.error('[snapshot] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
