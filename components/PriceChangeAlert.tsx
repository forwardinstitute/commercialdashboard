import { PriceChange } from '@/lib/snapshots';

const STREAM_LABELS: Record<string, string> = {
  advisory:   'Advisory',
  fellowship: 'Fellowship',
  exchange:   'Exchange',
  ltd:        'LtD',
  other:      'Other',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function DeltaBadge({ delta }: { delta: number }) {
  const isIncrease = delta > 0;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium font-[Geist] ${
      isIncrease ? 'bg-[#e8f5f0] text-[#195e47]' : 'bg-[#fdf0ec] text-[#dd6945]'
    }`}>
      {isIncrease ? '▲' : '▼'} {isIncrease ? '+' : ''}{fmt(delta)}
    </span>
  );
}

export default function PriceChangeAlert({ changes }: { changes: PriceChange[] }) {
  return (
    <div className="fi-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a]">
            Confirmed opportunity value changes
          </p>
          <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
            Confirmed opportunities whose value has changed in the last 30 days
          </p>
        </div>
        {changes.length > 0 && (
          <span className="text-xs font-[Geist] bg-[#fdf0ec] text-[#dd6945] px-2 py-1 rounded font-medium">
            {changes.length} {changes.length === 1 ? 'change' : 'changes'}
          </span>
        )}
      </div>

      {changes.length === 0 ? (
        <p className="text-sm text-[#8a7a6a] font-[Geist] py-4 text-center">
          No value changes detected in the last 30 days.{' '}
          <span className="opacity-70">Tracking started {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })} — changes will appear here as they are detected.</span>
        </p>
      ) : (
        <div className="divide-y divide-[#e8ddd0]">
          {changes.map(c => (
            <div key={c.opp_id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">

              {/* Opp + account */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#212122] font-[Geist] truncate">{c.opp_name}</p>
                <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
                  {c.account_name}
                  <span className="mx-1.5 opacity-40">·</span>
                  {STREAM_LABELS[c.stream] ?? c.stream}
                  <span className="mx-1.5 opacity-40">·</span>
                  {c.sector}
                </p>
              </div>

              {/* Value change */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-xs text-[#8a7a6a] font-[Geist]">Was</p>
                  <p className="text-sm font-medium text-[#212122] font-[Geist]">{fmt(c.first_amount)}</p>
                  <p className="text-[10px] text-[#8a7a6a] font-[Geist]">{fmtDate(c.first_date)}</p>
                </div>
                <span className="text-[#8a7a6a] opacity-50">→</span>
                <div className="text-right">
                  <p className="text-xs text-[#8a7a6a] font-[Geist]">Now</p>
                  <p className="text-sm font-bold text-[#212122] font-[Geist]">{fmt(c.latest_amount)}</p>
                  <p className="text-[10px] text-[#8a7a6a] font-[Geist]">{fmtDate(c.latest_date)}</p>
                </div>
                <DeltaBadge delta={c.delta} />
              </div>

              {/* FY impact (advisory only — where fy_amount differs from amount) */}
              {c.stream === 'advisory' && c.fy_delta !== 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-[#8a7a6a] font-[Geist]">FY impact</p>
                  <DeltaBadge delta={c.fy_delta} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
