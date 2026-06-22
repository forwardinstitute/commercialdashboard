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

// FY 2026/27 month scaffold (Jan 2026 – Feb 2027), matching the other pages.
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FY_MONTHS: { year: number; month: number }[] = [
  { year: 2026, month: 0 }, { year: 2026, month: 1 }, { year: 2026, month: 2 }, { year: 2026, month: 3 },
  { year: 2026, month: 4 }, { year: 2026, month: 5 }, { year: 2026, month: 6 }, { year: 2026, month: 7 },
  { year: 2026, month: 8 }, { year: 2026, month: 9 }, { year: 2026, month: 10 }, { year: 2026, month: 11 },
  { year: 2027, month: 0 }, { year: 2027, month: 1 },
];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const fmtMoneyFull = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const fmtPlaces = (n: number) => Math.round(n).toLocaleString('en-GB');
const fmtClose = (iso: string | null) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

function oppSector(o: ProgrammeOpportunity) { return o.Organisation_Sector__c || 'Unknown'; }
function lineItems(o: ProgrammeOpportunity) { return o.OpportunityLineItems?.records ?? []; }
function oppTotalPlaces(o: ProgrammeOpportunity) {
  return lineItems(o).reduce((s, li) =>
    productBucket(li.Product2?.ProductCode, li.Product2?.Name) ? s + (li.Quantity ?? 0) : s, 0);
}

const PlacesTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtPlaces(p.value)}</span>
        </p>
      ))}
      {payload.length > 1 && (
        <p className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#e8ddd0] text-[#212122]">
          <span>Total</span><span className="font-bold">{fmtPlaces(total)} places</span>
        </p>
      )}
    </div>
  );
};
// Price-per-place tooltip — shows the breakdown: X places · total £Y · £Z per place.
const PriceTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  const line = (label: string, colour: string, total: number, perPlace: number) => (
    <div className="mt-1">
      <p className="flex justify-between gap-4">
        <span style={{ color: colour }}>{label}</span>
        <span className="font-medium">{fmtMoneyFull(perPlace)} / place</span>
      </p>
      <p className="text-[#8a7a6a] text-xs">
        {fmtPlaces(d.qty)} place{d.qty === 1 ? '' : 's'} · {fmtMoneyFull(total)} total
      </p>
    </div>
  );
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[200px]">
      <p className="font-bold" style={{ fontFamily: 'Inria Serif, serif' }}>{d.sector}</p>
      {line('Achieved', '#195e47', d.actualTotal, d.Actual)}
      {line('List', '#b9a08f', d.listTotal, d.List)}
    </div>
  );
};

type SortKey = 'name' | 'org' | 'sector' | 'stage' | 'close' | 'places' | 'amount' | 'pricePerPlace';
interface Row {
  id: string; name: string; org: string; sector: string; stage: string;
  close: string | null; places: number; amount: number; pricePerPlace: number;
}

interface Props { opportunities: ProgrammeOpportunity[]; }

export default function ProgrammesPlacesView({ opportunities }: Props) {
  const [programme, setProgramme] = useState<Exclude<ProgrammeType, 'all' | 'other'>>('fellowship');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'pricePerPlace', dir: 'desc' });
  const [sectorStage, setSectorStage] = useState<string>('all'); // stage filter for the Sector Split card

  const opps = useMemo(
    () => opportunities.filter(o => getProgrammeType(o.Programme__r?.Name ?? '') === programme),
    [opportunities, programme]
  );

  // Stages present, ascending along the funnel.
  const stages = useMemo(
    () => Array.from(new Set(opps.map(o => o.StageName))).sort((a, b) => stageRank(a) - stageRank(b)),
    [opps]
  );

  // ── Places by close month, stacked by stage (the "when" view) ────────────────
  const monthData = useMemo(() =>
    FY_MONTHS.map(({ year, month }) => {
      const row: Record<string, number | string> = { month: MONTH_NAMES[month] };
      for (const stage of stages) row[stage] = 0;
      for (const o of opps) {
        if (!o.CloseDate) continue;
        const d = new Date(o.CloseDate + 'T12:00:00');
        if (d.getFullYear() !== year || d.getMonth() !== month) continue;
        row[o.StageName] = (row[o.StageName] as number) + oppTotalPlaces(o);
      }
      return row;
    }),
    [opps, stages]
  );

  // ── Places per stage (KPI tiles + funnel bar) ────────────────────────────────
  const stageTotals = useMemo(() =>
    stages.map(stage => ({
      stage,
      places: opps.filter(o => o.StageName === stage).reduce((s, o) => s + oppTotalPlaces(o), 0),
    })),
    [opps, stages]
  );

  // ── Sector split ──────────────────────────────────────────────────────────────
  const sectorSplit = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const o of opps) {
      if (sectorStage !== 'all' && o.StageName !== sectorStage) continue;
      for (const li of lineItems(o)) {
        const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
        if (!bucket) continue;
        acc[bucket] = (acc[bucket] ?? 0) + (li.Quantity ?? 0);
      }
    }
    return PLACE_BUCKETS.map(b => ({ bucket: b, places: acc[b] ?? 0 })).filter(d => d.places > 0);
  }, [opps, sectorStage]);

  // ── Price per place: list vs achieved, per paid sector ───────────────────────
  const priceBySector = useMemo(() => {
    const acc: Record<string, { qty: number; actual: number; list: number }> = {};
    for (const o of opps) for (const li of lineItems(o)) {
      const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
      if (!bucket) continue;
      const qty = li.Quantity ?? 0;
      acc[bucket] ??= { qty: 0, actual: 0, list: 0 };
      acc[bucket].qty += qty;
      acc[bucket].actual += (li.UnitPrice ?? 0) * qty;
      acc[bucket].list += (li.ListPrice ?? 0) * qty;
    }
    return PAID_SECTORS.filter(b => acc[b]?.qty).map(b => ({
      sector: b,
      qty: acc[b].qty,
      List: acc[b].list / acc[b].qty,       // list price per place
      Actual: acc[b].actual / acc[b].qty,   // achieved price per place
      listTotal: acc[b].list,
      actualTotal: acc[b].actual,
    }));
  }, [opps]);

  // ── Per-opportunity rows, sortable ───────────────────────────────────────────
  const rows = useMemo<Row[]>(() =>
    opps.map(o => {
      const places = oppTotalPlaces(o);
      return {
        id: o.Id, name: o.Name, org: o.Account?.Name ?? '—', sector: oppSector(o),
        stage: o.StageName, close: o.CloseDate, places, amount: o.Amount ?? 0,
        pricePerPlace: places > 0 ? (o.Amount ?? 0) / places : 0,
      };
    }).filter(r => r.places > 0),
    [opps]
  );

  const sortedRows = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const val = (r: Row): string | number => {
      switch (sort.key) {
        case 'stage': return stageRank(r.stage);
        case 'close': return r.close ?? '';
        case 'name': return r.name.toLowerCase();
        case 'org': return r.org.toLowerCase();
        case 'sector': return r.sector.toLowerCase();
        default: return r[sort.key] as number;
      }
    };
    return [...rows].sort((a, b) => {
      const va = val(a), vb = val(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
  }, [rows, sort]);

  const toggleSort = (key: SortKey) =>
    setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });

  const totalPlaces = sectorSplit.reduce((s, d) => s + d.places, 0);
  // Stack order: Confirmed at the base, up through the funnel.
  const stackStages = [...stages].reverse();

  const Th = ({ k, label, align = 'left' }: { k: SortKey; label: string; align?: 'left' | 'right' }) => (
    <th className={`py-2 pr-4 select-none cursor-pointer hover:text-[#212122] ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => toggleSort(k)}>
      {label}<span className="ml-1 text-[10px]">{sort.key === k ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
    </th>
  );

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
          {/* ── Places by close date (when places land), stacked by stage ───── */}
          <div className="fi-card">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
              <h2 className="text-lg font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
                Places by Close Date
              </h2>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 text-xs font-[Geist] text-[#8a7a6a]">
                {stackStages.map(s => (
                  <span key={s} className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-sm inline-block" style={{ background: STAGE_COLOURS[s] ?? '#8a7a6a' }} />{s}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={monthData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
                {stackStages.map(stage => (
                  <Bar key={stage} dataKey={stage} stackId="a" fill={STAGE_COLOURS[stage] ?? '#8a7a6a'} maxBarSize={28}
                    radius={stage === stackStages[stackStages.length - 1] ? [4, 4, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>

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
            {/* ── Places by stage (funnel snapshot) ───────────────────────────── */}
            <div className="fi-card">
              <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
                Places by Stage
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stageTotals} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
                  <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                  <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
                  <Bar dataKey="places" name="Places" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {stageTotals.map(d => <Cell key={d.stage} fill={STAGE_COLOURS[d.stage] ?? '#8a7a6a'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Sector split ────────────────────────────────────────────────── */}
            <div className="fi-card">
              <h2 className="text-lg font-bold text-[#212122] mb-3" style={{ fontFamily: 'Inria Serif, serif' }}>
                Sector Split <span className="text-sm font-normal text-[#8a7a6a]">· {fmtPlaces(totalPlaces)} places</span>
              </h2>
              {/* Stage filter — All shows the full pipeline, or drill to a single stage */}
              <div className="flex items-center flex-wrap gap-1.5 mb-4">
                {(['all', ...stages] as string[]).map(s => (
                  <button key={s} onClick={() => setSectorStage(s)}
                    className={`px-2.5 py-0.5 rounded-full text-xs font-[Geist] border transition-colors ${
                      sectorStage === s
                        ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
                        : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'}`}>
                    {s === 'all' ? 'All' : s}
                  </button>
                ))}
              </div>
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
                <Tooltip content={<PriceTooltip />} cursor={{ fill: '#f5ebe0' }} />
                <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />
                <Bar dataKey="List" name="List price" fill="#e3c9bd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Actual" name="Achieved" fill="#195e47" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ── Per-opportunity table, sortable on every column ──────────────── */}
          <div className="fi-card">
            <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
              Opportunities <span className="text-sm font-normal text-[#8a7a6a]">· click any column to sort</span>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-[Geist]">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-[#8a7a6a] border-b border-[#e8ddd0]">
                    <Th k="name" label="Opportunity" />
                    <Th k="sector" label="Sector" />
                    <Th k="stage" label="Stage" />
                    <Th k="close" label="Close" />
                    <Th k="places" label="Places" align="right" />
                    <Th k="amount" label="Amount" align="right" />
                    <Th k="pricePerPlace" label="£ / place" align="right" />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map(r => (
                    <tr key={r.id} className="border-b border-[#f0e6d8]">
                      <td className="py-2 pr-4 text-[#212122]">
                        <div className="truncate max-w-[220px]">{r.name}</div>
                        <div className="text-xs text-[#8a7a6a] truncate max-w-[220px]">{r.org}</div>
                      </td>
                      <td className="py-2 pr-4 text-[#8a7a6a]">{r.sector}</td>
                      <td className="py-2 pr-4">
                        <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap"
                          style={{ backgroundColor: (STAGE_COLOURS[r.stage] ?? '#8a7a6a') + '22', color: STAGE_COLOURS[r.stage] ?? '#8a7a6a' }}>
                          {r.stage}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-[#8a7a6a] whitespace-nowrap">{fmtClose(r.close)}</td>
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
