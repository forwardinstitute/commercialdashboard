export const dynamic = 'force-dynamic';

import FellowshipView from '@/components/FellowshipView';
import { buildFellowshipData } from '@/lib/fellowship';
import { getFellowshipMovement } from '@/lib/snapshots';
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

async function getMovement(oppIds: string[] | null) {
  try {
    return await getFellowshipMovement(oppIds);
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

export default async function FellowshipPage() {
  // Fetch the live cohort first so we can scope the movement history to the same
  // set of opps (Cohort 12 / Fellowship Programme 2026) — keeps the two tabs in sync.
  const { data, error } = await getData();
  const movement = await getMovement(data?.opportunities.map(o => o.Id) ?? null);

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

        <FellowshipView dashboardData={data} error={error} movement={movement} />
      </main>
    </div>
  );
}
