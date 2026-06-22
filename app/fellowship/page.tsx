export const dynamic = 'force-dynamic';

import FellowshipDashboard from '@/components/FellowshipDashboard';
import { buildFellowshipData } from '@/lib/fellowship';
import { FellowshipData } from '@/types';

async function getData(): Promise<{ data: FellowshipData | null; error: string | null }> {
  try {
    const data = await buildFellowshipData();
    return { data, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Fellowship data error:', msg);
    return { data: null, error: msg };
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default async function FellowshipPage() {
  const { data, error } = await getData();

  return (
    <div className="min-h-screen bg-[#fcf2e3]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              Fellowship
            </h1>
            <p className="text-sm text-[#8a7a6a] font-[Geist] mt-0.5">
              {data ? `Cohort ${data.cohortNumber} · Fellowship Programme ${data.cohortYear}` : 'Recruitment pipeline'}
            </p>
          </div>
          {data?.lastUpdated && (
            <p className="hidden sm:block text-xs text-[#8a7a6a] font-[Geist] shrink-0">
              Updated {fmtDate(data.lastUpdated)}
            </p>
          )}
        </div>

        {!data ? (
          <div className="fi-card py-8">
            <p className="text-[#dd6945] font-bold font-[Geist] mb-2">Unable to load fellowship data</p>
            {error && (
              <pre className="text-xs text-[#8a7a6a] font-[Geist] whitespace-pre-wrap break-all bg-[#f5ebe0] rounded-lg p-4 mt-2">
                {error}
              </pre>
            )}
          </div>
        ) : (
          <FellowshipDashboard data={data} />
        )}
      </main>
    </div>
  );
}
