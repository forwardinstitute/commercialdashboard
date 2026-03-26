'use client';

import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { AdvisoryOpportunity, MonthlyData } from '@/types';

interface Props {
  data: MonthlyData[];
  opportunities: AdvisoryOpportunity[];
}

type BarType = 'confirmed' | 'expected' | 'pipeline';

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
  pipeline:  'Pipeline',
};

const BAR_COLOURS: Record<BarType, string> = {
  confirmed: '#195e47',
  expected:  '#85d1e3',
  pipeline:  '#ffcc12',
};

export default function AdvisoryChart({ data, opportunities }: Props) {
  const [selection, setSelection]   = useState<Selection | null>(null);
  const [drillTab, setDrillTab]     = useState<'projects' | 'sectors'>('projects');
  const [showLY, setShowLY]         = useState(false);
  const [showFullYear, setShowFullYear] = useState(false);
  const [fyTab, setFyTab]           = useState<'projects' | 'sectors'>('projects');
  const [fyBarType, setFyBarType]   = useState<BarType>('confirmed');

  const chartData = data.map(d => ({
    ...d,
    confirmedBar: d.confirmed,
    // Expected = probability-weighted income from open opps (slice × prob%)
    expectedBar:  (!d.isPast || d.isCurrentMonth) ? d.expected   : 0,
    // Pipeline = the remaining headroom above expected (slice × (1-prob%))
    pipelineBar:  (!d.isPast || d.isCurrentMonth) ? d.potential  : 0,
  }));

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
        // Pipeline: headroom = full slice × (1 - prob%) — what you'd gain if each opp fully converts
        return active
          .filter(opp => opp.StageName !== 'Confirmed' && opp.StageName !== 'Opportunity lost')
          .map(opp => {
            const full = monthlySlice(opp);
            const prob = (opp.Probability ?? 0) / 100;
            const slice = selection.barType === 'expected'
              ? full * prob
              : full * (1 - prob);
            return { opp, slice };
          })
          .filter(({ slice }) => slice > 0)
          .sort((a, b) => b.slice - a.slice);
      })()
    : [];

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
        const slice = fyBarType === 'expected' ? full * prob : full * (1 - prob);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-[#212122]"
            style={{ fontFamily: 'Inria Serif, serif' }}>
          Monthly Income vs Target
        </h2>
        <div className="flex items-center gap-4 text-xs font-[Geist] text-[#8a7a6a]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-[#195e47]" />
            Confirmed
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-[#85d1e3]" />
            Expected
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-[#ffcc12]" />
            Pipeline
          </span>
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
            onClick={() => { setShowFullYear(v => !v); setSelection(null); }}
            className={`px-2 py-1 rounded-md border transition-colors ${
              showFullYear
                ? 'border-[#195e47] bg-[#195e47] text-[#fcf2e3]'
                : 'border-[#e8ddd0] text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            Full year
          </button>
        </div>
      </div>

      {/* Chart — grouped (not stacked) bars */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
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

          {/* Confirmed */}
          <Bar dataKey="confirmedBar" name="Confirmed" maxBarSize={16}
               radius={[4, 4, 0, 0]}
               onClick={makeClickHandler('confirmed')} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell key={entry.monthDate} fill="#195e47"
                opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
            ))}
          </Bar>

          {/* Expected */}
          <Bar dataKey="expectedBar" name="Expected" maxBarSize={16}
               radius={[4, 4, 0, 0]}
               onClick={makeClickHandler('expected')} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell key={entry.monthDate} fill="#85d1e3"
                opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 1} />
            ))}
          </Bar>

          {/* Pipeline */}
          <Bar dataKey="pipelineBar" name="Pipeline" maxBarSize={16}
               radius={[4, 4, 0, 0]}
               onClick={makeClickHandler('pipeline')} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell key={entry.monthDate} fill="#ffcc12"
                opacity={selection && !isSelected(entry.monthDate) ? 0.3 : 0.85} />
            ))}
          </Bar>

          {/* Target line */}
          <Line
            type="monotone" dataKey="target" name="Target"
            stroke="#dd6945" strokeWidth={2}
            dot={{ fill: '#dd6945', r: 3 }} strokeDasharray="6 3"
          />

          {/* Last year confirmed — toggled */}
          {showLY && (
            <Line
              type="monotone" dataKey="confirmedLY" name="Last year"
              stroke="#8a7a6a" strokeWidth={1.5}
              dot={false} strokeDasharray="3 3"
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Drill-down panel */}
      {selection && selectedMonthData && (
        <div className="mt-6 border-t border-[#e8ddd0] pt-6">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-4">
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

            <div className="flex items-center gap-3">
              {/* Bar type switcher */}
              <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
                {(['confirmed', 'expected', 'pipeline'] as BarType[]).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setSelection(s => s ? { ...s, barType: bt } : null)}
                    className="px-3 py-1.5 capitalize transition-colors"
                    style={
                      selection.barType === bt
                        ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'pipeline' ? '#212122' : '#fcf2e3' }
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
                         className="flex items-center justify-between px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist]">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[#212122] truncate">{opp.Name}</span>
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
                      <div className="flex items-center gap-4 shrink-0 ml-4">
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
                {(['confirmed', 'expected', 'pipeline'] as BarType[]).map(bt => (
                  <button
                    key={bt}
                    onClick={() => setFyBarType(bt)}
                    className="px-3 py-1.5 capitalize transition-colors"
                    style={
                      fyBarType === bt
                        ? { backgroundColor: BAR_COLOURS[bt], color: bt === 'pipeline' ? '#212122' : '#fcf2e3' }
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
                  {projects.map(({ opp, slice }) => (
                    <div key={opp.Id}
                         className="flex items-center justify-between px-4 py-2 border-t border-[#e8ddd0] text-sm font-[Geist]">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-[#212122] truncate">{opp.Name}</span>
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
                      <div className="flex items-center gap-4 shrink-0 ml-4">
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
