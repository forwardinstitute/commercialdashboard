export const dynamic = 'force-dynamic';

import ScoreCard from '@/components/ScoreCard';
import MonthlyChart from '@/components/MonthlyChart';
import { buildDashboardData } from '@/lib/dashboard';
import { DashboardData } from '@/types';

async function getDashboardData(): Promise<DashboardData | null> {
  try {
    return await buildDashboardData();
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="min-h-screen bg-[#fcf2e3]">
      {/* Header */}
      <header className="bg-[#212122] px-8 py-5 flex items-center justify-between">
        <img
          src="https://a.storyblok.com/f/286772795909088/8000x3334/3742fbab42/white-logo.png"
          alt="Forward Institute"
          className="h-7 w-auto"
        />
        <div className="text-right">
          <p className="text-[#fcf2e3] text-sm font-[Geist] opacity-60">
            Commercial Dashboard
          </p>
          {data?.lastUpdated && (
            <p className="text-[#fcf2e3] text-xs font-[Geist] opacity-40 mt-0.5">
              Updated {formatDate(data.lastUpdated)}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {!data ? (
          <div className="fi-card text-center py-16">
            <p className="text-[#8a7a6a] font-[Geist]">
              Unable to load dashboard data. Check your Salesforce connection.
            </p>
          </div>
        ) : (
          <>
            {/* FY label */}
            <div className="flex items-center justify-between">
              <h1
                className="text-3xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}
              >
                FY 2026/27
              </h1>
              <span className="text-sm text-[#8a7a6a] font-[Geist] bg-white px-3 py-1 rounded-full border border-[#e8ddd0]">
                March 2026 – February 2027
              </span>
            </div>

            {/* Scorecards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ScoreCard
                title="Advisory"
                subtitle="Income recognition"
                ytdActual={data.advisory.ytdConfirmed}
                ytdTarget={data.advisory.ytdTarget}
                variance={data.advisory.variance}
                metricLabel="Income"
              />
              <ScoreCard
                title="Programmes"
                subtitle="Sales targets"
                ytdActual={data.programmes.ytdConfirmed}
                ytdTarget={data.programmes.ytdTarget}
                variance={data.programmes.variance}
                metricLabel="Sales"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <MonthlyChart
                data={data.advisory.months}
                title="Advisory — Monthly Income vs Target"
              />
              <MonthlyChart
                data={data.programmes.months}
                title="Programmes — Monthly Sales vs Target"
              />
            </div>

            {/* Programme breakdown */}
            <div className="fi-card">
              <h3
                className="text-lg font-bold mb-6"
                style={{ fontFamily: 'Inria Serif, serif' }}
              >
                Programme Breakdown
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {data.programmes.breakdown.map((prog) => {
                  const isAhead = prog.totalConfirmed >= prog.totalTarget;
                  const pct =
                    prog.totalTarget > 0
                      ? Math.round((prog.totalConfirmed / prog.totalTarget) * 100)
                      : 0;
                  return (
                    <div
                      key={prog.name}
                      className="bg-[#faf7f3] rounded-xl p-4 border border-[#e8ddd0]"
                    >
                      <p className="text-xs text-[#8a7a6a] font-[Geist] mb-1">
                        {prog.name}
                      </p>
                      <p
                        className="text-xl font-bold"
                        style={{ fontFamily: 'Inria Serif, serif' }}
                      >
                        {new Intl.NumberFormat('en-GB', {
                          style: 'currency',
                          currency: 'GBP',
                          maximumFractionDigits: 0,
                        }).format(prog.totalTarget)}
                      </p>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] mt-1">
                        Full year target
                      </p>
                      <div className="mt-3 h-1.5 bg-[#e8ddd0] rounded-full">
                        <div
                          className={`h-full rounded-full ${
                            isAhead ? 'bg-[#195e47]' : 'bg-[#dd6945]'
                          }`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <p
                        className={`text-xs mt-1 font-[Geist] ${
                          isAhead ? 'text-[#195e47]' : 'text-[#dd6945]'
                        }`}
                      >
                        {pct}% confirmed
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
