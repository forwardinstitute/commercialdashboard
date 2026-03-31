import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdvisoryOpportunities, getProgrammeOpportunities } from '@/lib/salesforce';
import { getProgrammeType } from '@/lib/programmes';
import { AdvisoryOpportunity } from '@/types';

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

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Protect with CRON_SECRET — Vercel sets this automatically and sends it as
  // a Bearer token when triggering cron jobs.
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  try {
    // ── Advisory ────────────────────────────────────────────────────────────────
    const advisoryOpps = await getAdvisoryOpportunities();

    let advConfirmed = 0;
    let advExpected  = 0;
    let advPossible  = 0;

    for (const opp of advisoryOpps) {
      const amount = advisoryFYAmount(opp);
      if (opp.StageName === 'Confirmed') {
        advConfirmed += amount;
      } else if (opp.StageName !== 'Opportunity lost') {
        const prob    = (opp.Probability ?? 0) / 100;
        advExpected  += amount * prob;
        advPossible  += amount * (1 - prob);
      }
    }

    const { error: advError } = await supabase
      .from('advisory_snapshots')
      .upsert(
        { snapshot_date: today, confirmed: Math.round(advConfirmed), expected: Math.round(advExpected), possible: Math.round(advPossible) },
        { onConflict: 'snapshot_date' }
      );

    if (advError) throw new Error(`Advisory upsert failed: ${advError.message}`);

    // ── Programmes ──────────────────────────────────────────────────────────────
    const programmeOpps = await getProgrammeOpportunities();
    const filtered = programmeOpps.filter(
      o => !(o.Programme__r?.Name ?? '').includes('Advisory Practice')
    );

    const totals: Record<string, { confirmed: number; expected: number; possible: number }> = {
      all:        { confirmed: 0, expected: 0, possible: 0 },
      fellowship: { confirmed: 0, expected: 0, possible: 0 },
      exchange:   { confirmed: 0, expected: 0, possible: 0 },
      ltd:        { confirmed: 0, expected: 0, possible: 0 },
      other:      { confirmed: 0, expected: 0, possible: 0 },
    };

    for (const opp of filtered) {
      const amount = opp.Amount ?? 0;
      const type   = getProgrammeType(opp.Programme__r?.Name ?? '');
      if (opp.StageName === 'Confirmed') {
        totals.all.confirmed        += amount;
        totals[type].confirmed      += amount;
      } else {
        const prob = (opp.Probability ?? 0) / 100;
        totals.all.expected         += amount * prob;
        totals[type].expected       += amount * prob;
        totals.all.possible         += amount * (1 - prob);
        totals[type].possible       += amount * (1 - prob);
      }
    }

    const progRows = Object.entries(totals).map(([programme_type, t]) => ({
      snapshot_date:  today,
      programme_type,
      confirmed: Math.round(t.confirmed),
      expected:  Math.round(t.expected),
      possible:  Math.round(t.possible),
    }));

    const { error: progError } = await supabase
      .from('programme_snapshots')
      .upsert(progRows, { onConflict: 'snapshot_date,programme_type' });

    if (progError) throw new Error(`Programme upsert failed: ${progError.message}`);

    return NextResponse.json({
      success: true,
      date: today,
      advisory: { confirmed: Math.round(advConfirmed), expected: Math.round(advExpected), possible: Math.round(advPossible) },
      programmes: totals,
    });
  } catch (err) {
    console.error('[snapshot] error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
