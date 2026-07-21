export const dynamic = 'force-dynamic';

import AdvisoryChart from '@/components/AdvisoryChart';
import InvoicingSummary from '@/components/InvoicingSummary';
import PriceChangeAlert from '@/components/PriceChangeAlert';
import DataLoadError from '@/components/DataLoadError';
import { buildAdvisoryData } from '@/lib/advisory';
import { getConfirmedPriceChanges } from '@/lib/snapshots';
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

async function getPriceChanges() {
  try {
    return await getConfirmedPriceChanges(30);
  } catch {
    return [];
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
  const [{ data, error }, priceChanges] = await Promise.all([getData(), getPriceChanges()]);

  return (
    <div className="min-h-screen bg-[#fcf2e3]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        {/* Page title + updated time */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Advisory
            </h1>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-0.5">
              Income recognition · March 2026 – February 2027
            </p>
          </div>
          {data?.lastUpdated && (
            <p className="hidden sm:block text-xs text-[#8a7a6a] font-[Geist] shrink-0">
              Updated {fmtDate(data.lastUpdated)}
            </p>
          )}
        </div>

        {!data ? (
          <DataLoadError error={error} />
        ) : (
          <>
            {/* Headline scorecards */}
            <div className="fi-card">
              <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a] mb-3">
                Income Year to Date
              </p>
              <div className="flex items-end gap-6 sm:gap-10 mb-4">
                <div>
                  <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Confirmed</p>
                  <p className="text-2xl sm:text-4xl font-bold text-[#212122]"
                     style={{ fontFamily: 'Inria Serif, serif' }}>
                    {fmt(data.ytdConfirmed)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-[#8a7a6a] font-[Geist] mb-1">Target</p>
                  <p className="text-2xl sm:text-4xl font-bold text-[#212122]"
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

            {/* Invoicing summary — won/invoiced/paid, stage breakdown, mismatches */}
            <InvoicingSummary
              orders={data.orders}
              totalWon={data.totalWon}
              totalInvoiced={data.totalInvoiced}
              totalPaid={data.totalPaid}
              mismatches={data.mismatches}
            />

            {/* Confirmed value changes alert — advisory stream only */}
            <PriceChangeAlert changes={priceChanges.filter(c => c.stream === 'advisory')} />
          </>
        )}
      </main>
    </div>
  );
}
