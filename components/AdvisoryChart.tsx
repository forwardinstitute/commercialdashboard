'use client';

import { useState, useMemo } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AdvisoryOpportunity, AdvisoryOrder, MonthlyData } from '@/types';

interface Props {
  data: MonthlyData[];
  opportunities: AdvisoryOpportunity[];
  orders: AdvisoryOrder[];
  uninvoicedStarted: AdvisoryOpportunity[];
}

type BarType = 'confirmed' | 'expected' | 'possible';

interface Selection {
  monthDate: string;
  barType: BarType;
}

// Full month + year label from a monthDate string e.g. "2026-03-31" → "March 2026"
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const monthDate: string | undefined = payload[0]?.payload?.monthDate;
  const displayLabel = monthDate ? fullMonthLabel(monthDate) : label;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-bold mb-2 text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{displayLabel}</p>
      {payload.map((p: any) => (
        p.value !== null && p.value !== 0 && (
          <p key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.fill ?? p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmtFull(p.value)}</span>
          </p>
        )
      ))}
      <p className="text-[#8a7a6a] text-xs mt-2">Click a bar to drill down</p>
    </div>
  );
};

function coversMonth(opp: AdvisoryOpportunity, monthDate: string): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const d = new Date(monthDate);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const oppStart   = new Date(opp.Start_Date_All__c);
  const oppEnd     = new Date(opp.End_DateAll__c);
  return oppStart <= d && oppEnd >= monthStart;
}

function monthlySlice(opp: AdvisoryOpportunity): number {
  if (!opp.Amount) return 0;
  const months = opp.Number_of_Months__c && opp.Number_of_Months__c > 0
    ? opp.Number_of_Months__c : 1;
  return opp.Amount / months;
}

function oppSector(opp: AdvisoryOpportunity): string {
  return opp.Organisation_Sector__c || 'Unknown';
}

function oppOrg(opp: AdvisoryOpportunity): string {
  return opp.Account?.Name || 'Unknown Organisation';
}

const SECTOR_COLOURS: Record<string, string> = {
  'Private': '#195e47',
  'Public':  '#85d1e3',
  'Social':  '#ffcc12',
};

function sectorColour(sector: string): string {
  return SECTOR_COLOURS[sector] ?? '#8a7a6a';
}

const BAR_LABELS: Record<BarType, string> = {
  confirmed: 'Confirmed',
  expected:  'Expected',
  possible:  'Possible',
};

const BAR_COLOURS: Record<BarType, string> = {
  confirmed: '#195e47',
  expected:  '#85d1e3',
  possible:  '#ffcc12',
};

export default function AdvisoryChart({ data, opportunities, orders, uninvoicedStarted }: Props) {
  const [selection, setSelection]   = useState<Selection | null>(null);
  const [drillTab, setDrillTab]     = useState<'projects' | 'sectors' | 'finance'>('projects');
  const [showLY, setShowLY]               = useState(false);
  const [showInvoiced, setShowInvoiced]   = useState(false);
  const [showPaid, setShowPaid]           = useState(false);
  const [showPossible, setShowPossible]   = useState(false);
  const [showFullYear, setShowFullYear]   = useState(false);
  const [showCumulative, setShowCumulative] = useState(false);
  const [viewMode, setViewMode]           = useState<'stage' | 'sector'>('stage');
  const [selectedSector, setSelectedSector] = useState<'Private' | 'Public' | 'Social' | null>(null);
  const [showSectorExpected, setShowSectorExpected] = useState(false);
  const [fyTab, setFyTab]           = useState<'projects' | 'sectors'>('projects');
  const [fyBarType, setFyBarType]   = useState<BarType>('confirmed');

  // Shared row shape for both chart modes — recharts 3 infers the ComposedChart
  // data type strictly, so stage and sector rows must line up on one type even
  // though each mode only populates the fields its own Bars read.
  type ChartRow = MonthlyData & {
    confirmedBar?: number; expectedBar?: number; possibleBar?: number;
    secPrivate?: number; secPublic?: number; secSocial?: number; secOther?: number;
  };

  const chartData: ChartRow[] = data.map(d => ({
    ...d,
    confirmedBar: d.confirmed,
    // Expected = probability-weighted income from open opps (slice × prob%)
    expectedBar:  (!d.isPast || d.isCurrentMonth) ? d.expected   : 0,
    // Possible = full opportunity amount minus expected (the upside ceiling)
    possibleBar:  (!d.isPast || d.isCurrentMonth) ? d.potential   : 0,
  }));

  // Sector view: per-month confirmed income broken down by sector
  const sectorChartData: ChartRow[] = useMemo(() => data.map(d => {
    const confirmed = opportunities.filter(
      opp => opp.StageName === 'Confirmed' && coversMonth(opp, d.monthDate)
    );
    const sum = (sector: string | null) => confirmed
      .filter(opp => sector
        ? oppSector(opp) === sector
        : !['Private', 'Public', 'Social'].includes(oppSector(opp)))
      .reduce((s, opp) => s + monthlySlice(opp), 0);
    return {
      ...d,
      secPrivate:  sum('Private'),
      secPublic:   sum('Public'),
      secSocial:   sum('Social'),
      secOther:    sum(null),
      expectedBar: (!d.isPast || d.isCurrentMonth) ? d.expected  : 0,
      possibleBar: (!d.isPast || d.isCurrentMonth) ? d.potential : 0,
    };
  }), [data, opportunities]);

  const selectedMonthData = selection
    ? data.find(d => d.monthDate === selection.monthDate)
    : null;

  // Filter opportunities by bar type
  const monthOpps = selection
    ? (() => {
        const active = opportunities.filter(opp => coversMonth(opp, selection.monthDate));
        if (selection.barType === 'confirmed') {
          return active
            .filter(opp => opp.StageName === 'Confirmed')
            .map(opp => ({ opp, slice: monthlySlice(opp) }))
            .filter(({ slice }) => slice > 0)
            .sort((a, b) => b.slice - a.slice);
        }
        // Expected: probability-weighted amount per open opp
        // Possible: full opportunity value (total potential if it converts)
        return active
          .filter(opp => opp.StageName !== 'Confirmed' && opp.StageName !== 'Opportunity lost')
          .map(opp => {
            const full = monthlySlice(opp);
            const prob = (opp.Probability ?? 0) / 100;
            const slice = selection.barType === 'expected'
              ? full * prob
              : full;
            return { opp, slice };
          })
          .filter(({ slice }) => slice > 0)
          .sort((a, b) => b.slice - a.slice);
      })()
    : [];

  // Order lookup and uninvoiced set (for Finance tab + red flags)
  const orderById = useMemo(() => new Map(orders.map(o => [o.Id, o])), [orders]);
  const uninvoicedIds = useMemo(() => new Set(uninvoicedStarted.map(o => o.Id)), [uninvoicedStarted]);

  // Confirmed opps in the selected month with their order data (Finance tab)
  const financeOpps = useMemo(() => {
    if (!selection) return [];
    return opportunities
      .filter(opp => opp.StageName === 'Confirmed' && coversMonth(opp, selection.monthDate))
      .map(opp => ({
        opp,
        slice: monthlySlice(opp),
        order: opp.Order__c ? orderById.get(opp.Order__c) : undefined,
        flagged: uninvoicedIds.has(opp.Id),
      }))
      .filter(({ slice }) => slice > 0)
      .sort((a, b) => b.slice - a.slice);
  }, [selection, opportunities, orderById, uninvoicedIds]);

  // Group by Organisation → Projects
  const byOrg = monthOpps.reduce<Record<string, { total: number; projects: typeof monthOpps }>>((acc, item) => {
    const org = oppOrg(item.opp);
    if (!acc[org]) acc[org] = { total: 0, projects: [] };
    acc[org].total += item.slice;
    acc[org].projects.push(item);
    return acc;
  }, {});

  const orgEntries = Object.entries(byOrg).sort((a, b) => b[1].total - a[1].total);

  // Group by Sector
  const bySector = monthOpps.reduce<Record<string, number>>((acc, { opp, slice }) => {
    const sector = oppSector(opp);
    acc[sector] = (acc[sector] ?? 0) + slice;
    return acc;
  }, {});

  const sectorEntries = Object.entries(bySector).sort((a, b) => b[1] - a[1]);
  const sectorTotal   = sectorEntries.reduce((s, [, v]) => s + v, 0);

  // Full year breakdown: each opp's total contribution across all 12 FY months
  const fyOpps = (() => {
    if (fyBarType === 'confirmed') {
      return opportunities
        .filter(opp => opp.StageName === 'Confirmed')
        .map(opp => {
          const slice = data.reduce((sum, m) => sum + (coversMonth(opp, m.monthDate) ? monthlySlice(opp) : 0), 0);
          return { opp, slice };
        });
    }
    return opportunities
      .filter(opp => opp.StageName !== 'Confirmed' && opp.StageName !== 'Opportunity lost')
      .map(opp => {
        const full = data.reduce((sum, m) => sum + (coversMonth(opp, m.monthDate) ? monthlySlice(opp) : 0), 0);
        const prob = (opp.Probability ?? 0) / 100;
        const slice = fyBarType === 'expected' ? full * prob : full; // 'possible' also uses full amount
        return { opp, slice };
      });
  })().filter(({ slice }) => slice > 0).sort((a, b) => b.slice - a.slice);

  const fyByOrg = fyOpps.reduce<Record<string, { total: number; projects: typeof fyOpps }>>((acc, item) => {
    const org = oppOrg(item.opp);
    if (!acc[org]) acc[org] = { total: 0, projects: [] };
    acc[org].total += item.slice;
    acc[org].projects.push(item);
    return acc;
  }, {});
  const fyOrgEntries = Object.entries(fyByOrg).sort((a, b) => b[1].total - a[1].total);

  const fyBySector = fyOpps.reduce<Record<string, number>>((acc, { opp, slice }) => {
    const sector = oppSector(opp);
    acc[sector] = (acc[sector] ?? 0) + slice;
    return acc;
  }, {});
  const fySectorEntries = Object.entries(fyBySector).sort((a, b) => b[1] - a[1]);
  const fySectorTotal   = fySectorEntries.reduce((s, [, v]) => s + v, 0);

  // Each bar gets its own click handler that records the bar type
  const makeClickHandler = (barType: BarType) => (barData: any) => {
    if (!barData?.monthDate) return;
    setShowFullYear(false);
    setSelection(prev =>
      prev?.monthDate === barData.monthDate && prev?.barType === barType
        ? null
        : { monthDate: barData.monthDate, barType }
    );
    setDrillTab('projects');
  };

  const isSelected = (monthDate: string) => selection?.monthDate === monthDate;

  return (
    <div className="fi-card">
      {/* Header + legend */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-3">
        <h2 className="text-lg font-bold text-[#212122] shrink-0"
            style={{ fontFamily: 'Inria Serif, serif' }}>
          Monthly Income vs Target
        </h2>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-xs font-[Geist] text-[#8a7a6a]">
          {viewMode === 'stage' ? (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#195e47]" />
                Confirmed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#85d1e3]" />
                Expected
              </span>
              <button
                onClick={() => setShowPossible(v => !v)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                  showPossible
                    ? 'border-[#ffcc12] bg-[#fffbe6] text-[#212122]'
                    : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
                }`}
              >
                <span className="w-3 h-3 rounded-sm inline-block bg-[#ffcc12]" />
                Possible
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#195e47]" />
                Private
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#85d1e3]" />
                Public
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#ffcc12]" />
                Social
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block bg-[#c4b8a8]" />
                Other
              </span>
              {!selectedSector && (
                <button
                  onClick={() => setShowSectorExpected(v => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                    showSectorExpected
                      ? 'border-[#b8a898] bg-[#f0ebe4] text-[#212122]'
                      : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm inline-block bg-[#b8a898]" />
                  + Expected
                </button>
              )}
              {!selectedSector && (
                <button
                  onClick={() => setShowPossible(v => !v)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
                    showPossible
                      ? 'border-[#d4ccc4] bg-[#f5f2ef] text-[#212122]'
                      : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm inline-block bg-[#d4ccc4]" />
                  + Possible
                </button>
              )}
            </>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 inline-block" style={{ borderTop: '2px dashed #dd6945' }} />
            Target
          </span>
          <button
            onClick={() => setShowLY(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
              showLY
                ? 'border-[#8a7a6a] bg-[#f5ebe0] text-[#212122]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            <span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px dotted #8a7a6a' }} />
            Last year
          </button>
          <button
            onClick={() => setShowInvoiced(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
              showInvoiced
                ? 'border-[#dd6945] bg-[#fdf0ec] text-[#212122]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            <span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px solid #dd6945' }} />
            Invoiced
          </button>
          <button
            onClick={() => setShowPaid(v => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors ${
              showPaid
                ? 'border-[#85d1e3] bg-[#eef8fb] text-[#212122]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            <span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px solid #85d1e3' }} />
            Paid
          </button>
          <button
            onClick={() => { setViewMode(v => v === 'sector' ? 'stage' : 'sector'); setSelection(null); setShowFullYear(false); setSelectedSector(null); setShowSectorExpected(false); setShowCumulative(false); }}
            className={`px-2 py-1 rounded-md border transition-colors ${
              viewMode === 'sector'
                ? 'border-[#195e47] bg-[#195e47] text-[#fcf2e3]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            Sectors
          </button>
          <button
            onClick={() => { setShowFullYear(v => !v); setSelection(null); }}
            className={`px-2 py-1 rounded-md border transition-colors ${
              showFullYear
                ? 'border-[#195e47] bg-[#195e47] text-[#fcf2e3]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            Full year
          </button>
          <button
            onClick={() => { setShowCumulative(v => !v); setSelection(null); setShowFullYear(false); setViewMode('stage'); setSelectedSector(null); setShowSectorExpected(false); }}
            className={`px-2 py-1 rounded-md border transition-colors ${
              showCumulative
                ? 'border-[#212122] bg-[#212122] text-[#fcf2e3]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            Cumulative
          </button>
        </div>
      </div>

      {/* Sector filter pills */}
      {viewMode === 'sector' && (
        <div className="flex items-center gap-2 mb-4 text-xs font-[Geist]">
          <span className="text-[#8a7a6a]">Filter:</span>
          {(['Private', 'Public', 'Social'] as const).map(sector => (
            <button
              key={sector}
              onClick={() => {
                setSelectedSector(s => s === sector ? null : sector);
                setShowSectorExpected(false);
                setShowPossible(false);
              }}
              className="px-2.5 py-1 rounded-full border transition-colors"
              style={
                selectedSector === sector
                  ? { backgroundColor: sectorColour(sector), color: sector === 'Social' ? '#212122' : '#fcf2e3', borderColor: 'transparent' }
                  : { borderColor: '#e8ddd0', color: '#8a7a6a' }
              }
            >
              {sector}
            </button>
          ))}
          {selectedSector && (
            <button
              onClick={() => setSelectedSector(null)}
              className="text-[#8a7a6a] hover:text-[#212122] underline"
            >
              All sectors
            </button>
          )}
        </div>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        {showCumulative ? (
          <ComposedChart data={(() => {
            let cumConfirmed = 0, cumTarget = 0, cumLY = 0;
            const months = data.map(m => {
              cumConfirmed += m.confirmed;
              cumTarget    += m.target;
              cumLY        += m.confirmedLY ?? 0;
              return { ...m, cumConfirmed: (m.isPast || m.isCurrentMonth) ? cumConfirmed : null, cumTarget, cumLY };
            });
            // Prepend a Feb anchor at £0 so recharts can draw a line from the start
            return [{ month: 'Feb', monthDate: '2026-02-28', cumConfirmed: 0, cumTarget: 0, cumLY: 0 }, ...months];
          })()} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
            <XAxis dataKey="month"
              tick={{ fontSize: 12, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmt}
              tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false} width={60} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="cumTarget" name="Target"
              stroke="#dd6945" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }}
              strokeDasharray="6 3" />
            <Line type="monotone" dataKey="cumConfirmed" name="Confirmed"
              stroke="#195e47" strokeWidth={2.5}
              dot={{ r: 3, fill: '#195e47', strokeWidth: 0 }}
              activeDot={{ r: 5, fill: '#195e47', strokeWidth: 0 }}
              connectNulls={false} />
            {showLY && (
              <Line type="monotone" dataKey="cumLY" name="Last year"
                stroke="#8a7a6a" strokeWidth={1.5}
                dot={false} strokeDasharray="3 3" connectNulls={false} />
            )}
          </ComposedChart>
        ) : (
          <ComposedChart
            data={viewMode === 'sector' ? sectorChartData : chartData}
            margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false}
            />
            <YAxis
              tickFormatter={fmt}
              tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
              axisLine={false} tickLine={false} width={60}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Stage view bars */}
            {viewMode === 'stage' && (
              <Bar dataKey="confirmedBar" name="Confirmed" maxBarSize={32}
                   stackId="income" radius={[0, 0, 0, 0]}
                   onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
                {chartData.map((entry) => (
                  <Cell key={entry.monthDate} fill="#195e47"
                    opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
                ))}
              </Bar>
            )}
            {viewMode === 'stage' && (
              <Bar dataKey="expectedBar" name="Expected" maxBarSize={32}
                   stackId="income"
                   radius={showPossible ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                   onClick={makeClickHandler('expected')} style={{ cursor: 'pointer' }}>
                {chartData.map((entry) => (
                  <Cell key={entry.monthDate} fill="#85d1e3"
                    opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
                ))}
              </Bar>
            )}
            {viewMode === 'stage' && showPossible && (
              <Bar dataKey="possibleBar" name="Possible" maxBarSize={32}
                   stackId="income" radius={[4, 4, 0, 0]}
                   onClick={makeClickHandler('possible')} style={{ cursor: 'pointer' }}>
                {chartData.map((entry) => (
                  <Cell key={entry.monthDate} fill="#ffcc12"
                    opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 0.85} />
                ))}
              </Bar>
            )}

            {/* Sector view bars */}
            {(() => {
              // When a sector is selected, only that bar renders and it's the topmost
              const topRadius: [number, number, number, number] =
                (!showSectorExpected && !showPossible) ? [4, 4, 0, 0] : [0, 0, 0, 0];
              const isTop = (sector: string) =>
                selectedSector ? selectedSector === sector : sector === 'Other';
              return (
                <>
                  {viewMode === 'sector' && (!selectedSector || selectedSector === 'Private') && (
                    <Bar dataKey="secPrivate" name="Private" maxBarSize={32}
                         stackId="income" radius={isTop('Private') ? topRadius : [0, 0, 0, 0]}
                         onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
                      {sectorChartData.map((entry) => (
                        <Cell key={entry.monthDate} fill="#195e47"
                          opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  )}
                  {viewMode === 'sector' && (!selectedSector || selectedSector === 'Public') && (
                    <Bar dataKey="secPublic" name="Public" maxBarSize={32}
                         stackId="income" radius={isTop('Public') ? topRadius : [0, 0, 0, 0]}
                         onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
                      {sectorChartData.map((entry) => (
                        <Cell key={entry.monthDate} fill="#85d1e3"
                          opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  )}
                  {viewMode === 'sector' && (!selectedSector || selectedSector === 'Social') && (
                    <Bar dataKey="secSocial" name="Social" maxBarSize={32}
                         stackId="income" radius={isTop('Social') ? topRadius : [0, 0, 0, 0]}
                         onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
                      {sectorChartData.map((entry) => (
                        <Cell key={entry.monthDate} fill="#ffcc12"
                          opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 0.85} />
                      ))}
                    </Bar>
                  )}
                  {viewMode === 'sector' && !selectedSector && (
                    <Bar dataKey="secOther" name="Other" maxBarSize={32}
                         stackId="income" radius={topRadius}
                         onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
                      {sectorChartData.map((entry) => (
                        <Cell key={entry.monthDate} fill="#c4b8a8"
                          opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
                      ))}
                    </Bar>
                  )}
                </>
              );
            })()}
            {viewMode === 'sector' && showSectorExpected && (
              <Bar dataKey="expectedBar" name="Expected" maxBarSize={32}
                   stackId="income"
                   radius={showPossible ? [0, 0, 0, 0] : [4, 4, 0, 0]}
                   onClick={makeClickHandler('expected')} style={{ cursor: 'pointer' }}>
                {sectorChartData.map((entry) => (
                  <Cell key={entry.monthDate} fill="#b8a898"
                    opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 0.85} />
                ))}
              </Bar>
            )}
            {viewMode === 'sector' && showPossible && (
              <Bar dataKey="possibleBar" name="Possible" maxBarSize={32}
                   stackId="income" radius={[4, 4, 0, 0]}
                   onClick={makeClickHandler('possible')} style={{ cursor: 'pointer' }}>
                {sectorChartData.map((entry) => (
                  <Cell key={entry.monthDate} fill="#d4ccc4"
                    opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 0.85} />
                ))}
              </Bar>
            )}

            <Line
              type="monotone" dataKey="target" name="Target"
              stroke="#dd6945" strokeWidth={2}
              dot={false} activeDot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }}
              strokeDasharray="6 3"
            />
            {showLY && (
              <Line
                type="monotone" dataKey="confirmedLY" name="Last year"
                stroke="#8a7a6a" strokeWidth={1.5}
                dot={false} strokeDasharray="3 3"
              />
            )}
            {showInvoiced && (
              <Line
                type="monotone" dataKey="invoiced" name="Invoiced"
                stroke="#dd6945" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }}
              />
            )}
            {showPaid && (
              <Line
                type="monotone" dataKey="paid" name="Paid"
                stroke="#85d1e3" strokeWidth={2}
                dot={false} activeDot={{ r: 4, fill: '#85d1e3', strokeWidth: 0 }}
              />
            )}
          </ComposedChart>
        )}
      </ResponsiveContainer>

      {/* Drill-down panel */}
      {selection && selectedMonthData && (
        <div className="mt-6 border-t border-[#e8ddd0] pt-6">
          {/* Panel header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
            <div>
              <h3 className="font-bold text-[#212122] text-base"
                  style={{ fontFamily: 'Inria Serif, serif' }}>
                {fullMonthLabel(selectedMonthData.monthDate)} — {BAR_LABELS[selection.barType]}
              </h3>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                {fmtFull(monthOpps.reduce((s, { slice }) => s + slice, 0))}{' '}
                {BAR_LABELS[selection.barType].toLowerCase()} income
              </p>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              {/* Bar type switcher */}
              <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                {(['confirmed', 'expected', 'possible'] as BarType[]).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setSelection(s => s ? { ...s, barType: bt } : null)}
                    className="px-3 py-1.5 capitalize transition-colors"
                    style={
                      selection.barType === bt
                        ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'possible' ? '#212122' : '#fcf2e3' }
                        : { color: '#8a7a6a' }
                    }
                  >
                    {BAR_LABELS[bt]}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                <button
                  onClick={() => setDrillTab('projects')}
                  className={`px-3 py-1.5 ${drillTab === 'projects' ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}
                >
                  By Organisation
                </button>
                <button
                  onClick={() => setDrillTab('sectors')}
                  className={`px-3 py-1.5 ${drillTab === 'sectors' ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}
                >
                  By Sector
                </button>
                <button
                  onClick={() => setDrillTab('finance')}
                  className={`px-3 py-1.5 flex items-center gap-1.5 ${drillTab === 'finance' ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}
                >
                  Finance
                  {financeOpps.some(f => f.flagged) && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#dd6945] shrink-0" />
                  )}
                </button>
              </div>

              <button
                onClick={() => setSelection(null)}
                className="text-[#8a7a6a] hover:text-[#212122] text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* By Organisation view */}
          {drillTab === 'projects' && (
            <div className="space-y-3">
              {orgEntries.length === 0 && (
                <p className="text-sm text-[#8a7a6a] font-[Geist]">No opportunities found for this selection.</p>
              )}
              {orgEntries.map(([org, { total, projects }]) => (
                <div key={org} className="rounded-lg border border-[#e8ddd0] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5ebe0]">
                    <span className="font-medium text-sm text-[#212122] font-[Geist]">{org}</span>
                    <span className="text-sm font-bold text-[#212122] font-[Geist]">{fmtFull(total)}</span>
                  </div>
                  {projects.map(({ opp, slice }) => (
                    <div key={opp.Id}
                         className={`flex items-center justify-between px-3 sm:px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist] gap-2 ${uninvoicedIds.has(opp.Id) ? 'bg-[#fdf5f2]' : ''}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        {uninvoicedIds.has(opp.Id) && (
                          <span className="text-[#dd6945] text-xs shrink-0" title="Started — no invoice raised">⚑</span>
                        )}
                        <span className="text-[#212122] truncate text-xs sm:text-sm">{opp.Name}</span>
                        {oppSector(opp) !== 'Unknown' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{
                              backgroundColor: sectorColour(oppSector(opp)) + '22',
                              color: sectorColour(oppSector(opp)),
                            }}
                          >
                            {oppSector(opp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
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

          {/* By Sector view */}
          {drillTab === 'sectors' && (
            <div className="space-y-2">
              {sectorEntries.length === 0 && (
                <p className="text-sm text-[#8a7a6a] font-[Geist]">No sector data available.</p>
              )}
              {sectorEntries.map(([sector, total]) => {
                const pct = sectorTotal > 0 ? (total / sectorTotal) * 100 : 0;
                return (
                  <div key={sector}>
                    <div className="flex items-center justify-between mb-1 text-sm font-[Geist]">
                      <span className="font-medium text-[#212122]">{sector}</span>
                      <span className="text-[#8a7a6a]">{fmtFull(total)} · {Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#e8ddd0] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: sectorColour(sector) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Finance view */}
          {drillTab === 'finance' && (
            <div className="rounded-xl border border-[#e8ddd0] overflow-hidden">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-4 py-2 bg-[#f5ebe0] text-xs font-[Geist] text-[#8a7a6a] uppercase tracking-widest">
                <span>Project</span>
                <span className="text-right">Order Status</span>
                <span className="text-right">Invoiced</span>
                <span className="text-right">Paid</span>
              </div>
              {financeOpps.length === 0 && (
                <p className="px-4 py-3 text-sm text-[#8a7a6a] font-[Geist]">No confirmed projects this month.</p>
              )}
              {financeOpps.map(({ opp, order, flagged }, i) => {
                const statusColour = (() => {
                  switch (order?.Status) {
                    case 'Invoice Paid':       return 'bg-[#e8f5f0] text-[#195e47]';
                    case 'Partially Invoiced': return 'bg-[#fdf0ec] text-[#dd6945]';
                    case 'Invoice Sent':       return 'bg-[#e8f0ff] text-[#3355cc]';
                    case 'Ready to Invoice':   return 'bg-[#fff8e0] text-[#b8860b]';
                    default:                   return 'bg-[#f5ebe0] text-[#8a7a6a]';
                  }
                })();
                return (
                  <div
                    key={opp.Id}
                    className={`grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-4 py-3 text-sm font-[Geist] ${
                      i > 0 ? 'border-t border-[#e8ddd0]' : ''
                    } ${flagged ? 'bg-[#fdf5f2]' : ''}`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {flagged && <span className="text-[#dd6945] text-xs shrink-0">⚑</span>}
                        <p className="font-medium text-[#212122] truncate text-xs sm:text-sm">{opp.Account?.Name ?? '—'}</p>
                      </div>
                      <p className="text-xs text-[#8a7a6a] truncate">{opp.Name}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusColour}`}>
                      {order?.Status ?? 'No Order'}
                    </span>
                    <span className="text-xs text-right text-[#212122]">
                      {order?.Invoiced_Amount__c != null ? fmtFull(order.Invoiced_Amount__c) : '—'}
                    </span>
                    <span className="text-xs text-right text-[#212122]">
                      {order?.Paid_Amount__c != null ? fmtFull(order.Paid_Amount__c) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Full year breakdown panel */}
      {showFullYear && (
        <div className="mt-6 border-t border-[#e8ddd0] pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#212122] text-base"
                  style={{ fontFamily: 'Inria Serif, serif' }}>
                Full year breakdown — FY 2026/27
              </h3>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                {fmtFull(fyOpps.reduce((s, { slice }) => s + slice, 0))}{' '}
                {BAR_LABELS[fyBarType].toLowerCase()} income across all months
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Bar type switcher */}
              <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                {(['confirmed', 'expected', 'possible'] as BarType[]).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setFyBarType(bt)}
                    className="px-3 py-1.5 capitalize transition-colors"
                    style={
                      fyBarType === bt
                        ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'possible' ? '#212122' : '#fcf2e3' }
                        : { color: '#8a7a6a' }
                    }
                  >
                    {BAR_LABELS[bt]}
                  </button>
                ))}
              </div>

              {/* View toggle */}
              <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                <button
                  onClick={() => setFyTab('projects')}
                  className={`px-3 py-1.5 ${fyTab === 'projects' ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}
                >
                  By Organisation
                </button>
                <button
                  onClick={() => setFyTab('sectors')}
                  className={`px-3 py-1.5 ${fyTab === 'sectors' ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'}`}
                >
                  By Sector
                </button>
              </div>

              <button
                onClick={() => setShowFullYear(false)}
                className="text-[#8a7a6a] hover:text-[#212122] text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
          </div>

          {/* By Organisation */}
          {fyTab === 'projects' && (
            <div className="space-y-3">
              {fyOrgEntries.length === 0 && (
                <p className="text-sm text-[#8a7a6a] font-[Geist]">No opportunities found.</p>
              )}
              {fyOrgEntries.map(([org, { total, projects }]) => (
                <div key={org} className="rounded-lg border border-[#e8ddd0] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5ebe0]">
                    <span className="font-medium text-sm text-[#212122] font-[Geist]">{org}</span>
                    <span className="text-sm font-bold text-[#212122] font-[Geist]">{fmtFull(total)}</span>
                  </div>
                  {projects.map(({ opp, slice }) => {
                    const invOrder  = opp.Order__c ? orderById.get(opp.Order__c) : undefined;
                    const invFlagged = uninvoicedIds.has(opp.Id);
                    const invStatus  = invOrder?.Status ?? (opp.StageName === 'Confirmed' ? 'No Order' : null);
                    const invClass = invStatus === 'Invoice Paid'       ? 'bg-[#e8f5f0] text-[#195e47]'
                      : invFlagged                                      ? 'bg-[#fdf0ec] text-[#dd6945]'
                      : invStatus === 'Invoice Sent'       ? 'bg-[#e8f0ff] text-[#3355cc]'
                      : invStatus === 'Partially Invoiced' ? 'bg-[#fdf0ec] text-[#dd6945]'
                      : invStatus === 'Ready to Invoice'   ? 'bg-[#fff8e0] text-[#b8860b]'
                      : 'bg-[#f5ebe0] text-[#8a7a6a]';
                    return (
                    <div key={opp.Id}
                         className="flex items-center justify-between px-3 sm:px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist] gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[#212122] truncate text-xs sm:text-sm">{opp.Name}</span>
                        {oppSector(opp) !== 'Unknown' && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{
                              backgroundColor: sectorColour(oppSector(opp)) + '22',
                              color: sectorColour(oppSector(opp)),
                            }}
                          >
                            {oppSector(opp)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          opp.StageName === 'Confirmed'
                            ? 'bg-[#e8f5f0] text-[#195e47]'
                            : 'bg-[#fff8e0] text-[#b8860b]'
                        }`}>
                          {opp.StageName === 'Confirmed' ? 'Confirmed' : `${opp.Probability ?? 0}%`}
                        </span>
                        {opp.StageName === 'Confirmed' && invStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${invClass}`}>
                            {invFlagged ? '⚑ ' : ''}{invStatus}
                          </span>
                        )}
                        <span className="font-medium text-[#212122]">{fmtFull(slice)}</span>
                      </div>
                    </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* By Sector */}
          {fyTab === 'sectors' && (
            <div className="space-y-2">
              {fySectorEntries.length === 0 && (
                <p className="text-sm text-[#8a7a6a] font-[Geist]">No sector data available.</p>
              )}
              {fySectorEntries.map(([sector, total]) => {
                const pct = fySectorTotal > 0 ? (total / fySectorTotal) * 100 : 0;
                return (
                  <div key={sector}>
                    <div className="flex items-center justify-between mb-1 text-sm font-[Geist]">
                      <span className="font-medium text-[#212122]">{sector}</span>
                      <span className="text-[#8a7a6a]">{fmtFull(total)} · {Math.round(pct)}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[#e8ddd0] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: sectorColour(sector) }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
