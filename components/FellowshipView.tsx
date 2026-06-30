'use client';

import { useState } from 'react';
import FellowshipDashboard from './FellowshipDashboard';
import FellowshipMovement from './FellowshipMovement';
import DataLoadError from './DataLoadError';
import type { FellowshipData } from '@/types';
import type { FellowshipMovementRow } from '@/lib/snapshots';

// Top-level toggle on the Fellowship page:
//   Pipeline — the live snapshot view (current Salesforce state)
//   Movement — weighted-pipeline history over time, from the daily snapshots
// Movement reads Supabase, so it still works even if the live Salesforce fetch fails.
export default function FellowshipView({
  dashboardData,
  error,
  movement,
  liveWeighted,
}: {
  dashboardData: FellowshipData | null;
  error: string | null;
  movement: FellowshipMovementRow[];
  liveWeighted: number | null;
}) {
  const [view, setView] = useState<'pipeline' | 'movement'>('pipeline');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-sm font-[Geist] w-fit">
        {(['pipeline', 'movement'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 capitalize transition-colors ${
              view === v ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === 'pipeline'
        ? (dashboardData ? <FellowshipDashboard data={dashboardData} /> : <DataLoadError error={error} />)
        : <FellowshipMovement rows={movement} liveWeighted={liveWeighted} />}
    </div>
  );
}
