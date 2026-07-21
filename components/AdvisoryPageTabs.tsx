'use client';

import { useState } from 'react';
import { AdvisoryData } from '@/types';
import AdvisoryChart from '@/components/AdvisoryChart';
import InvoicingSummary from '@/components/InvoicingSummary';
import AdvisoryFinanceTab from '@/components/AdvisoryFinanceTab';

interface Props {
  data: AdvisoryData;
  priceChangeAlert: React.ReactNode;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

export default function AdvisoryPageTabs({ data, priceChangeAlert }: Props) {
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

          <AdvisoryChart
            data={data.months}
            opportunities={data.opportunities}
            orders={data.orders}
            uninvoicedStarted={data.uninvoicedStarted}
          />

          <InvoicingSummary
            orders={data.orders}
            totalWon={data.totalWon}
            totalInvoiced={data.totalInvoiced}
            totalPaid={data.totalPaid}
            mismatches={data.mismatches}
            uninvoicedStarted={data.uninvoicedStarted}
          />

          {priceChangeAlert}
        </>
      )}

      {tab === 'finance' && (
        <AdvisoryFinanceTab
          opportunities={data.opportunities}
          orders={data.orders}
          lastUpdated={data.lastUpdated}
        />
      )}
    </div>
  );
}
