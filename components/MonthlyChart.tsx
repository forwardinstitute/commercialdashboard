'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { MonthlyData } from '@/types';

interface MonthlyChartProps {
  data: MonthlyData[];
  title: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(n);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#212122] text-[#fcf2e3] rounded-xl p-3 text-sm shadow-lg">
      <p className="font-bold mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>
        {label}
      </p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium">
            {new Intl.NumberFormat('en-GB', {
              style: 'currency',
              currency: 'GBP',
              maximumFractionDigits: 0,
            }).format(p.value)}
          </span>
        </p>
      ))}
    </div>
  );
};

export default function MonthlyChart({ data, title }: MonthlyChartProps) {
  return (
    <div className="fi-card">
      <h3
        className="text-lg font-bold mb-6"
        style={{ fontFamily: 'Inria Serif, serif' }}
      >
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8ddd0" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tickFormatter={fmt}
            tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist, sans-serif' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12, fontFamily: 'Geist, sans-serif' }}
          />
          <Bar dataKey="confirmed" name="Confirmed" fill="#195e47" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="expected" name="Expected" fill="#85d1e3" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="potential" name="Pipeline" fill="#ffcc12" radius={[4, 4, 0, 0]} maxBarSize={36} opacity={0.7} />
          <Line
            type="monotone"
            dataKey="target"
            name="Target"
            stroke="#212122"
            strokeWidth={2}
            dot={{ fill: '#212122', r: 3 }}
            strokeDasharray="6 3"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
