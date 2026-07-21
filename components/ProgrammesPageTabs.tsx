'use client';

import { useState } from 'react';
import { ProgrammesData } from '@/types';
import ProgrammesChart from '@/components/ProgrammesChart';
import ProgrammesFinanceTab from '@/components/ProgrammesFinanceTab';

interface Props {
  data: ProgrammesData;
  priceChangeAlert: React.ReactNode;
}

export default function ProgrammesPageTabs({ data, priceChangeAlert }: Props) {
  const [tab, setTab] = useState<'overview' | 'finance'>('overview');

  const flagCount = data.uninvoicedStarted.length;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-[#e8ddd0]">
        {([
          { key: 'overview', label: 'Overview' },
          { key: 'finance',  label: flagCount > 0 ? `Finance · ${flagCount} flagged` : 'Finance' },
        ] as { key: typeof tab; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-[Geist] font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-[#212122] text-[#212122]'
                : 'border-transparent text-[#8a7a6a] hover:text-[#212122]'
            } ${key === 'finance' && flagCount > 0 && tab !== 'finance' ? 'text-[#dd6945] hover:text-[#dd6945]' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <ProgrammesChart data={data} />
          {priceChangeAlert}
        </>
      )}

      {tab === 'finance' && (
        <ProgrammesFinanceTab
          opportunities={data.opportunities}
          orders={data.orders}
          lastUpdated={data.lastUpdated}
        />
      )}
    </div>
  );
}
