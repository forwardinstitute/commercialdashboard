'use client';

import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { MonthlyData } from '@/types';

interface Props {
  data: MonthlyData[];
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
  return (
    <div className="bg-white border border-[#e8ddd0] text-[#212122] rounded-xl p-3 text-sm shadow-lg min-w-[180px]">
      <p className="font-bold mb-2 text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.map((p: any) => (
        p.value !== null && p.value !== 0 && (
          <p key={p.name} className="flex justify-between gap-4 mb-0.5">
            <span style={{ color: p.color === '#212122' ? '#195e47' : p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmtFull(p.value)}</span>
          </p>
        )
      ))}
    </div>
  );
};

// Confirmed shows for ALL months — a confirmed opp running Jan–Apr contributes
// its monthly slice to March and April regardless of whether that month is past or future.
// Expected and pipeline only show for future months (alongside any confirmed income).
export default function AdvisoryChart({ data }: Props) {
  const chartData = data.map(d => ({
    ...d,
    confirmedBar: d.confirmed,
    expectedBar:  !d.isPast ? d.expected  : 0,
    pipelineBar:  !d.isPast ? d.potential : 0,
  }));

  return (
    <div className="fi-card">
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
            Expected (future)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block bg-[#ffcc12]" />
            Pipeline (future)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-6 h-0.5 inline-block" style={{ borderTop: '2px dashed #212122' }} />
            Target
          </span>
        </div>
      </div>

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

          {/* Confirmed income — all months */}
          <Bar dataKey="confirmedBar" name="Confirmed" fill="#195e47"
               radius={[4, 4, 0, 0]} maxBarSize={40} />

          {/* Future months: expected */}
          <Bar dataKey="expectedBar" name="Expected" fill="#85d1e3"
               radius={[4, 4, 0, 0]} maxBarSize={40} />

          {/* Future months: pipeline */}
          <Bar dataKey="pipelineBar" name="Pipeline" fill="#ffcc12" opacity={0.7}
               radius={[4, 4, 0, 0]} maxBarSize={40} />

          {/* Target line — full year */}
          <Line
            type="monotone" dataKey="target" name="Target"
            stroke="#212122" strokeWidth={2}
            dot={{ fill: '#212122', r: 3 }} strokeDasharray="6 3"
          />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
