export const dynamic = 'force-dynamic';

import NavBar from '@/components/NavBar';
import AdvisoryChart from '@/components/AdvisoryChart';
import { buildAdvisoryData } from '@/lib/advisory';
import { AdvisoryData } from '@/types';

async function getData(): Promise<{ data: AdvisoryData | null; error: string | null }> {
  try {
    const data = await buildAdvisoryData();
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Advisory data error:', msg);
    return { data: null, error: msg };
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function AdvisoryPage() {
  const { data, error } = await getData();

  return (
    <div className="min-h-screen bg-[#fcf2e3]">
      <NavBar />

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Page title + updated time */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Advisory
            </h1>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-0.5">
              Income recognition · March 2026 – February 2027
            </p>
          </div>
          {data?.lastUpdated && (
            <p className="text-xs text-[#8a7a6a] font-[Geist]">
              Updated {fmtDate(data.lastUpdated)}
            </p>
          )}
        </div>

        {!data ? (
          <div className="fi-card py-8">
            <p className="text-[#dd6945] font-bold font-[Geist] mb-2">Unable to load advisory data</p>
            {error && (
              <pre className="text-xs text-[#8a7a6a] font-[Geist] whitespace-pre-wrap break-all bg-[#f5ebe0] rounded-lg p-4 mt-2">
                {error}
              </pre>
            )}
          </div>
        ) : (
          <>
            {/* Headline scorecards */}
            <div className="fi-card">
              <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a] mb-3">
                Income Year to Date
              </p>
              <div className="flex items-end gap-10 mb-4">
                <div>
                  <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Confirmed</p>
                  <p className="text-4xl font-bold text-[#212122]"
                     style={{ fontFamily: 'Inria Serif, serif' }}>
                    {fmt(data.ytdConfirmed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Target</p>
                  <p className="text-4xl font-bold text-[#212122]"
                     style={{ fontFamily: 'Inria Serif, serif' }}>
                    {fmt(data.ytdTarget)}
                  </p>
                </div>
              </div>
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium font-[Geist] ${
                data.variance >= 0
                  ? 'bg-[#e8f5f0] text-[#195e47]'
                  : 'bg-[#fdf0ec] text-[#dd6945]'
              }`}>
                <span>{data.variance >= 0 ? '▲' : '▼'}</span>
                <span>
                  {data.variance >= 0 ? '+' : ''}{fmt(data.variance)}
                  {' '}({data.variance >= 0 ? 'ahead' : 'behind'})
                </span>
                {data.ytdTarget > 0 && (
                  <span className="opacity-70">
                    · {Math.round((data.ytdConfirmed / data.ytdTarget) * 100)}% of target
                  </span>
                )}
              </div>
            </div>

            {/* Monthly chart with drill-down */}
            <AdvisoryChart data={data.months} opportunities={data.opportunities} />
          </>
        )}
      </main>
    </div>
  );
}
