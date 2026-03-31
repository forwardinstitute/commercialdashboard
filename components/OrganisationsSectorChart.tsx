'use client';

import { useState } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { SectorSummary } from '@/types';

interface Props { sectors: SectorSummary[] }

type Stream = 'combined' | 'advisory' | 'programmes';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);

const SECTOR_COLOURS: Record<string, string> = {
  Private: '#195e47',
  Public:  '#85d1e3',
  Social:  '#ffcc12',
  Unknown: '#c4b8a8',
};
const sectorColour = (s: string) => SECTOR_COLOURS[s] ?? '#c4b8a8';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] rounded-xl p-3 text-sm shadow-lg min-w-[200px]">
      <p className="font-bold mb-2 text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.filter((p: any) => p.name !== 'Weighted potential').map((p: any) =>
        p.value > 0 && (
          <p key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.fill ?? p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmtFull(p.value)}</span>
          </p>
        )
      )}
      {d.weighted > 0 && (
        <p className="flex justify-between gap-4 mt-1 pt-1 border-t border-[#e8ddd0] text-[#dd6945]">
          <span>Weighted potential</span>
          <span className="font-medium">{fmtFull(d.weighted)}</span>
        </p>
      )}
      {d.potential > 0 && (
        <p className="flex justify-between gap-4 text-[#8a7a6a]">
          <span>Total potential</span>
          <span className="font-medium">{fmtFull(d.potential)}</span>
        </p>
      )}
    </div>
  );
};

export default function OrganisationsSectorChart({ sectors }: Props) {
  const [stream, setStream] = useState<Stream>('combined');

  const chartData = sectors.map(s => {
    let confirmed: number, expected: number, potential: number, weighted: number;
    if (stream === 'advisory') {
      confirmed = s.advisoryConfirmed;
      expected  = s.advisoryExpected;
      potential = s.advisoryPotential;
      weighted  = s.advisoryWeighted;
    } else if (stream === 'programmes') {
      confirmed = s.programmeConfirmed;
      expected  = s.programmeExpected;
      potential = s.programmePotential;
      weighted  = s.programmeWeighted;
    } else {
      confirmed = s.combinedConfirmed;
      expected  = s.combinedExpected;
      potential = s.totalPotential;
      weighted  = s.totalWeighted;
    }
    // gap = headroom between (confirmed + expected) and total potential ceiling
    const gap = Math.max(0, potential - confirmed - expected);
    return { sector: s.sector, confirmed, expected, gap, potential, weighted };
  });

  // Summary row totals
  const totals = chartData.reduce((acc, d) => ({
    confirmed: acc.confirmed + d.confirmed,
    expected:  acc.expected  + d.expected,
    potential: acc.potential + d.potential,
    weighted:  acc.weighted  + d.weighted,
  }), { confirmed: 0, expected: 0, potential: 0, weighted: 0 });

  const StreamButton = ({ s, label }: { s: Stream; label: string }) => (
    <button
      onClick={() => setStream(s)}
      className={`px-3 py-1 rounded-full text-xs font-[Geist] border transition-colors ${
        stream === s
          ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
          : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="fi-card mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h2 className="text-lg font-bold text-[#212122] shrink-0"
            style={{ fontFamily: 'Inria Serif, serif' }}>
          Pipeline by Sector
        </h2>
        <div className="flex items-center gap-2">
          <StreamButton s="combined"   label="Combined" />
          <StreamButton s="advisory"   label="Advisory" />
          <StreamButton s="programmes" label="Programmes" />
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Confirmed',         value: totals.confirmed, colour: '#195e47' },
          { label: 'Expected',          value: totals.expected,  colour: '#85d1e3' },
          { label: 'Weighted Potential',value: totals.weighted,  colour: '#dd6945' },
          { label: 'Total Potential',   value: totals.potential, colour: '#8a7a6a' },
        ].map(({ label, value, colour }) => (
          <div key={label} className="rounded-lg bg-[#f5ebe0] p-3">
            <p className="text-xs text-[#8a7a6a] font-[Geist] mb-0.5">{label}</p>
            <p className="text-base font-bold font-[Geist]" style={{ color: colour }}>
              {fmt(value)}
            </p>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs font-[Geist] text-[#8a7a6a] mb-4">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#195e47]" /> Confirmed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#85d1e3]" /> Expected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block bg-[#e8ddd0]" /> Remaining potential
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-0.5 inline-block" style={{ borderTop: '2px dashed #dd6945' }} />
          Weighted potential
        </span>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
          <XAxis dataKey="sector"
            tick={{ fontSize: 12, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
            axisLine={false} tickLine={false} />
          <YAxis tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
            axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<CustomTooltip />} />

          {/* Confirmed — coloured by sector */}
          <Bar dataKey="confirmed" name="Confirmed" stackId="s" maxBarSize={56} radius={[0, 0, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.sector} fill={sectorColour(d.sector)} />
            ))}
          </Bar>

          {/* Expected — lighter tint of the sector colour */}
          <Bar dataKey="expected" name="Expected" stackId="s" maxBarSize={56} radius={[0, 0, 0, 0]}>
            {chartData.map((d) => (
              <Cell key={d.sector} fill={sectorColour(d.sector)} fillOpacity={0.45} />
            ))}
          </Bar>

          {/* Remaining potential to total potential ceiling */}
          <Bar dataKey="gap" name="Remaining potential" stackId="s" maxBarSize={56} radius={[4, 4, 0, 0]}
               fill="#e8ddd0" fillOpacity={0.6} />

          {/* Weighted potential as a dotted line */}
          <Line type="monotone" dataKey="weighted" name="Weighted potential"
            stroke="#dd6945" strokeWidth={2} strokeDasharray="6 3"
            dot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }}
            activeDot={{ r: 5, fill: '#dd6945', strokeWidth: 0 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
