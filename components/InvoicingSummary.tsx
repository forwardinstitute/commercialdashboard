'use client';

import { AdvisoryMismatch, AdvisoryOpportunity, AdvisoryOrder } from '@/types';

interface Props {
  orders: AdvisoryOrder[];
  totalWon: number;
  totalInvoiced: number;
  totalPaid: number;
  mismatches: AdvisoryMismatch[];
  uninvoicedStarted: AdvisoryOpportunity[];
}

const STAGES = [
  'Ready to Invoice',
  'Invoice Sent',
  'Partially Invoiced',
  'Invoice Paid',
] as const;

const STAGE_COLOURS: Record<string, { bg: string; text: string; dot: string }> = {
  'Ready to Invoice':  { bg: 'bg-[#fff8e0]', text: 'text-[#b8860b]', dot: '#ffcc12' },
  'Invoice Sent':      { bg: 'bg-[#e8f0ff]', text: 'text-[#3355cc]', dot: '#85d1e3' },
  'Partially Invoiced':{ bg: 'bg-[#fdf0ec]', text: 'text-[#dd6945]', dot: '#dd6945' },
  'Invoice Paid':      { bg: 'bg-[#e8f5f0]', text: 'text-[#195e47]', dot: '#195e47' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);

export default function InvoicingSummary({ orders, totalWon, totalInvoiced, totalPaid, mismatches, uninvoicedStarted }: Props) {
  const remaining = totalWon - totalPaid;
  const activeOrders = orders.filter(o => o.Status !== 'New');

  const byStage = STAGES.map(stage => {
    const stageOrders = activeOrders.filter(o => o.Status === stage);
    return {
      stage,
      count: stageOrders.length,
      total: stageOrders.reduce((s, o) => s + (o.TotalAmount ?? 0), 0),
    };
  });

  return (
    <div className="fi-card space-y-6">
      <h2 className="text-lg font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
        Invoicing
      </h2>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Won',       value: totalWon,       sub: `${activeOrders.length} orders` },
          { label: 'Invoiced',  value: totalInvoiced,  sub: totalWon > 0 ? `${Math.round((totalInvoiced / totalWon) * 100)}% of won` : '—' },
          { label: 'Paid',      value: totalPaid,       sub: totalWon > 0 ? `${Math.round((totalPaid / totalWon) * 100)}% of won` : '—' },
          { label: 'Remaining', value: remaining,       sub: 'yet to be paid' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-[#e8ddd0] bg-[#faf5ee] px-4 py-3">
            <p className="text-xs text-[#8a7a6a] font-[Geist] mb-1">{label}</p>
            <p className="text-xl font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
              {fmt(value)}
            </p>
            <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <div>
        <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a] mb-3">By Stage</p>
        <div className="flex flex-wrap gap-3">
          {byStage.map(({ stage, count, total }) => {
            const colours = STAGE_COLOURS[stage] ?? { bg: 'bg-[#f5ebe0]', text: 'text-[#8a7a6a]', dot: '#8a7a6a' };
            return (
              <div key={stage} className={`flex items-center gap-3 rounded-xl border border-[#e8ddd0] px-4 py-3 ${colours.bg}`}>
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: colours.dot }} />
                <div>
                  <p className={`text-xs font-medium font-[Geist] ${colours.text}`}>{stage}</p>
                  <p className="text-sm font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
                    {count} <span className="text-xs font-normal text-[#8a7a6a]">· {fmt(total)}</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Uninvoiced started projects */}
      {uninvoicedStarted.length > 0 && (
        <div>
          <p className="text-xs font-[Geist] uppercase tracking-widest text-[#dd6945] mb-3 flex items-center gap-2">
            <span>⚑</span>
            <span>Started — No Invoice Raised ({uninvoicedStarted.length})</span>
          </p>
          <div className="rounded-xl border border-[#f0d8d0] bg-[#fdf5f2] overflow-hidden">
            {uninvoicedStarted.map((opp, i) => (
              <div
                key={opp.Id}
                className={`flex items-center justify-between px-4 py-3 text-sm font-[Geist] gap-4 ${
                  i > 0 ? 'border-t border-[#f0d8d0]' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#212122] truncate">{opp.Account?.Name ?? '—'}</p>
                  <p className="text-xs text-[#8a7a6a] truncate">{opp.Name}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-[#8a7a6a]">
                    Started{' '}
                    <span className="text-[#212122] font-medium">
                      {opp.Start_Date_All__c
                        ? new Date(opp.Start_Date_All__c).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </span>
                  </p>
                  <p className="text-xs text-[#dd6945] font-medium mt-0.5">
                    {opp.Order__c ? 'No invoices raised' : 'No order linked'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mismatch alert */}
      {mismatches.length > 0 && (
        <div>
          <p className="text-xs font-[Geist] uppercase tracking-widest text-[#8a7a6a] mb-3">
            Amount Mismatches — Order differs from Opportunity
          </p>
          <div className="rounded-xl border border-[#f0d8d0] bg-[#fdf5f2] overflow-hidden">
            {mismatches.map((m, i) => {
              const diff = m.orderAmount - m.oppAmount;
              return (
                <div
                  key={m.oppId}
                  className={`flex items-center justify-between px-4 py-3 text-sm font-[Geist] gap-4 ${
                    i > 0 ? 'border-t border-[#f0d8d0]' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[#212122] truncate">{m.orgName}</p>
                    <p className="text-xs text-[#8a7a6a] truncate">{m.oppName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-[#8a7a6a]">
                      Opp <span className="text-[#212122] font-medium">{fmtFull(m.oppAmount)}</span>
                      {' · '}
                      Order <span className="text-[#212122] font-medium">{fmtFull(m.orderAmount)}</span>
                    </p>
                    <p className={`text-xs font-medium mt-0.5 ${diff > 0 ? 'text-[#195e47]' : 'text-[#dd6945]'}`}>
                      {diff > 0 ? '+' : ''}{fmtFull(diff)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
