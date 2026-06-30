'use client';

import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';
import { FellowshipData, FellowshipOpportunity, FellowshipRelationship } from '@/types';
import { PLACE_BUCKETS, productBucket, SECTOR_COLOURS } from '@/lib/places';

// ─── Assumptions you can flip in one line ───────────────────────────────────────
// These two KPI definitions were not yet confirmed — defaults chosen to match the
// magnitudes in the Salesforce dashboard. Change here if the desired logic differs.
//
// "Pipeline without Possible" = pipeline minus the 'Possible' stage, which is
// essentially the leads layer (early new-business). Possible is still counted in
// Pipeline Total and shown in every other chart — this tile just answers
// "how much pipeline do we have beyond raw leads?".
const PIPELINE_EXCLUDE_STAGES = ['Possible'];
//
// "Predicted" = probability-weighted forecast: Σ(Amount × Probability%).
// If instead each stage carries a FIXED weight, fill this in and the code below
// will prefer it over the per-opp Probability.
const FIXED_STAGE_WEIGHTS: Record<string, number> | null = null;
// e.g. { Hopeful: 0.25, Possible: 0.5, Expecting: 0.9, Confirmed: 1 }
// ────────────────────────────────────────────────────────────────────────────────

const STAGE_ORDER = ['Hopeful', 'Possible', 'Expecting', 'Confirmed'];

// Place buckets, colours and the product → bucket classifier are shared from
// lib/places so Fellowship/Programmes/Exchange/LtD all bucket identically.

const STAGE_COLOURS: Record<string, string> = {
  Hopeful: '#e3c9bd',
  Possible: '#dda06f',
  Expecting: '#85d1e3',
  Confirmed: '#195e47',
};
const RELATIONSHIP_LABELS: Record<FellowshipRelationship, string> = {
  'sent-last-year': 'Sent fellows last year',
  returning: 'Returning business',
  new: 'New business',
};
const RELATIONSHIP_COLOURS: Record<FellowshipRelationship, string> = {
  'sent-last-year': '#85d1e3',
  returning: '#195e47',
  new: '#ffcc12',
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1,
  }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Per-opp helpers ────────────────────────────────────────────────────────────
function oppSector(o: FellowshipOpportunity) { return o.Organisation_Sector__c || 'Unknown'; }
function oppOwner(o: FellowshipOpportunity) { return o.Account?.Owner?.Name || 'Unassigned'; }
function oppWeight(o: FellowshipOpportunity): number {
  if (FIXED_STAGE_WEIGHTS) return FIXED_STAGE_WEIGHTS[o.StageName] ?? 0;
  return (o.Probability ?? 0) / 100;
}
// Places on an opp, split by product bucket.
function oppPlaces(o: FellowshipOpportunity): Record<string, number> {
  const out: Record<string, number> = {};
  for (const li of o.OpportunityLineItems?.records ?? []) {
    const bucket = productBucket(li.Product2?.ProductCode, li.Product2?.Name);
    if (!bucket) continue;
    out[bucket] = (out[bucket] ?? 0) + (li.Quantity ?? 0);
  }
  return out;
}
function oppTotalPlaces(o: FellowshipOpportunity): number {
  return Object.values(oppPlaces(o)).reduce((s, v) => s + v, 0);
}

// ── Tooltip ────────────────────────────────────────────────────────────────────
const MoneyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
};
const PlacesTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[160px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.value).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{Math.round(p.value)} places</span>
        </p>
      ))}
    </div>
  );
};

// ── KPI tile ────────────────────────────────────────────────────────────────────
function Kpi({ label, sub, value, accent }: { label: string; sub?: string; value: string; accent?: string }) {
  return (
    <div className="fi-card flex flex-col justify-between gap-2">
      <div>
        <p className="text-sm font-medium text-[#212122] font-[Geist]">{label}</p>
        {sub && <p className="text-xs text-[#8a7a6a] font-[Geist]">{sub}</p>}
      </div>
      <p className="text-3xl sm:text-4xl font-bold" style={{ fontFamily: 'Inria Serif, serif', color: accent ?? '#212122' }}>
        {value}
      </p>
    </div>
  );
}

interface Props { data: FellowshipData; }

export default function FellowshipDashboard({ data }: Props) {
  const { opportunities, relationshipByAccount, yoy, cohortNumber, cohortYear } = data;

  const [sector, setSector] = useState<string>('All');
  const [owner, setOwner] = useState<string>('All');

  const sectorOptions = useMemo(
    () => ['All', ...Array.from(new Set(opportunities.map(oppSector))).sort()],
    [opportunities]
  );
  const ownerOptions = useMemo(
    () => ['All', ...Array.from(new Set(opportunities.map(oppOwner))).sort()],
    [opportunities]
  );

  const opps = useMemo(
    () => opportunities.filter(o =>
      (sector === 'All' || oppSector(o) === sector) &&
      (owner === 'All' || oppOwner(o) === owner)
    ),
    [opportunities, sector, owner]
  );

  // ── KPI totals ────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    let pipelineTotal = 0, pipelineExcl = 0, confirmed = 0, predicted = 0;
    for (const o of opps) {
      const amt = o.Amount ?? 0;
      pipelineTotal += amt;
      if (!PIPELINE_EXCLUDE_STAGES.includes(o.StageName)) pipelineExcl += amt;
      if (o.StageName === 'Confirmed') confirmed += amt;
      predicted += amt * oppWeight(o);
    }
    return { pipelineTotal, pipelineExcl, confirmed, predicted };
  }, [opps]);

  // ── Places by product bucket (potential = all live, confirmed = Confirmed only) ──
  const places = useMemo(() => {
    const potential: Record<string, number> = {};
    const confirmed: Record<string, number> = {};
    for (const o of opps) {
      const p = oppPlaces(o);
      for (const [b, q] of Object.entries(p)) {
        potential[b] = (potential[b] ?? 0) + q;
        if (o.StageName === 'Confirmed') confirmed[b] = (confirmed[b] ?? 0) + q;
      }
    }
    const sum = (r: Record<string, number>) => Object.values(r).reduce((s, v) => s + v, 0);
    return { potential, confirmed, totalPotential: sum(potential), totalConfirmed: sum(confirmed) };
  }, [opps]);

  // ── Pipeline by close month ─────────────────────────────────────────────────────
  const byCloseMonth = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const o of opps) {
      if (!o.CloseDate) continue;
      const key = o.CloseDate.slice(0, 7); // YYYY-MM
      acc[key] = (acc[key] ?? 0) + (o.Amount ?? 0);
    }
    return Object.entries(acc).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => ({
      label: new Date(key + '-15').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      value,
    }));
  }, [opps]);

  // ── Amount by stage ──────────────────────────────────────────────────────────────
  const byStage = useMemo(() =>
    STAGE_ORDER.map(stage => ({
      stage,
      value: opps.filter(o => o.StageName === stage).reduce((s, o) => s + (o.Amount ?? 0), 0),
    })).filter(d => d.value > 0),
    [opps]
  );

  // ── Sector places (product buckets) ────────────────────────────────────────────
  const sectorPlaces = useMemo(() =>
    PLACE_BUCKETS.map(b => ({ bucket: b, places: places.potential[b] ?? 0 })).filter(d => d.places > 0),
    [places]
  );

  // ── Business type: places by org sector, stacked by relationship ────────────────
  const businessType = useMemo(() => {
    const sectors = ['Private', 'Public', 'Social'];
    const acc: Record<string, Record<string, number>> = {};
    for (const s of sectors) acc[s] = {};
    for (const o of opps) {
      const s = oppSector(o);
      if (!acc[s]) continue;
      const rel = relationshipByAccount[o.Account?.Id ?? ''] ?? 'new';
      const label = RELATIONSHIP_LABELS[rel];
      acc[s][label] = (acc[s][label] ?? 0) + oppTotalPlaces(o);
    }
    return sectors.map(s => ({ sector: s, ...acc[s] }));
  }, [opps, relationshipByAccount]);

  // ── YoY chart data ───────────────────────────────────────────────────────────────
  const yoyData = useMemo(() =>
    MONTHS.map((m, i) => {
      const row: Record<string, number | string> = { month: m };
      for (const s of yoy) row[s.label] = s.monthly[i];
      return row;
    }),
    [yoy]
  );

  const fmtPlaces = (n: number) => Math.round(n).toLocaleString('en-GB');

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Filters ──────────────────────────────────────────────────────────── */}
      <div className="fi-card flex flex-col sm:flex-row gap-4">
        <label className="flex-1">
          <span className="block text-xs font-medium uppercase tracking-widest text-[#8a7a6a] font-[Geist] mb-1">Organisation – Sector</span>
          <select value={sector} onChange={e => setSector(e.target.value)}
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm font-[Geist] text-[#212122]">
            {sectorOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label className="flex-1">
          <span className="block text-xs font-medium uppercase tracking-widest text-[#8a7a6a] font-[Geist] mb-1">Partner Lead</span>
          <select value={owner} onChange={e => setOwner(e.target.value)}
            className="w-full rounded-lg border border-[#e8ddd0] bg-white px-3 py-2 text-sm font-[Geist] text-[#212122]">
            {ownerOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      {/* ── KPI tiles ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <Kpi label="Pipeline" sub="Total — all stages" value={fmt(kpis.pipelineTotal)} accent="#ffcc12" />
        <Kpi label="Pipeline" sub="Excl. Possible (leads)" value={fmt(kpis.pipelineExcl)} />
        <Kpi label="Confirmed" sub="Total" value={fmt(kpis.confirmed)} accent="#195e47" />
        <Kpi label="Predicted" sub="Probability-weighted" value={fmt(kpis.predicted)} accent="#85d1e3" />
        <Kpi label="Fellows" sub="Potential places" value={fmtPlaces(places.totalPotential)} />
        <Kpi label="Fellows" sub="Confirmed places" value={fmtPlaces(places.totalConfirmed)} accent="#195e47" />
      </div>

      {/* ── Sector places (product buckets) ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {PLACE_BUCKETS.map(b => (
          <div key={b} className="fi-card text-center">
            <p className="text-3xl font-bold" style={{ fontFamily: 'Inria Serif, serif', color: SECTOR_COLOURS[b] }}>
              {fmtPlaces(places.potential[b] ?? 0)}
            </p>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-1">{b === 'Free' ? 'Bursary (free)' : b}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* ── Pipeline by close date ────────────────────────────────────────────── */}
        <div className="fi-card">
          <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
            Pipeline by Close Date
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byCloseMonth} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f5ebe0' }} />
              <Bar dataKey="value" name="Pipeline" fill="#ffcc12" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Amount by stage ──────────────────────────────────────────────────── */}
        <div className="fi-card">
          <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
            Opportunity Stage
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={byStage} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
              <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: '#f5ebe0' }} />
              <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {byStage.map(d => <Cell key={d.stage} fill={STAGE_COLOURS[d.stage] ?? '#8a7a6a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Sector places bar ────────────────────────────────────────────────── */}
        <div className="fi-card">
          <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
            Cohort {cohortNumber} — Sector Places
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={sectorPlaces} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="bucket" tick={{ fontSize: 12, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
              <Bar dataKey="places" name="Places" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {sectorPlaces.map(d => <Cell key={d.bucket} fill={SECTOR_COLOURS[d.bucket] ?? '#8a7a6a'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ── Business type: relationship split ────────────────────────────────── */}
        <div className="fi-card">
          <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
            Business Type
          </h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={businessType} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="sector" tick={{ fontSize: 12, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
              <Tooltip content={<PlacesTooltip />} cursor={{ fill: '#f5ebe0' }} />
              <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />
              {(Object.keys(RELATIONSHIP_LABELS) as FellowshipRelationship[]).map(rel => (
                <Bar key={rel} dataKey={RELATIONSHIP_LABELS[rel]} stackId="a"
                  fill={RELATIONSHIP_COLOURS[rel]} maxBarSize={36} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Confirmed year-on-year ───────────────────────────────────────────────── */}
      <div className="fi-card">
        <h2 className="text-lg font-bold text-[#212122] mb-4" style={{ fontFamily: 'Inria Serif, serif' }}>
          Confirmed — Year on Year <span className="text-sm font-normal text-[#8a7a6a]">(cumulative by close date)</span>
        </h2>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={yoyData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<MoneyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />
            {yoy.map((s, i) => (
              <Line key={s.label} type="monotone" dataKey={s.label}
                stroke={['#195e47', '#85d1e3', '#ffcc12'][i % 3]}
                strokeWidth={i === yoy.length - 1 ? 2.5 : 1.5}
                dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
