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

// Full month + year label from a monthDate string e.g. "2026-03-31" → "March 2026"
function fullMonthLabel(monthDate: string): string {
  // Parse as noon UTC to avoid timezone-flipping the day
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
  // payload[0].payload has the full MonthlyData including monthDate
  const monthDate: string | undefined = payload[0]?.payload?.monthDate;
  const displayLabel = monthDate ? fullMonthLabel(monthDate) : label;
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-bold mb-2 text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{displayLabel}</p>
      {payload.map((p: any) => (
        p.value !== null && p.value !== 0 && (
          <p key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmtFull(p.value)}</span>
          </p>
        )
      ))}
      <p className="text-[#8a7a6a] text-xs mt-2">Click bar to drill down</p>
    </div>
  );
};

// Does this opportunity cover the given month (identified by its end-of-month ISO date)?
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

export default function AdvisoryChart({ data, opportunities }: Props) {
  const [selectedMonthDate, setSelectedMonthDate] = useState<string | null>(null);
  const [drillTab, setDrillTab] = useState<'projects' | 'sectors'>('projects');

  const chartData = data.map(d => ({
    ...d,
    confirmedBar: d.confirmed,
    // Show expected/pipeline for future months AND the current month (opps still open)
    expectedBar:  (!d.isPast || d.isCurrentMonth) ? d.expected  : 0,
    pipelineBar:  (!d.isPast || d.isCurrentMonth) ? d.potential : 0,
  }));

  const selectedMonthData = selectedMonthDate
    ? data.find(d => d.monthDate === selectedMonthDate)
    : null;

  // Opportunities active in the selected month, with their slice
  const monthOpps = selectedMonthDate
    ? opportunities
        .filter(opp => coversMonth(opp, selectedMonthDate))
        .map(opp => ({ opp, slice: monthlySlice(opp) }))
        .filter(({ slice }) => slice > 0)
        .sort((a, b) => b.slice - a.slice)
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

  const handleBarClick = (barData: any) => {
    if (!barData?.monthDate) return;
    setSelectedMonthDate(prev =>
      prev === barData.monthDate ? null : barData.monthDate
    );
    setDrillTab('projects');
  };

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
        </div>
      </div>

      {/* Chart */}
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

          {/* Confirmed — all months */}
          <Bar dataKey="confirmedBar" name="Confirmed" stackId="income"
               radius={[0, 0, 0, 0]} maxBarSize={40}
               onClick={handleBarClick} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell
                key={entry.monthDate}
                fill="#195e47"
                opacity={selectedMonthDate && selectedMonthDate !== entry.monthDate ? 0.4 : 1}
              />
            ))}
          </Bar>

          {/* Expected — future months */}
          <Bar dataKey="expectedBar" name="Expected" stackId="income"
               radius={[0, 0, 0, 0]} maxBarSize={40}
               onClick={handleBarClick} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell
                key={entry.monthDate}
                fill="#85d1e3"
                opacity={selectedMonthDate && selectedMonthDate !== entry.monthDate ? 0.4 : 1}
              />
            ))}
          </Bar>

          {/* Pipeline — future months */}
          <Bar dataKey="pipelineBar" name="Pipeline" stackId="income"
               radius={[4, 4, 0, 0]} maxBarSize={40}
               onClick={handleBarClick} style={{ cursor: 'pointer' }}>
            {chartData.map((entry) => (
              <Cell
                key={entry.monthDate}
                fill="#ffcc12"
                opacity={selectedMonthDate && selectedMonthDate !== entry.monthDate ? 0.35 : 0.7}
              />
            ))}
          </Bar>

          {/* Target line */}
          <Line
            type="monotone" dataKey="target" name="Target"
            stroke="#dd6945" strokeWidth={2}
            dot={{ fill: '#dd6945', r: 3 }} strokeDasharray="6 3"
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Drill-down panel */}
      {selectedMonthDate && selectedMonthData && (
        <div className="mt-6 border-t border-[#e8ddd0] pt-6">
          {/* Panel header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-[#212122] text-base"
                  style={{ fontFamily: 'Inria Serif, serif' }}>
                {fullMonthLabel(selectedMonthData.monthDate)} breakdown
              </h3>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                {fmtFull(selectedMonthData.confirmed)} confirmed
                {selectedMonthData.expected > 0 && ` · ${fmtFull(selectedMonthData.expected)} expected`}
                {selectedMonthData.potential > 0 && ` · ${fmtFull(selectedMonthData.potential)} pipeline`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* Tab toggle */}
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
                onClick={() => setSelectedMonthDate(null)}
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
                <p className="text-sm text-[#8a7a6a] font-[Geist]">No opportunities found for this month.</p>
              )}
              {orgEntries.map(([org, { total, projects }]) => (
                <div key={org} className="rounded-lg border border-[#e8ddd0] overflow-hidden">
                  {/* Org header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-[#f5ebe0]">
                    <span className="font-medium text-sm text-[#212122] font-[Geist]">{org}</span>
                    <span className="text-sm font-bold text-[#212122] font-[Geist]">{fmtFull(total)}</span>
                  </div>
                  {/* Projects */}
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
    </div>
  );
}
