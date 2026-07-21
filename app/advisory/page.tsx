export const dynamic = 'force-dynamic';

import AdvisoryPageTabs from '@/components/AdvisoryPageTabs';
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
          <AdvisoryPageTabs
            data={data}
            priceChangeAlert={
              <PriceChangeAlert changes={priceChanges.filter(c => c.stream === 'advisory')} />
            }
          />
        )}
      </main>
    </div>
  );
}
