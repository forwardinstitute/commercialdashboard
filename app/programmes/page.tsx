export const dynamic = 'force-dynamic';

import ProgrammesChart from '@/components/ProgrammesChart';
import PriceChangeAlert from '@/components/PriceChangeAlert';
import DataLoadError from '@/components/DataLoadError';
import ProgrammesSubNav from '@/components/ProgrammesSubNav';
import { buildProgrammesData } from '@/lib/programmes';
import { getConfirmedPriceChanges } from '@/lib/snapshots';
import { ProgrammesData } from '@/types';

async function getData(): Promise<{ data: ProgrammesData | null; error: string | null }> {
  try {
    const data = await buildProgrammesData();
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Programmes data error:', msg);
    return { data: null, error: msg };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

async function getPriceChanges() {
  try {
    return await getConfirmedPriceChanges(30);
  } catch {
    return [];
  }
}

export default async function ProgrammesPage() {
  const [{ data, error }, priceChanges] = await Promise.all([getData(), getPriceChanges()]);

  return (
    <div className="min-h-screen bg-[#fcf2e3]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <ProgrammesSubNav />
        {/* Page title */}
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Programmes
            </h1>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-0.5">
              Sales recognition · March 2026 – February 2027
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
            <ProgrammesChart data={data} />
            <PriceChangeAlert changes={priceChanges.filter(c => c.stream !== 'advisory')} />
          </>
        )}
      </main>
    </div>
  );
}
