'use client';

import { useState, useMemo } from 'react';
import { AdvisoryOpportunity, AdvisoryOrder } from '@/types';

interface Props {
  opportunities: AdvisoryOpportunity[];
  orders: AdvisoryOrder[];
}

const STATUSES = ['Ready to Invoice', 'Invoice Sent', 'Partially Invoiced', 'Invoice Paid'] as const;
type StatusFilter = 'All' | typeof STATUSES[number] | 'No Order';

const SECTORS = ['Private', 'Public', 'Social'] as const;
type SectorFilter = 'All' | typeof SECTORS[number];

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  'Ready to Invoice':   { bg: 'bg-[#fff8e0]', text: 'text-[#b8860b]' },
  'Invoice Sent':       { bg: 'bg-[#e8f0ff]', text: 'text-[#3355cc]' },
  'Partially Invoiced': { bg: 'bg-[#fdf0ec]', text: 'text-[#dd6945]' },
  'Invoice Paid':       { bg: 'bg-[#e8f5f0]', text: 'text-[#195e47]' },
  'No Order':           { bg: 'bg-[#f5ebe0]', text: 'text-[#8a7a6a]' },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

const FY_START = new Date('2026-03-01');
const FY_END   = new Date('2027-02-28');

function overlapsCurrentFY(opp: AdvisoryOpportunity): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const start = new Date(opp.Start_Date_All__c);
  const end   = new Date(opp.End_DateAll__c);
  return start <= FY_END && end >= FY_START;
}

export default function AdvisoryFinanceTab({ opportunities, orders }: Props) {
  const [sector, setSector]       = useState<SectorFilter>('All');
  const [status, setStatus]       = useState<StatusFilter>('All');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortKey, setSortKey]     = useState<'start' | 'amount' | 'org'>('start');

  const today = new Date();

  const orderById = useMemo(() => new Map(orders.map(o => [o.Id, o])), [orders]);

  const rows = useMemo(() => {
    const confirmed = opportunities.filter(
      opp => opp.StageName === 'Confirmed' && overlapsCurrentFY(opp),
    );

    return confirmed.map(opp => {
      const order = opp.Order__c ? orderById.get(opp.Order__c) : undefined;
      const hasStarted = opp.Start_Date_All__c ? new Date(opp.Start_Date_All__c) <= today : false;
      const invoiceCount = order?.Number_of_invoices__c ?? 0;
      const flagged = hasStarted && (!order || invoiceCount === 0);
      const orderStatus: string = order?.Status ?? 'No Order';
      return { opp, order, flagged, orderStatus, invoiceCount };
    });
  }, [opportunities, orderById, today]);

  const filtered = useMemo(() => {
    return rows
      .filter(r => sector === 'All' || (r.opp.Organisation_Sector__c ?? 'Other') === sector)
      .filter(r => status === 'All' || r.orderStatus === status)
      .filter(r => !flaggedOnly || r.flagged)
      .sort((a, b) => {
        if (sortKey === 'org')    return (a.opp.Account?.Name ?? '').localeCompare(b.opp.Account?.Name ?? '');
        if (sortKey === 'amount') return (b.opp.Amount ?? 0) - (a.opp.Amount ?? 0);
        // start date
        const aStart = a.opp.Start_Date_All__c ?? '';
        const bStart = b.opp.Start_Date_All__c ?? '';
        return aStart < bStart ? -1 : aStart > bStart ? 1 : 0;
      });
  }, [rows, sector, status, flaggedOnly, sortKey]);

  const totalWon      = filtered.reduce((s, r) => s + (r.order?.TotalAmount        ?? 0), 0);
  const totalInvoiced = filtered.reduce((s, r) => s + (r.order?.Invoiced_Amount__c ?? 0), 0);
  const totalPaid     = filtered.reduce((s, r) => s + (r.order?.Paid_Amount__c     ?? 0), 0);
  const totalRemain   = filtered.reduce((s, r) => s + (r.order?.Invoice_Amount_Remaining__c ?? 0), 0);
  const flagCount     = filtered.filter(r => r.flagged).length;

  const pill = (active: boolean, onClick: () => void, label: string, danger = false) => (
    <button
      key={label}
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-[Geist] font-medium transition-colors border ${
        active
          ? danger
            ? 'bg-[#dd6945] text-white border-[#dd6945]'
            : 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
          : 'bg-transparent text-[#8a7a6a] border-[#e8ddd0] hover:border-[#212122]'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* KPI tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total won',  value: totalWon,      sub: `${filtered.length} projects` },
          { label: 'Invoiced',   value: totalInvoiced,  sub: totalWon > 0 ? `${Math.round((totalInvoiced / totalWon) * 100)}% of won` : '—' },
          { label: 'Paid',       value: totalPaid,      sub: totalWon > 0 ? `${Math.round((totalPaid / totalWon) * 100)}% of won` : '—' },
          { label: 'Remaining',  value: totalRemain,    sub: 'yet to be paid' },
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

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        {/* Sector */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Sector</span>
          {pill(sector === 'All', () => setSector('All'), 'All')}
          {SECTORS.map(s => pill(sector === s, () => setSector(s), s))}
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Status</span>
          {pill(status === 'All', () => setStatus('All'), 'All')}
          {([...STATUSES, 'No Order'] as StatusFilter[]).map(s =>
            pill(status === s, () => setStatus(s), s),
          )}
        </div>

        {/* Flag toggle */}
        {flagCount > 0 && (
          pill(flaggedOnly, () => setFlaggedOnly(v => !v), `⚑ Needs invoicing (${flagCount})`, true)
        )}
      </div>

      {/* Sort row */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Sort</span>
        {([ ['start', 'Start date'], ['org', 'Organisation'], ['amount', 'Amount'] ] as [typeof sortKey, string][]).map(
          ([key, label]) => pill(sortKey === key, () => setSortKey(key), label),
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-[#e8ddd0] overflow-hidden">
        {/* Desktop header */}
        <div className="hidden sm:grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2.5 bg-[#f5ebe0] text-xs font-[Geist] text-[#8a7a6a] uppercase tracking-widest">
          <span>Organisation / Project</span>
          <span>Dates</span>
          <span className="text-right">Status</span>
          <span className="text-right">Inv.</span>
          <span className="text-right">Invoiced</span>
          <span className="text-right">Paid</span>
          <span className="text-right">Remaining</span>
        </div>

        {filtered.length === 0 && (
          <p className="px-4 py-6 text-sm text-center text-[#8a7a6a] font-[Geist]">
            No projects match the current filters.
          </p>
        )}

        {filtered.map(({ opp, order, flagged, orderStatus, invoiceCount }, i) => {
          const sc = STATUS_COLOURS[orderStatus] ?? STATUS_COLOURS['No Order'];
          return (
            <div
              key={opp.Id}
              className={`${i > 0 ? 'border-t border-[#e8ddd0]' : ''} ${flagged ? 'bg-[#fdf5f2]' : ''}`}
            >
              {/* Desktop row */}
              <div className="hidden sm:grid grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 text-sm font-[Geist]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {flagged && <span className="text-[#dd6945] shrink-0 text-xs">⚑</span>}
                    <p className="font-medium text-[#212122] truncate">{opp.Account?.Name ?? '—'}</p>
                  </div>
                  <p className="text-xs text-[#8a7a6a] truncate mt-0.5">{opp.Name}</p>
                </div>
                <p className="text-xs text-[#8a7a6a] whitespace-nowrap">
                  {fmtDate(opp.Start_Date_All__c)} → {fmtDate(opp.End_DateAll__c)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${sc.bg} ${sc.text}`}>
                  {orderStatus}
                </span>
                <span className={`text-xs text-right font-medium ${flagged ? 'text-[#dd6945]' : 'text-[#8a7a6a]'}`}>
                  {order ? invoiceCount : '—'}
                </span>
                <span className="text-xs text-right text-[#212122]">
                  {order?.Invoiced_Amount__c != null ? fmt(order.Invoiced_Amount__c) : '—'}
                </span>
                <span className="text-xs text-right text-[#212122]">
                  {order?.Paid_Amount__c != null ? fmt(order.Paid_Amount__c) : '—'}
                </span>
                <span className="text-xs text-right text-[#212122]">
                  {order?.Invoice_Amount_Remaining__c != null ? fmt(order.Invoice_Amount_Remaining__c) : '—'}
                </span>
              </div>

              {/* Mobile row */}
              <div className="sm:hidden px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {flagged && <span className="text-[#dd6945] text-xs">⚑</span>}
                      <p className="font-medium text-[#212122] text-sm truncate">{opp.Account?.Name ?? '—'}</p>
                    </div>
                    <p className="text-xs text-[#8a7a6a] truncate">{opp.Name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${sc.bg} ${sc.text}`}>
                    {orderStatus}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#8a7a6a] mt-1">
                  <span>{fmtDate(opp.Start_Date_All__c)} → {fmtDate(opp.End_DateAll__c)}</span>
                  {order && (
                    <>
                      <span>·</span>
                      <span>{invoiceCount} inv.</span>
                      <span>·</span>
                      <span className="text-[#212122]">{fmt(order.Invoiced_Amount__c ?? 0)} invoiced</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
