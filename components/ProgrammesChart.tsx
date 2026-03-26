'use client';

import { useMemo, useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { MonthlyData, ProgrammeOpportunity, ProgrammesData, ProgrammeType } from '@/types';

// Pure helper — duplicated here to avoid importing a server-side module into a client component
function getProgrammeType(name: string): Exclude<ProgrammeType, 'all'> {
  const n = name.toLowerCase();
  if (n.includes('fellowship')) return 'fellowship';
  if (n.includes('exchange'))   return 'exchange';
  if (n.includes('leading through disruption') || n.includes('disruption')) return 'ltd';
  return 'other';
}

interface Props {
  data: ProgrammesData;
}

type BarType = 'confirmed' | 'expected' | 'pipeline';
type DrillTab = 'programmes' | 'organisations' | 'sectors';

interface Selection {
  monthDate: string;
  barType: BarType;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fullMonthLabel(monthDate: string): string {
  const d = new Date(monthDate.slice(0, 7) + '-15');
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);

const fmtPlaces = (n: number) =>
  `${Math.round(n).toLocaleString('en-GB')} place${Math.round(n) === 1 ? '' : 's'}`;

const SECTOR_COLOURS: Record<string, string> = {
  'Private': '#195e47',
  'Public':  '#85d1e3',
  'Social':  '#ffcc12',
};
function sectorColour(s: string) { return SECTOR_COLOURS[s] ?? '#8a7a6a'; }

function oppSector(opp: ProgrammeOpportunity) { return opp.Organisation_Sector__c || 'Unknown'; }
function oppOrg(opp: ProgrammeOpportunity)    { return opp.Account?.Name || 'Unknown Organisation'; }
function oppProgramme(opp: ProgrammeOpportunity) { return opp.Programme__r?.Name || 'Unknown Programme'; }

const TYPE_LABELS: Record<ProgrammeType, string> = {
  all:        'All',
  fellowship: 'Fellowship',
  exchange:   'Exchange',
  ltd:        'LtD',
  other:      'Other',
};

const BAR_LABELS: Record<BarType, string> = {
  confirmed: 'Confirmed',
  expected:  'Expected',
  pipeline:  'Pipeline',
};

const BAR_COLOURS: Record<BarType, string> = {
  confirmed: '#195e47',
  expected:  '#85d1e3',
  pipeline:  '#ffcc12',
};

// ── Tooltip ──────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const monthDate: string | undefined = payload[0]?.payload?.monthDate;
  const displayLabel = monthDate ? fullMonthLabel(monthDate) : label;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{displayLabel}</p>
      {payload.map((p: any) =>
        p.value !== null && p.value !== 0 && (
          <p key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.fill ?? p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmtFull(p.value)}</span>
          </p>
        )
      )}
      <p className="text-[#8a7a6a] text-xs mt-2">Click a bar to drill down</p>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

export default function ProgrammesChart({ data }: Props) {
  const { opportunities, opportunitiesLY, targetsByType } = data;

  const [activeType, setActiveType]     = useState<ProgrammeType>('all');
  const [selection, setSelection]       = useState<Selection | null>(null);
  const [drillTab, setDrillTab]         = useState<DrillTab>('programmes');
  const [showLY, setShowLY]             = useState(false);
  const [showFullYear, setShowFullYear] = useState(false);
  const [fyTab, setFyTab]               = useState<DrillTab>('programmes');
  const [fyBarType, setFyBarType]       = useState<BarType>('confirmed');

  // ── Filtered opps ──────────────────────────────────────────────────────────

  const filteredOpps = useMemo(() =>
    activeType === 'all'
      ? opportunities
      : opportunities.filter(o => getProgrammeType(o.Programme__r?.Name ?? '') === activeType),
    [activeType, opportunities]
  );

  const filteredOppsLY = useMemo(() =>
    activeType === 'all'
      ? opportunitiesLY
      : opportunitiesLY.filter(o => getProgrammeType(o.Programme__r?.Name ?? '') === activeType),
    [activeType, opportunitiesLY]
  );

  // ── Recomputed monthly data for active filter ───────────────────────────────

  const activeMonths: MonthlyData[] = useMemo(() => {
    if (activeType === 'all') return data.months;

    return data.months.map(month => {
      const key = month.monthDate.slice(0, 7); // "2026-03"
      let confirmed = 0, expected = 0, potential = 0, confirmedLY = 0;

      for (const opp of filteredOpps) {
        if (!opp.CloseDate || opp.CloseDate.slice(0, 7) !== key) continue;
        const amount = opp.Amount ?? 0;
        if (opp.StageName === 'Confirmed') {
          confirmed += amount;
        } else {
          const prob = (opp.Probability ?? 0) / 100;
          expected  += amount * prob;
          potential += amount * (1 - prob);
        }
      }

      // LY: same calendar month, one year prior
      const lyKey = `${parseInt(key.slice(0, 4)) - 1}-${key.slice(5, 7)}`;
      for (const opp of filteredOppsLY) {
        if (!opp.CloseDate || opp.CloseDate.slice(0, 7) !== lyKey) continue;
        confirmedLY += opp.Amount ?? 0;
      }

      return {
        ...month,
        confirmed,
        expected,
        potential,
        confirmedLY,
        target: targetsByType[activeType]?.[month.monthDate] ?? 0,
      };
    });
  }, [activeType, filteredOpps, filteredOppsLY, data.months, targetsByType]);

  // ── YTD aggregates ─────────────────────────────────────────────────────────

  const ytdMonths    = activeMonths.filter(m => m.isPast);
  const ytdConfirmed = ytdMonths.reduce((s, m) => s + m.confirmed, 0);
  const ytdTarget    = ytdMonths.reduce((s, m) => s + m.target,    0);
  const variance     = ytdConfirmed - ytdTarget;

  const ytdMonthKeys = new Set(ytdMonths.map(m => m.monthDate.slice(0, 7)));
  const ytdPlaces = filteredOpps
    .filter(o => o.StageName === 'Confirmed' && o.CloseDate && ytdMonthKeys.has(o.CloseDate.slice(0, 7)))
    .reduce((s, o) => s + (o.Total_Places__c ?? 0), 0);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const chartData = activeMonths.map(d => ({
    ...d,
    confirmedBar: d.confirmed,
    expectedBar:  (!d.isPast || d.isCurrentMonth) ? d.expected  : 0,
    pipelineBar:  (!d.isPast || d.isCurrentMonth) ? d.potential : 0,
  }));

  // ── Month drill-down opps ─────────────────────────────────────────────────

  const monthOpps = useMemo(() => {
    if (!selection) return [];
    const key = selection.monthDate.slice(0, 7);
    const active = filteredOpps.filter(o => o.CloseDate?.slice(0, 7) === key);

    if (selection.barType === 'confirmed') {
      return active
        .filter(o => o.StageName === 'Confirmed')
        .map(o => ({ opp: o, slice: o.Amount ?? 0, places: o.Total_Places__c ?? 0 }))
        .sort((a, b) => b.slice - a.slice);
    }
    return active
      .filter(o => o.StageName !== 'Confirmed' && o.StageName !== 'Opportunity lost')
      .map(o => {
        const amount = o.Amount ?? 0;
        const prob   = (o.Probability ?? 0) / 100;
        const slice  = selection.barType === 'expected' ? amount * prob : amount * (1 - prob);
        const places = (o.Total_Places__c ?? 0) * (selection.barType === 'expected' ? prob : 1 - prob);
        return { opp: o, slice, places };
      })
      .filter(({ slice }) => slice > 0)
      .sort((a, b) => b.slice - a.slice);
  }, [selection, filteredOpps]);

  // ── Full year opps ─────────────────────────────────────────────────────────

  const fyOpps = useMemo(() => {
    const fyKeys = new Set(data.months.map(m => m.monthDate.slice(0, 7)));
    if (fyBarType === 'confirmed') {
      return filteredOpps
        .filter(o => o.StageName === 'Confirmed' && o.CloseDate && fyKeys.has(o.CloseDate.slice(0, 7)))
        .map(o => ({ opp: o, slice: o.Amount ?? 0, places: o.Total_Places__c ?? 0 }))
        .sort((a, b) => b.slice - a.slice);
    }
    return filteredOpps
      .filter(o => o.StageName !== 'Confirmed' && o.StageName !== 'Opportunity lost' && o.CloseDate && fyKeys.has(o.CloseDate.slice(0, 7)))
      .map(o => {
        const amount = o.Amount ?? 0;
        const prob   = (o.Probability ?? 0) / 100;
        const slice  = fyBarType === 'expected' ? amount * prob : amount * (1 - prob);
        const places = (o.Total_Places__c ?? 0) * (fyBarType === 'expected' ? prob : 1 - prob);
        return { opp: o, slice, places };
      })
      .filter(({ slice }) => slice > 0)
      .sort((a, b) => b.slice - a.slice);
  }, [fyBarType, filteredOpps, data.months]);

  // ── Grouping helpers ────────────────────────────────────────────────────────

  type OppItem = { opp: ProgrammeOpportunity; slice: number; places: number };

  function groupByOrg(items: OppItem[]) {
    const acc: Record<string, { total: number; totalPlaces: number; items: OppItem[] }> = {};
    for (const item of items) {
      const k = oppOrg(item.opp);
      if (!acc[k]) acc[k] = { total: 0, totalPlaces: 0, items: [] };
      acc[k].total       += item.slice;
      acc[k].totalPlaces += item.places;
      acc[k].items.push(item);
    }
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total);
  }

  function groupByProgramme(items: OppItem[]) {
    const acc: Record<string, { total: number; totalPlaces: number; items: OppItem[] }> = {};
    for (const item of items) {
      const k = oppProgramme(item.opp);
      if (!acc[k]) acc[k] = { total: 0, totalPlaces: 0, items: [] };
      acc[k].total       += item.slice;
      acc[k].totalPlaces += item.places;
      acc[k].items.push(item);
    }
    return Object.entries(acc).sort((a, b) => b[1].total - a[1].total);
  }

  function groupBySector(items: OppItem[]) {
    const acc: Record<string, number> = {};
    for (const { opp, slice } of items) {
      const k = oppSector(opp);
      acc[k] = (acc[k] ?? 0) + slice;
    }
    const entries = Object.entries(acc).sort((a, b) => b[1] - a[1]);
    const total = entries.reduce((s, [, v]) => s + v, 0);
    return { entries, total };
  }

  // ── Click handlers ─────────────────────────────────────────────────────────

  const makeClickHandler = (barType: BarType) => (barData: any) => {
    if (!barData?.monthDate) return;
    setShowFullYear(false);
    setSelection(prev =>
      prev?.monthDate === barData.monthDate && prev?.barType === barType
        ? null : { monthDate: barData.monthDate, barType }
    );
    setDrillTab('programmes');
  };

  const isSelected = (monthDate: string) => selection?.monthDate === monthDate;

  // ── Shared drill-down list renderer ────────────────────────────────────────

  function DrillList({ items, tab, setTab }: {
    items: OppItem[];
    tab: DrillTab;
    setTab: (t: DrillTab) => void;
  }) {
    const orgEntries  = groupByOrg(items);
    const progEntries = groupByProgramme(items);
    const { entries: secEntries, total: secTotal } = groupBySector(items);
    const totalPlaces = items.reduce((s, i) => s + i.places, 0);

    return (
      <>
        {/* Tab toggle */}
        <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
          {(['programmes', 'organisations', 'sectors'] as DrillTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 capitalize ${tab === t ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}>
              By {t === 'programmes' ? 'Programme' : t === 'organisations' ? 'Organisation' : 'Sector'}
            </button>
          ))}
        </div>

        {/* By Programme */}
        {tab === 'programmes' && (
          <div className="space-y-3 mt-4">
            {progEntries.length === 0 && <p className="text-sm text-[#8a7a6a] font-[Geist]">No opportunities found.</p>}
            {progEntries.map(([prog, { total, totalPlaces: tp, items: progItems }]) => (
              <div key={prog} className="rounded-lg border border-[#e8ddd0] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5ebe0]">
                  <span className="font-medium text-sm text-[#212122] font-[Geist]">{prog}</span>
                  <div className="flex items-center gap-4 text-sm font-[Geist]">
                    {tp > 0 && <span className="text-[#8a7a6a] text-xs">{fmtPlaces(tp)}</span>}
                    <span className="font-bold text-[#212122]">{fmtFull(total)}</span>
                  </div>
                </div>
                {progItems.map(({ opp, slice, places }) => (
                  <div key={opp.Id}
                       className="flex items-center justify-between px-3 sm:px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#212122] truncate text-xs sm:text-sm">{opp.Name}</span>
                      {oppSector(opp) !== 'Unknown' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: sectorColour(oppSector(opp)) + '22', color: sectorColour(oppSector(opp)) }}>
                          {oppSector(opp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {places > 0 && (
                        <span className="text-xs text-[#8a7a6a] hidden sm:inline">{fmtPlaces(places)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        opp.StageName === 'Confirmed'
                          ? 'bg-[#e8f5f0] text-[#195e47]'
                          : 'bg-[#fff8e0] text-[#b8860b]'
                      }`}>
                        {opp.StageName === 'Confirmed' ? 'Confirmed' : `${opp.Probability ?? 0}%`}
                      </span>
                      <span className="font-medium text-[#212122]">{fmtFull(slice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* By Organisation */}
        {tab === 'organisations' && (
          <div className="space-y-3 mt-4">
            {orgEntries.length === 0 && <p className="text-sm text-[#8a7a6a] font-[Geist]">No opportunities found.</p>}
            {orgEntries.map(([org, { total, totalPlaces: tp, items: orgItems }]) => (
              <div key={org} className="rounded-lg border border-[#e8ddd0] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5ebe0]">
                  <span className="font-medium text-sm text-[#212122] font-[Geist]">{org}</span>
                  <div className="flex items-center gap-4 text-sm font-[Geist]">
                    {tp > 0 && <span className="text-[#8a7a6a] text-xs">{fmtPlaces(tp)}</span>}
                    <span className="font-bold text-[#212122]">{fmtFull(total)}</span>
                  </div>
                </div>
                {orgItems.map(({ opp, slice, places }) => (
                  <div key={opp.Id}
                       className="flex items-center justify-between px-3 sm:px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist] gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[#212122] truncate text-xs sm:text-sm">{opp.Name}</span>
                      {oppSector(opp) !== 'Unknown' && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: sectorColour(oppSector(opp)) + '22', color: sectorColour(oppSector(opp)) }}>
                          {oppSector(opp)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {places > 0 && (
                        <span className="text-xs text-[#8a7a6a] hidden sm:inline">{fmtPlaces(places)}</span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        opp.StageName === 'Confirmed'
                          ? 'bg-[#e8f5f0] text-[#195e47]'
                          : 'bg-[#fff8e0] text-[#b8860b]'
                      }`}>
                        {opp.StageName === 'Confirmed' ? 'Confirmed' : `${opp.Probability ?? 0}%`}
                      </span>
                      <span className="font-medium text-[#212122]">{fmtFull(slice)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* By Sector */}
        {tab === 'sectors' && (
          <div className="space-y-2 mt-4">
            {secEntries.length === 0 && <p className="text-sm text-[#8a7a6a] font-[Geist]">No sector data available.</p>}
            {secEntries.map(([sector, total]) => {
              const pct = secTotal > 0 ? (total / secTotal) * 100 : 0;
              return (
                <div key={sector}>
                  <div className="flex items-center justify-between mb-1 text-sm font-[Geist]">
                    <span className="font-medium text-[#212122]">{sector}</span>
                    <span className="text-[#8a7a6a]">{fmtFull(total)} · {Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#e8ddd0] overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                         style={{ width: `${pct}%`, backgroundColor: sectorColour(sector) }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const selectedMonthData = selection ? activeMonths.find(d => d.monthDate === selection.monthDate) : null;
  const monthTotal = monthOpps.reduce((s, { slice }) => s + slice, 0);
  const monthPlaces = monthOpps.reduce((s, { places }) => s + places, 0);

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── YTD Scorecards ──────────────────────────────────────────────────── */}
      <div className="fi-card">
        <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a] mb-3">
          {TYPE_LABELS[activeType] === 'All' ? 'Programmes' : TYPE_LABELS[activeType]} · Sales Year to Date
        </p>
        <div className="flex items-end gap-6 sm:gap-10 mb-4 flex-wrap">
          <div>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Confirmed</p>
            <p className="text-2xl sm:text-4xl font-bold text-[#212122]"
               style={{ fontFamily: 'Inria Serif, serif' }}>
              {fmtFull(ytdConfirmed)}
            </p>
          </div>
          <div>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Target</p>
            <p className="text-2xl sm:text-4xl font-bold text-[#212122]"
               style={{ fontFamily: 'Inria Serif, serif' }}>
              {fmtFull(ytdTarget)}
            </p>
          </div>
          {ytdPlaces > 0 && (
            <div>
              <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Places confirmed</p>
              <p className="text-2xl sm:text-4xl font-bold text-[#212122]"
                 style={{ fontFamily: 'Inria Serif, serif' }}>
                {Math.round(ytdPlaces).toLocaleString('en-GB')}
              </p>
            </div>
          )}
        </div>
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-[Geist] ${
          variance >= 0 ? 'bg-[#e8f5f0] text-[#195e47]' : 'bg-[#fdf0ec] text-[#dd6945]'
        }`}>
          <span>{variance >= 0 ? '▲' : '▼'}</span>
          <span>
            {variance >= 0 ? '+' : ''}{fmtFull(variance)}
            {' '}({variance >= 0 ? 'ahead' : 'behind'})
          </span>
          {ytdTarget > 0 && (
            <span className="opacity-70">
              · {Math.round((ytdConfirmed / ytdTarget) * 100)}% of target
            </span>
          )}
        </div>
      </div>

      {/* ── Chart card ──────────────────────────────────────────────────────── */}
      <div className="fi-card">

        {/* Header row: title + programme filter + legend/toggles */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="text-lg font-bold text-[#212122] shrink-0"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Monthly Sales vs Target
            </h2>
            {/* Legend + toggles */}
            <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs font-[Geist] text-[#8a7a6a]">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#195e47]" />Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#85d1e3]" />Expected
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#ffcc12]" />Pipeline
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-6 h-0.5 inline-block" style={{ borderTop: '2px dashed #dd6945' }} />Target
              </span>
              <button
                onClick={() => setShowLY(v => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                  showLY ? 'border-[#8a7a6a] bg-[#f5ebe0] text-[#212122]' : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
                }`}
              >
                <span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px dotted #8a7a6a' }} />
                Last year
              </button>
              <button
                onClick={() => { setShowFullYear(v => !v); setSelection(null); }}
                className={`px-2 py-1 rounded-md border transition-colors ${
                  showFullYear ? 'border-[#195e47] bg-[#195e47] text-[#fcf2e3]' : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
                }`}
              >
                Full year
              </button>
            </div>
          </div>

          {/* Programme type filter pills */}
          <div className="flex items-center flex-wrap gap-2">
            {(['all', 'fellowship', 'exchange', 'ltd', 'other'] as ProgrammeType[]).map(t => (
              <button key={t}
                onClick={() => { setActiveType(t); setSelection(null); setShowFullYear(false); }}
                className={`px-3 py-1 rounded-full text-xs font-[Geist] border transition-colors ${
                  activeType === t
                    ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
                    : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'
                }`}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        {/* Chart */}
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
            <XAxis dataKey="month"
              tick={{ fontSize: 12, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt}
              tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />

            <Bar dataKey="confirmedBar" name="Confirmed" maxBarSize={16} radius={[4,4,0,0]}
                 onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
              {chartData.map(e => (
                <Cell key={e.monthDate} fill="#195e47"
                  opacity={selection && !isSelected(e.monthDate) ? 0.3 : 1} />
              ))}
            </Bar>
            <Bar dataKey="expectedBar" name="Expected" maxBarSize={16} radius={[4,4,0,0]}
                 onClick={makeClickHandler('expected')} style={{ cursor: 'pointer' }}>
              {chartData.map(e => (
                <Cell key={e.monthDate} fill="#85d1e3"
                  opacity={selection && !isSelected(e.monthDate) ? 0.3 : 1} />
              ))}
            </Bar>
            <Bar dataKey="pipelineBar" name="Pipeline" maxBarSize={16} radius={[4,4,0,0]}
                 onClick={makeClickHandler('pipeline')} style={{ cursor: 'pointer' }}>
              {chartData.map(e => (
                <Cell key={e.monthDate} fill="#ffcc12"
                  opacity={selection && !isSelected(e.monthDate) ? 0.3 : 0.85} />
              ))}
            </Bar>

            <Line type="monotone" dataKey="target" name="Target"
              stroke="#dd6945" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }}
              strokeDasharray="6 3" />

            {showLY && (
              <Line type="monotone" dataKey="confirmedLY" name="Last year"
                stroke="#8a7a6a" strokeWidth={1.5}
                dot={false} strokeDasharray="3 3" />
            )}
          </ComposedChart>
        </ResponsiveContainer>

        {/* ── Month drill-down ──────────────────────────────────────────────── */}
        {selection && selectedMonthData && (
          <div className="mt-6 border-t border-[#e8ddd0] pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div>
                <h3 className="font-bold text-[#212122] text-base"
                    style={{ fontFamily: 'Inria Serif, serif' }}>
                  {fullMonthLabel(selectedMonthData.monthDate)} — {BAR_LABELS[selection.barType]}
                </h3>
                <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                  {fmtFull(monthTotal)}{' '}
                  {BAR_LABELS[selection.barType].toLowerCase()} income
                  {monthPlaces > 0 && ` · ${fmtPlaces(monthPlaces)}`}
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                {/* Bar type switcher */}
                <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                  {(['confirmed', 'expected', 'pipeline'] as BarType[]).map(bt => (
                    <button key={bt}
                      onClick={() => setSelection(s => s ? { ...s, barType: bt } : null)}
                      className="px-3 py-1.5 capitalize transition-colors"
                      style={
                        selection.barType === bt
                          ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'pipeline' ? '#212122' : '#fcf2e3' }
                          : { color: '#8a7a6a' }
                      }>
                      {BAR_LABELS[bt]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setSelection(null)}
                  className="text-[#8a7a6a] hover:text-[#212122] text-lg leading-none" aria-label="Close">×</button>
              </div>
            </div>
            <DrillList items={monthOpps} tab={drillTab} setTab={setDrillTab} />
          </div>
        )}

        {/* ── Full year panel ───────────────────────────────────────────────── */}
        {showFullYear && (
          <div className="mt-6 border-t border-[#e8ddd0] pt-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
              <div>
                <h3 className="font-bold text-[#212122] text-base"
                    style={{ fontFamily: 'Inria Serif, serif' }}>
                  Full year — {TYPE_LABELS[activeType]} · FY 2026/27
                </h3>
                <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                  {fmtFull(fyOpps.reduce((s, { slice }) => s + slice, 0))}{' '}
                  {BAR_LABELS[fyBarType].toLowerCase()} income
                  {fyOpps.reduce((s, { places }) => s + places, 0) > 0 &&
                    ` · ${fmtPlaces(fyOpps.reduce((s, { places }) => s + places, 0))}`}
                </p>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                  {(['confirmed', 'expected', 'pipeline'] as BarType[]).map(bt => (
                    <button key={bt} onClick={() => setFyBarType(bt)}
                      className="px-3 py-1.5 capitalize transition-colors"
                      style={
                        fyBarType === bt
                          ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'pipeline' ? '#212122' : '#fcf2e3' }
                          : { color: '#8a7a6a' }
                      }>
                      {BAR_LABELS[bt]}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowFullYear(false)}
                  className="text-[#8a7a6a] hover:text-[#212122] text-lg leading-none" aria-label="Close">×</button>
              </div>
            </div>
            <DrillList items={fyOpps} tab={fyTab} setTab={setFyTab} />
          </div>
        )}
      </div>
    </div>
  );
}
