import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  getAdvisoryOpportunities,
  getProgrammeOpportunities,
  getProgrammeFinanceRecords,
  getPartnerAccounts,
} from '@/lib/salesforce';
import { getProgrammeType } from '@/lib/programmes';
import { AdvisoryOpportunity, OrganisationAccount } from '@/types';

export const dynamic = 'force-dynamic';

// ── Advisory proration (mirrors lib/organisations.ts) ─────────────────────────
const FY_MONTHS = [
  { year: 2026, month: 2  }, { year: 2026, month: 3  }, { year: 2026, month: 4  },
  { year: 2026, month: 5  }, { year: 2026, month: 6  }, { year: 2026, month: 7  },
  { year: 2026, month: 8  }, { year: 2026, month: 9  }, { year: 2026, month: 10 },
  { year: 2026, month: 11 }, { year: 2027, month: 0  }, { year: 2027, month: 1  },
];

function advisoryCoversMonth(opp: AdvisoryOpportunity, year: number, month: number): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  const oppStart   = new Date(opp.Start_Date_All__c);
  const oppEnd     = new Date(opp.End_DateAll__c);
  return oppStart <= monthEnd && oppEnd >= monthStart;
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

function advisoryFYAmount(opp: AdvisoryOpportunity): number {
  const slice = advisoryMonthlySlice(opp);
  if (slice === 0) return 0;
  return FY_MONTHS.filter(({ year, month }) => advisoryCoversMonth(opp, year, month)).length * slice;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PipelineBucket = {
  confirmed: number; expected: number; possible: number;
  opp_count: number;
};

type ProgBucket = PipelineBucket & { places: number };

type StreamSectorCell = PipelineBucket & { stream: string; sector: string };

type OrgBucket = {
  account_id: string; account_name: string; sector: string;
  advisory_confirmed: number; advisory_expected: number; advisory_possible: number;
  advisory_opp_count: number; advisory_potential: number; advisory_weighted: number;
  programme_confirmed: number; programme_expected: number; programme_possible: number;
  programme_opp_count: number; programme_places: number;
  programme_potential: number; programme_weighted: number;
  total_potential: number; total_weighted: number;
};

function emptyPipeline(): PipelineBucket {
  return { confirmed: 0, expected: 0, possible: 0, opp_count: 0 };
}

function emptyProg(): ProgBucket {
  return { confirmed: 0, expected: 0, possible: 0, opp_count: 0, places: 0 };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Fetch everything in parallel
    const [advisoryOpps, rawProgrammeOpps, financeRecords] = await Promise.all([
      getAdvisoryOpportunities(),
      getProgrammeOpportunities(),
      getProgrammeFinanceRecords(),
    ]);

    const programmeOpps = rawProgrammeOpps.filter(
      o => !(o.Programme__r?.Name ?? '').includes('Advisory Practice')
    );

    // Fetch partner accounts for all orgs that appear in either opp set
    const accountIds = [
      ...new Set([
        ...advisoryOpps.map(o => o.Account?.Id).filter(Boolean),
        ...programmeOpps.map(o => o.Account?.Id).filter(Boolean),
      ])
    ] as string[];

    const accounts = await getPartnerAccounts(accountIds);
    const accountMap = new Map<string, OrganisationAccount>(accounts.map(a => [a.Id, a]));

    // ── Targets from finance records ───────────────────────────────────────────
    let advTarget = 0;
    const progTargets: Record<string, number> = {
      all: 0, fellowship: 0, exchange: 0, ltd: 0, other: 0,
    };

    for (const r of financeRecords) {
      const progName = r.Programme__r?.Name ?? '';
      const amount   = r.Target_Amount__c ?? 0;
      if (progName.includes('Advisory Practice')) {
        advTarget += amount;
      } else {
        progTargets.all += amount;
        const type = getProgrammeType(progName);
        progTargets[type] = (progTargets[type] ?? 0) + amount;
      }
    }

    // ── Advisory pipeline ──────────────────────────────────────────────────────
    const adv: PipelineBucket = emptyPipeline();
    let advWeightedPotential  = 0;

    const streamSectorMap = new Map<string, StreamSectorCell>();
    const orgMap          = new Map<string, OrgBucket>();

    function getStreamSector(stream: string, sector: string): StreamSectorCell {
      const key = `${stream}|${sector}`;
      if (!streamSectorMap.has(key)) {
        streamSectorMap.set(key, { stream, sector, confirmed: 0, expected: 0, possible: 0, opp_count: 0 });
      }
      return streamSectorMap.get(key)!;
    }

    function getOrg(accountId: string, name: string, sector: string): OrgBucket {
      if (!orgMap.has(accountId)) {
        const acc     = accountMap.get(accountId);
        const advPot  = acc?.Advisory_Potential__c  ?? 0;
        const advPct  = acc?.Advisory_Potential_Percent__c ?? 0;
        const prgPot  = acc?.Programme_Potential__c ?? 0;
        const prgPct  = acc?.Programme_Potential_Percent__c ?? 0;
        const advW    = advPot * (advPct / 100);
        const prgW    = prgPot * (prgPct / 100);
        orgMap.set(accountId, {
          account_id: accountId, account_name: name, sector,
          advisory_confirmed: 0, advisory_expected: 0, advisory_possible: 0, advisory_opp_count: 0,
          advisory_potential: advPot, advisory_weighted: advW,
          programme_confirmed: 0, programme_expected: 0, programme_possible: 0,
          programme_opp_count: 0, programme_places: 0,
          programme_potential: prgPot, programme_weighted: prgW,
          total_potential: advPot + prgPot, total_weighted: advW + prgW,
        });
      }
      return orgMap.get(accountId)!;
    }

    for (const opp of advisoryOpps) {
      const amount   = advisoryFYAmount(opp);
      const sector   = opp.Organisation_Sector__c ?? 'Unknown';
      const cell     = getStreamSector('advisory', sector);
      const accountId = opp.Account?.Id;
      const org      = accountId ? getOrg(accountId, opp.Account?.Name ?? '', sector) : null;

      if (opp.StageName === 'Confirmed') {
        adv.confirmed        += amount;
        adv.opp_count        += 1;
        cell.confirmed       += amount;
        cell.opp_count       += 1;
        if (org) { org.advisory_confirmed += amount; org.advisory_opp_count += 1; }
      } else if (opp.StageName !== 'Opportunity lost') {
        const prob            = (opp.Probability ?? 0) / 100;
        adv.expected         += amount * prob;
        adv.possible         += amount * (1 - prob);
        adv.opp_count        += 1;
        cell.expected        += amount * prob;
        cell.possible        += amount * (1 - prob);
        cell.opp_count       += 1;
        if (org) {
          org.advisory_expected += amount * prob;
          org.advisory_possible += amount * (1 - prob);
          org.advisory_opp_count += 1;
        }
      }
    }

    // Weighted potential: sum across all accounts that appear in advisory opps
    for (const org of orgMap.values()) {
      advWeightedPotential += org.advisory_weighted;
    }

    // ── Programme pipeline ─────────────────────────────────────────────────────
    const progTotals: Record<string, ProgBucket> = {
      all:        emptyProg(),
      fellowship: emptyProg(),
      exchange:   emptyProg(),
      ltd:        emptyProg(),
      other:      emptyProg(),
    };

    for (const opp of programmeOpps) {
      const amount    = opp.Amount ?? 0;
      const places    = opp.Total_Places__c ?? 0;
      const type      = getProgrammeType(opp.Programme__r?.Name ?? '');
      const sector    = opp.Organisation_Sector__c ?? 'Unknown';
      const cell      = getStreamSector(type, sector);
      const accountId = opp.Account?.Id;
      const org       = accountId ? getOrg(accountId, opp.Account?.Name ?? '', sector) : null;

      if (opp.StageName === 'Confirmed') {
        progTotals.all.confirmed      += amount;
        progTotals.all.opp_count      += 1;
        progTotals.all.places         += places;
        progTotals[type].confirmed    += amount;
        progTotals[type].opp_count    += 1;
        progTotals[type].places       += places;
        cell.confirmed                += amount;
        cell.opp_count                += 1;
        if (org) {
          org.programme_confirmed     += amount;
          org.programme_opp_count     += 1;
          org.programme_places        += places;
        }
      } else {
        const prob = (opp.Probability ?? 0) / 100;
        progTotals.all.expected       += amount * prob;
        progTotals.all.possible       += amount * (1 - prob);
        progTotals.all.opp_count      += 1;
        progTotals.all.places         += places;
        progTotals[type].expected     += amount * prob;
        progTotals[type].possible     += amount * (1 - prob);
        progTotals[type].opp_count    += 1;
        progTotals[type].places       += places;
        cell.expected                 += amount * prob;
        cell.possible                 += amount * (1 - prob);
        cell.opp_count                += 1;
        if (org) {
          org.programme_expected      += amount * prob;
          org.programme_possible      += amount * (1 - prob);
          org.programme_opp_count     += 1;
          org.programme_places        += places;
        }
      }
    }

    // ── Upserts ────────────────────────────────────────────────────────────────
    const round = (n: number) => Math.round(n);

    const { error: advError } = await supabase
      .from('advisory_snapshots')
      .upsert({
        snapshot_date:      today,
        confirmed:          round(adv.confirmed),
        expected:           round(adv.expected),
        possible:           round(adv.possible),
        opp_count:          adv.opp_count,
        target:             round(advTarget),
        weighted_potential: round(advWeightedPotential),
      }, { onConflict: 'snapshot_date' });
    if (advError) throw new Error(`Advisory upsert failed: ${advError.message}`);

    const progRows = Object.entries(progTotals).map(([programme_type, t]) => ({
      snapshot_date:  today,
      programme_type,
      confirmed:      round(t.confirmed),
      expected:       round(t.expected),
      possible:       round(t.possible),
      opp_count:      t.opp_count,
      places:         t.places,
      target:         round(progTargets[programme_type] ?? 0),
    }));
    const { error: progError } = await supabase
      .from('programme_snapshots')
      .upsert(progRows, { onConflict: 'snapshot_date,programme_type' });
    if (progError) throw new Error(`Programme upsert failed: ${progError.message}`);

    const sectorRows = [...streamSectorMap.values()].map(t => ({
      snapshot_date: today,
      stream:        t.stream,
      sector:        t.sector,
      confirmed:     round(t.confirmed),
      expected:      round(t.expected),
      possible:      round(t.possible),
      opp_count:     t.opp_count,
    }));
    const { error: sectorError } = await supabase
      .from('sector_snapshots')
      .upsert(sectorRows, { onConflict: 'snapshot_date,stream,sector' });
    if (sectorError) throw new Error(`Sector upsert failed: ${sectorError.message}`);

    const orgRows = [...orgMap.values()].map(o => ({
      snapshot_date:        today,
      account_id:           o.account_id,
      account_name:         o.account_name,
      sector:               o.sector,
      advisory_confirmed:   round(o.advisory_confirmed),
      advisory_expected:    round(o.advisory_expected),
      advisory_possible:    round(o.advisory_possible),
      advisory_opp_count:   o.advisory_opp_count,
      advisory_potential:   round(o.advisory_potential),
      advisory_weighted:    round(o.advisory_weighted),
      programme_confirmed:  round(o.programme_confirmed),
      programme_expected:   round(o.programme_expected),
      programme_possible:   round(o.programme_possible),
      programme_opp_count:  o.programme_opp_count,
      programme_places:     o.programme_places,
      programme_potential:  round(o.programme_potential),
      programme_weighted:   round(o.programme_weighted),
      total_potential:      round(o.total_potential),
      total_weighted:       round(o.total_weighted),
    }));
    const { error: orgError } = await supabase
      .from('org_snapshots')
      .upsert(orgRows, { onConflict: 'snapshot_date,account_id' });
    if (orgError) throw new Error(`Org upsert failed: ${orgError.message}`);

    return NextResponse.json({
      success:   true,
      date:      today,
      advisory:  { ...adv, target: round(advTarget), weighted_potential: round(advWeightedPotential) },
      programmes: progTotals,
      orgs:      orgRows.length,
      sectors:   sectorRows.length,
    });

  } catch (err) {
    console.error('[snapshot] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
