'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { ProgrammeOpportunity, ProgrammeType } from '@/types';
import { PLACE_BUCKETS, PlaceBucket, productBucket, stageRank, SECTOR_COLOURS } from '@/lib/places';

// Local copy of the type classifier — mirrors lib/programmes.ts so we don't pull a
// server module into a client component.
function getProgrammeType(name: string): Exclude<ProgrammeType, 'all'> {
  const n = name.toLowerCase();
  if (n.includes('fellowship programme')) return 'fellowship';
  if (n.includes('exchange')) return 'exchange';
  if (n.includes('leading through disruption') || n.includes('disruption')) return 'ltd';
  return 'other';
}

// Places-focused view defaults to Fellowship, with click-throughs to Exchange / LtD.
const PROGRAMME_TABS: { type: Exclude<ProgrammeType, 'all' | 'other'>; label: string }[] = [
  { type: 'fellowship', label: 'Fellowship' },
  { type: 'exchange', label: 'Exchange' },
  { type: 'ltd', label: 'LtD' },
];

const PAID_SECTORS: PlaceBucket[] = ['Private', 'Public', 'Social'];

const STAGE_COLOURS: Record<string, string> = {
  Hopeful: '#e3c9bd', Possible: '#dda06f', Expecting: '#85d1e3', Expected: '#85d1e3', Confirmed: '#195e47',
};

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const fmtMoneyFull = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const fmtPlaces = (n: number) => Math.round(n).toLocaleString('en-GB');

function oppSector(o: ProgrammeOpportunity) { return o.Organisation_Sector__c || 'Unknown'; }
function lineItems(o: ProgrammeOpportunity) { return o.OpportunityLineItems?.records ?? []; }
function oppTotalPlaces(o: ProgrammeOpportunity) {
  return lineItems(o).reduce((s, li) => s + (li.Quantity ?? 0), 0);
}

const PlacesTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtPlaces(p.value)} places</span>
        </p>
      ))}
    </div>
  );
};
const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtMoneyFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

interface Props { opportunities: ProgrammeOpportunity[]; }

export default function ProgrammesPlacesView({ opportunities }: Props) {
  const [programme, setProgramme] = useState<Exclude<ProgrammeType, 'all' | 'other'>>('fellowship');

  const opps = useMemo(
    () => opportunities.filter(o => getProgrammeType(o.Programme__r?.Name ?? '') === programme),
    [opportunities, programme]
  );

  // ── Places per stage, split by sector bucket ─────────────────────────────────
  const { stageData, stages } = useMemo(() => {
    const byStage: Record<string, Record<string, number>> = {};
    for (const o of opps) {
      const stage = o.StageName;
      byStage[stage] ??= {};
      for (const li of lineItems(o)) {
        const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
        if (!bucket) continue;
        byStage[stage][bucket] = (byStage[stage][bucket] ?? 0) + (li.Quantity ?? 0);
      }
    }
    const stages = Object.keys(byStage).sort((a, b) => stageRank(a) - stageRank(b));
    const stageData = stages.map(stage => ({ stage, ...byStage[stage] }));
    return { stageData, stages };
  }, [opps]);

  // Total places per stage (KPI tiles) — ordered along the funnel.
  const stageTotals = useMemo(
    () => stages.map(stage => ({
      stage,
      places: PLACE_BUCKETS.reduce((s, b) => s + ((stageData.find(d => d.stage === stage) as any)?.[b] ?? 0), 0),
    })),
    [stages, stageData]
  );

  // ── Sector split (Private / Public / Social / Free) across all live opps ─────
  const sectorSplit = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const o of opps) {
      for (const li of lineItems(o)) {
        const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
        if (!bucket) continue;
        acc[bucket] = (acc[bucket] ?? 0) + (li.Quantity ?? 0);
      }
    }
    return PLACE_BUCKETS.map(b => ({ bucket: b, places: acc[b] ?? 0 })).filter(d => d.places > 0);
  }, [opps]);

  // ── Price per place: list vs actual, averaged per paid sector ─────────────────
  const priceBySector = useMemo(() => {
    const acc: Record<string, { qty: number; actual: number; list: number }> = {};
    for (const o of opps) {
      for (const li of lineItems(o)) {
        const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
        if (!bucket) continue;
        const qty = li.Quantity ?? 0;
        acc[bucket] ??= { qty: 0, actual: 0, list: 0 };
        acc[bucket].qty += qty;
        acc[bucket].actual += (li.UnitPrice ?? 0) * qty;
        acc[bucket].list += (li.ListPrice ?? 0) * qty;
      }
    }
    return PAID_SECTORS
      .filter(b => acc[b]?.qty)
      .map(b => ({
        sector: b,
        List: acc[b].list / acc[b].qty,
        Actual: acc[b].actual / acc[b].qty,
      }));
  }, [opps]);

  // ── Per-opportunity, blended price per place, descending ─────────────────────
  const oppRows = useMemo(() =>
    opps
      .map(o => {
        const places = oppTotalPlaces(o);
        return {
          id: o.Id,
          name: o.Name,
          org: o.Account?.Name ?? '—',
          sector: oppSector(o),
          stage: o.StageName,
          places,
          amount: o.Amount ?? 0,
          pricePerPlace: places > 0 ? (o.Amount ?? 0) / places : 0,
        };
      })
      .filter(r => r.places > 0)
      .sort((a, b) => b.pricePerPlace - a.pricePerPlace),
    [opps]
  );

  const totalPlaces = sectorSplit.reduce((s, d) => s + d.places, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Programme tabs ──────────────────────────────────────────────────── */}
      <div className="flex items-center flex-wrap gap-2">
        {PROGRAMME_TABS.map(({ type, label }) => (
          <button key={type} onClick={() => setProgramme(type)}
            className={`px-3 py-1 rounded-full text-xs font-[Geist] border transition-colors ${
              programme === type
                ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
                : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'}`}>
            {label}
          </button>
        ))}
      </div>

      {opps.length === 0 ? (
        <div className="fi-card py-8 text-center text-[#8a7a6a] font-[Geist]">
          No {programme} opportunities with place products in the current year.
        </div>
      ) : (
        <>
          {/* ── Places-by-stage KPI tiles ───────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stageTotals.map(({ stage, places }) => (
              <div key={stage} className="fi-card">
                <p className="text-sm font-medium text-[#212122] font-[Geist]">{stage}</p>
                <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'Inria Serif, serif', color: STAGE_COLOURS[stage] ?? '#212122' }}>
                  {fmtPlaces(places)}
                </p>
                <p className="text-xs text-[#8a7a6a] font-[Geist]">places</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* ── Places by stage, stacked by sector ──────────────────────────── */}
            <div className="fi-card">
              <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
                Places by Stage
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
                  <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />
                  {PLACE_BUCKETS.map(b => (
                    <Bar key={b} dataKey={b} stackId="a" name={b === 'Free' ? 'Bursary' : b}
                      fill={SECTOR_COLOURS[b]} maxBarSize={48} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Sector split ────────────────────────────────────────────────── */}
            <div className="fi-card">
              <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
                Sector Split <span className="text-sm font-normal text-[#8a7a6a]">· {fmtPlaces(totalPlaces)} places</span>
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorSplit} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="bucket" tick={{ fontSize: 12, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={64}
                    tickFormatter={(v) => (v === 'Free' ? 'Bursary' : v)} />
                  <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
                  <Bar dataKey="places" name="Places" radius={[0, 4, 4, 0]} maxBarSize={36}>
                    {sectorSplit.map(d => <Cell key={d.bucket} fill={SECTOR_COLOURS[d.bucket]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Price per place: list vs actual ──────────────────────────────── */}
          <div className="fi-card">
            <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
              Price per Place <span className="text-sm font-normal text-[#8a7a6a]">· list vs achieved, by sector</span>
            </h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={priceBySector} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
                <XAxis dataKey="sector" tick={{ fontSize: 12, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmtMoney} tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f5ebe0' }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />
                <Bar dataKey="List" name="List price" fill="#e3c9bd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Actual" name="Achieved" fill="#195e47" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Per-opportunity table, price/place descending ────────────────── */}
          <div className="fi-card">
            <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
              Opportunities <span className="text-sm font-normal text-[#8a7a6a]">· by price per place</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-[Geist]">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wider text-[#8a7a6a] border-b border-[#e8ddd0]">
                    <th className="py-2 pr-4">Opportunity</th>
                    <th className="py-2 pr-4 hidden sm:table-cell">Sector</th>
                    <th className="py-2 pr-4 hidden sm:table-cell">Stage</th>
                    <th className="py-2 pr-4 text-right">Places</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 text-right">£ / place</th>
                  </tr>
                </thead>
                <tbody>
                  {oppRows.map(r => (
                    <tr key={r.id} className="border-b border-[#f0e6d8]">
                      <td className="py-2 pr-4 text-[#212122]">
                        <div className="truncate max-w-[220px]">{r.name}</div>
                        <div className="text-xs text-[#8a7a6a] truncate max-w-[220px]">{r.org}</div>
                      </td>
                      <td className="py-2 pr-4 hidden sm:table-cell text-[#8a7a6a]">{r.sector}</td>
                      <td className="py-2 pr-4 hidden sm:table-cell">
                        <span className="text-xs px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: (STAGE_COLOURS[r.stage] ?? '#8a7a6a') + '22', color: STAGE_COLOURS[r.stage] ?? '#8a7a6a' }}>
                          {r.stage}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right text-[#212122]">{fmtPlaces(r.places)}</td>
                      <td className="py-2 pr-4 text-right text-[#8a7a6a]">{fmtMoneyFull(r.amount)}</td>
                      <td className="py-2 text-right font-medium text-[#212122]">{fmtMoneyFull(r.pricePerPlace)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
