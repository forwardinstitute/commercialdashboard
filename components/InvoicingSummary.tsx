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

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n);

export default function InvoicingSummary({ orders, totalWon, totalInvoiced, totalPaid, mismatches, uninvoicedStarted }: Props) {
  const remaining = totalWon - totalPaid;
  const activeOrders = orders.filter(o => o.Status !== 'New');

  const alerts: string[] = [];
  if (uninvoicedStarted.length > 0) {
    alerts.push(`${uninvoicedStarted.length} project${uninvoicedStarted.length !== 1 ? 's' : ''} started with no invoice raised`);
  }
  if (mismatches.length > 0) {
    alerts.push(`${mismatches.length} amount mismatch${mismatches.length !== 1 ? 'es' : ''} between order and opportunity`);
  }

  return (
    <div className="fi-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
          Invoicing
        </h2>
        <p className="text-xs text-[#8a7a6a] font-[Geist]">{activeOrders.length} orders · see Finance tab for detail</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Won',       value: totalWon,      sub: `${activeOrders.length} orders` },
          { label: 'Invoiced',  value: totalInvoiced, sub: totalWon > 0 ? `${Math.round((totalInvoiced / totalWon) * 100)}% of won` : '—' },
          { label: 'Paid',      value: totalPaid,     sub: totalWon > 0 ? `${Math.round((totalPaid / totalWon) * 100)}% of won` : '—' },
          { label: 'Remaining', value: remaining,     sub: 'yet to be paid' },
        ].map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl border border-[#e8ddd0] bg-[#faf5ee] px-4 py-3">
            <p className="text-xs text-[#8a7a6a] font-[Geist] mb-1">{label}</p>
            <p className="text-xl font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{fmt(value)}</p>
            <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Alert summary — counts only, no lists */}
      {alerts.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {alerts.map(msg => (
            <span key={msg} className="inline-flex items-center gap-1.5 text-xs font-[Geist] text-[#dd6945] bg-[#fdf5f2] border border-[#f0d8d0] rounded-full px-3 py-1">
              <span>⚑</span> {msg}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
