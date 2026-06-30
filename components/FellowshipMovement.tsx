'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import type { FellowshipMovementRow } from '@/lib/snapshots';
import { SECTOR_COLOURS } from '@/lib/places';

const SECTORS = ['Private', 'Public', 'Social'] as const;

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);
const fmtDelta = (n: number) => (n >= 0 ? '+' : '−') + fmtFull(Math.abs(n));

// Monday (ISO week start) of the week containing `iso`.
function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const day = d.getDay();                    // 0 Sun … 6 Sat
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
function label(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

interface WeekPoint {
  weekStart: string;
  date: string;                        // representative (latest) snapshot in the week
  weighted: number;
  confirmed: number;
  gross: number;
  bySector: Record<string, number>;    // weighted per sector
}

const MoneyTooltip = ({ active, payload, label: lbl }: any) => {
  if (!active || !payload?.length) return null;
  const title = payload[0]?.payload?.periodLabel ?? lbl;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{title}</p>
      {payload.filter((p: any) => p.value != null).map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4 mb-0.5">
          <span style={{ color: p.color ?? p.stroke ?? p.fill }}>{p.name}</span>
          <span className="font-medium">{fmtFull(p.value)}</span>
        </p>
      ))}
    </div>
  );
};

export default function FellowshipMovement({ rows, liveWeighted }: { rows: FellowshipMovementRow[]; liveWeighted?: number | null }) {
  const [cadence, setCadence] = useState<'weekly' | 'fortnightly' | 'monthly'>('weekly');
  const [mode, setMode] = useState<'total' | 'sector'>('total');
  const [showGross, setShowGross] = useState(false);

  // ── One aggregated point per snapshot date ───────────────────────────────────
  const daily = useMemo<WeekPoint[]>(() => {
    const byDate = new Map<string, WeekPoint>();
    for (const r of rows) {
      let p = byDate.get(r.snapshot_date);
      if (!p) {
        p = { weekStart: mondayOf(r.snapshot_date), date: r.snapshot_date, weighted: 0, confirmed: 0, gross: 0, bySector: {} };
        byDate.set(r.snapshot_date, p);
      }
      p.weighted += r.weighted;
      p.confirmed += r.confirmed;
      p.gross += r.gross;
      p.bySector[r.sector] = (p.bySector[r.sector] ?? 0) + r.weighted;
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [rows]);

  // Roll up to the latest snapshot per period (daily is ascending → last write wins).
  const weeks = useMemo(() => {
    const m = new Map<string, WeekPoint>();
    for (const p of daily) m.set(p.weekStart, p);
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [daily]);
  const months = useMemo(() => {
    const m = new Map<string, WeekPoint>();
    for (const p of daily) m.set(p.date.slice(0, 7), p); // YYYY-MM
    return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [daily]);

  const points = useMemo(() => {
    if (cadence === 'monthly') return months;
    if (cadence === 'fortnightly') return weeks.filter((_, i) => (weeks.length - 1 - i) % 2 === 0);
    return weeks;
  }, [weeks, months, cadence]);

  const monthShort = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  const monthLong  = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const chartData = points.map(p => ({
    label: cadence === 'monthly' ? monthShort(p.date) : label(p.weekStart),
    periodLabel: cadence === 'monthly' ? monthLong(p.date) : `w/c ${label(p.weekStart)}`,
    Weighted: Math.round(p.weighted),
    Confirmed: Math.round(p.confirmed),
    Gross: Math.round(p.gross),
    ...Object.fromEntries(SECTORS.map(s => [s, Math.round(p.bySector[s] ?? 0)])),
  }));

  // ── Headline deltas ────────────────────────────────────────────────────────────
  const latest = weeks[weeks.length - 1];
  const prev = weeks[weeks.length - 2];
  const twoAgo = weeks[weeks.length - 3];
  const deltaWeek = latest && prev ? latest.weighted - prev.weighted : 0;
  const delta2wk = latest && twoAgo ? latest.weighted - twoAgo.weighted : 0;

  // Mon → latest within the current week (Sophie's "Mon → Fri" shift)
  const monFri = useMemo(() => {
    if (!latest) return null;
    const wk = latest.weekStart;
    const inWeek = [...new Set(rows.filter(r => mondayOf(r.snapshot_date) === wk).map(r => r.snapshot_date))].sort();
    if (inWeek.length < 2) return null;
    const sumW = (d: string) => rows.filter(r => r.snapshot_date === d).reduce((s, r) => s + r.weighted, 0);
    return { from: inWeek[0], to: inWeek[inWeek.length - 1], delta: sumW(inWeek[inWeek.length - 1]) - sumW(inWeek[0]) };
  }, [rows, latest]);

  if (!rows.length || !latest) {
    return (
      <div className="fi-card py-8 text-center text-[#8a7a6a] font-[Geist]">
        No Fellowship pipeline history yet — the daily snapshot builds this over time.
      </div>
    );
  }

  // Today's point is the morning snapshot, so it's still provisional vs the live tab.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isProvisional = latest.date === todayIso;
  const asOf = new Date(latest.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  const Stat = ({ title, value, delta }: { title: string; value: string; delta?: number }) => (
    <div className="fi-card">
      <p className="text-sm font-medium text-[#212122] font-[Geist]">{title}</p>
      <p className="text-3xl font-bold mt-1" style={{ fontFamily: 'Inria Serif, serif' }}>{value}</p>
      {delta !== undefined && (
        <p className={`text-sm font-[Geist] mt-0.5 ${delta >= 0 ? 'fi-ahead' : 'fi-behind'}`}>
          {delta >= 0 ? '▲' : '▼'} {fmtDelta(delta)}
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ── Headline ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat title="Weighted pipeline" value={fmtFull(latest.weighted)} />
        <Stat title="Shift this week" value={fmtDelta(deltaWeek)} delta={deltaWeek} />
        <Stat title="Shift vs 2 weeks ago" value={fmtDelta(delta2wk)} delta={delta2wk} />
        <Stat title="Confirmed" value={fmtFull(latest.confirmed)} />
      </div>

      <p className="text-xs text-[#8a7a6a] font-[Geist] flex items-center gap-2 flex-wrap -mt-1">
        {isProvisional && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#fff8e0] text-[#b8860b] font-medium">⏳ Pending</span>
        )}
        <span>
          As of {asOf} (this morning’s snapshot).
          {isProvisional && liveWeighted != null && (
            <> Live now: <span className="font-medium text-[#212122]">{fmtFull(liveWeighted)}</span>
              {' '}(<span className={liveWeighted - latest.weighted >= 0 ? 'fi-ahead' : 'fi-behind'}>{fmtDelta(liveWeighted - latest.weighted)} pending</span>).</>
          )}
          {isProvisional && ' Settles after tomorrow’s snapshot.'}
        </span>
      </p>

      {monFri && (
        <div className={`fi-card flex items-center gap-3 ${monFri.delta >= 0 ? 'border-l-4 border-[#195e47]' : 'border-l-4 border-[#dd6945]'}`}>
          <span className={`text-xl ${monFri.delta >= 0 ? 'fi-ahead' : 'fi-behind'}`}>{monFri.delta >= 0 ? '▲' : '▼'}</span>
          <p className="text-sm font-[Geist] text-[#212122]">
            <span className="font-medium">{fmtDelta(monFri.delta)}</span> in weighted pipeline this week
            <span className="text-[#8a7a6a]"> ({label(monFri.from)} → {label(monFri.to)})</span>
            {latest.confirmed === (prev?.confirmed ?? latest.confirmed) && monFri.delta > 0 && (
              <span className="text-[#8a7a6a]"> — moving even without new confirmed sales</span>
            )}
          </p>
        </div>
      )}

      {/* ── Chart ────────────────────────────────────────────────────────────── */}
      <div className="fi-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
            Weighted Pipeline Movement
          </h2>
          <div className="flex items-center flex-wrap gap-2 text-xs font-[Geist]">
            {/* cadence */}
            <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden">
              {(['weekly', 'fortnightly', 'monthly'] as const).map(c => (
                <button key={c} onClick={() => setCadence(c)} className={`px-3 py-1.5 capitalize ${cadence === c ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}>{c}</button>
              ))}
            </div>
            {/* total vs sector */}
            <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden">
              {(['total', 'sector'] as const).map(m => (
                <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 capitalize ${mode === m ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}>{m === 'sector' ? 'By sector' : 'Total'}</button>
              ))}
            </div>
            {mode === 'total' && (
              <button onClick={() => setShowGross(v => !v)} className={`px-2 py-1 rounded-md border transition-colors ${showGross ? 'border-[#8a7a6a] bg-[#f5ebe0] text-[#212122]' : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}>Gross</button>
            )}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={340}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="l" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#8a7a6a' }} axisLine={false} tickLine={false} width={56} />
            {showGross && mode === 'total' && (
              <YAxis yAxisId="r" orientation="right" tickFormatter={fmt} tick={{ fontSize: 11, fill: '#b0a090' }} axisLine={false} tickLine={false} width={56} />
            )}
            <Tooltip content={<MoneyTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }} />

            {/* recharts must see Area/Line as direct children — no Fragment wrapper */}
            {mode === 'total' && (
              <Area yAxisId="l" type="monotone" dataKey="Weighted" name="Weighted pipeline"
                stroke="#195e47" strokeWidth={2.5} fill="#195e47" fillOpacity={0.12}
                dot={{ r: 3, fill: '#195e47', strokeWidth: 0 }} />
            )}
            {mode === 'total' && (
              <Line yAxisId="l" type="monotone" dataKey="Confirmed" name="Confirmed"
                stroke="#85d1e3" strokeWidth={2} dot={false} />
            )}
            {mode === 'total' && showGross && (
              <Line yAxisId="r" type="monotone" dataKey="Gross" name="Gross (open + confirmed)"
                stroke="#b0a090" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            )}
            {mode === 'sector' && SECTORS.map(s => (
              <Area key={s} yAxisId="l" type="monotone" dataKey={s} name={s} stackId="sec"
                stroke={SECTOR_COLOURS[s]} fill={SECTOR_COLOURS[s]} fillOpacity={0.55} strokeWidth={1.5} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-xs text-[#8a7a6a] font-[Geist] mt-2">
          Weighted = Σ (amount × probability), Confirmed counted at 100%. One point per {cadence === 'weekly' ? 'week' : cadence === 'fortnightly' ? 'fortnight' : 'month'}, from the daily snapshot.
        </p>
      </div>
    </div>
  );
}
