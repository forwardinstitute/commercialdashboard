'use client';

interface ScoreCardProps {
  title: string;
  subtitle: string;
  ytdActual: number;
  ytdTarget: number;
  variance: number;
  metricLabel: string;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(Math.abs(n));

export default function ScoreCard({
  title,
  subtitle,
  ytdActual,
  ytdTarget,
  variance,
  metricLabel,
}: ScoreCardProps) {
  const isAhead = variance >= 0;
  const pct = ytdTarget > 0 ? Math.round((ytdActual / ytdTarget) * 100) : 0;

  return (
    <div className="fi-card flex flex-col gap-4">
      <div>
        <p className="text-xs font-medium tracking-widest uppercase text-[#8a7a6a] font-[Geist]">
          {subtitle}
        </p>
        <h2
          className="text-2xl font-bold mt-1"
          style={{ fontFamily: 'Inria Serif, serif' }}
        >
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-[#8a7a6a] font-[Geist]">{metricLabel} YTD</p>
          <p
            className="text-3xl font-bold mt-1"
            style={{ fontFamily: 'Inria Serif, serif' }}
          >
            {fmt(ytdActual)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#8a7a6a] font-[Geist]">Target YTD</p>
          <p
            className="text-3xl font-bold mt-1"
            style={{ fontFamily: 'Inria Serif, serif' }}
          >
            {fmt(ytdTarget)}
          </p>
        </div>
      </div>

      <div
        className={`flex items-center gap-2 px-4 py-3 rounded-xl ${
          isAhead ? 'bg-[#edf6f1]' : 'bg-[#fdf0eb]'
        }`}
      >
        <span className={`text-xl ${isAhead ? 'fi-ahead' : 'fi-behind'}`}>
          {isAhead ? '▲' : '▼'}
        </span>
        <div>
          <p
            className={`text-lg font-bold ${isAhead ? 'fi-ahead' : 'fi-behind'}`}
            style={{ fontFamily: 'Inria Serif, serif' }}
          >
            {isAhead ? '+' : '-'}
            {fmt(variance)}{' '}
            <span className="text-sm font-normal">
              ({isAhead ? 'ahead' : 'behind'})
            </span>
          </p>
          <p className="text-xs text-[#8a7a6a] font-[Geist]">
            {pct}% of YTD target achieved
          </p>
        </div>
      </div>
    </div>
  );
}
