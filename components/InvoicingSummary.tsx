'use client';

import { useState } from 'react';
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

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function ageLabel(days: number): { text: string; cls: string } {
  if (days > 60) return { text: `${days}d`, cls: 'text-[#b83020]' };
  if (days > 30) return { text: `${days}d`, cls: 'text-[#dd6945]' };
  return { text: `${days}d`, cls: 'text-[#b8860b]' };
}

export default function InvoicingSummary({ orders, totalWon, totalInvoiced, totalPaid, mismatches, uninvoicedStarted }: Props) {
  const [open, setOpen] = useState<'uninvoiced' | 'mismatches' | null>(null);

  const remaining = totalWon - totalPaid;
  const activeOrders = orders.filter(o => o.Status !== 'New');

  const toggle = (key: 'uninvoiced' | 'mismatches') =>
    setOpen(prev => prev === key ? null : key);

  // Sort uninvoiced by days overdue descending (most urgent first)
  const sortedUninvoiced = [...uninvoicedStarted].sort((a, b) => {
    const da = a.Start_Date_All__c ? daysAgo(a.Start_Date_All__c) : 0;
    const db = b.Start_Date_All__c ? daysAgo(b.Start_Date_All__c) : 0;
    return db - da;
  });

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

      {/* Alert pills */}
      {(uninvoicedStarted.length > 0 || mismatches.length > 0) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {uninvoicedStarted.length > 0 && (
            <button
              onClick={() => toggle('uninvoiced')}
              className={`inline-flex items-center gap-1.5 text-xs font-[Geist] rounded-full px-3 py-1 border transition-colors ${
                open === 'uninvoiced'
                  ? 'bg-[#dd6945] text-white border-[#dd6945]'
                  : 'text-[#dd6945] bg-[#fdf5f2] border-[#f0d8d0] hover:bg-[#f8e8e4]'
              }`}
            >
              <span>⚑</span>
              {uninvoicedStarted.length} project{uninvoicedStarted.length !== 1 ? 's' : ''} started with no invoice raised
            </button>
          )}
          {mismatches.length > 0 && (
            <button
              onClick={() => toggle('mismatches')}
              className={`inline-flex items-center gap-1.5 text-xs font-[Geist] rounded-full px-3 py-1 border transition-colors ${
                open === 'mismatches'
                  ? 'bg-[#dd6945] text-white border-[#dd6945]'
                  : 'text-[#dd6945] bg-[#fdf5f2] border-[#f0d8d0] hover:bg-[#f8e8e4]'
              }`}
            >
              <span>⚑</span>
              {mismatches.length} amount mismatch{mismatches.length !== 1 ? 'es' : ''} between order and opportunity
            </button>
          )}
        </div>
      )}

      {/* Uninvoiced expansion */}
      {open === 'uninvoiced' && (
        <div className="mt-4 rounded-xl border border-[#e8ddd0] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-[#f5ebe0] text-xs font-[Geist] text-[#8a7a6a] uppercase tracking-widest">
            <span>Organisation / Project</span>
            <span>Started</span>
            <span>Ends</span>
            <span className="text-right">Overdue</span>
          </div>
          {sortedUninvoiced.map((opp, i) => {
            const days = opp.Start_Date_All__c ? daysAgo(opp.Start_Date_All__c) : 0;
            const age = ageLabel(days);
            return (
              <div
                key={opp.Id}
                className={`flex sm:grid sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 sm:gap-3 items-start sm:items-center px-4 py-3 text-sm font-[Geist] ${i > 0 ? 'border-t border-[#e8ddd0]' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#212122] text-xs sm:text-sm truncate">{opp.Account?.Name ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <p className="text-xs text-[#8a7a6a] truncate">{opp.Name}</p>
                    {opp.Project_Code__c && (
                      <span className="text-xs font-mono text-[#8a7a6a] shrink-0">{opp.Project_Code__c}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-[#8a7a6a] whitespace-nowrap hidden sm:block">{fmtDate(opp.Start_Date_All__c)}</p>
                <p className="text-xs text-[#8a7a6a] whitespace-nowrap hidden sm:block">{fmtDate(opp.End_DateAll__c)}</p>
                <p className={`text-xs font-medium whitespace-nowrap shrink-0 ${age.cls}`}>{age.text}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Mismatches expansion */}
      {open === 'mismatches' && (
        <div className="mt-4 rounded-xl border border-[#e8ddd0] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-[#f5ebe0] text-xs font-[Geist] text-[#8a7a6a] uppercase tracking-widest">
            <span>Organisation / Project</span>
            <span className="text-right">Opp amount</span>
            <span className="text-right">Order amount</span>
            <span className="text-right">Difference</span>
          </div>
          {mismatches.map((m, i) => {
            const diff = m.orderAmount - m.oppAmount;
            return (
              <div
                key={m.oppId}
                className={`flex sm:grid sm:grid-cols-[2fr_1fr_1fr_auto] gap-2 sm:gap-3 items-start sm:items-center px-4 py-3 text-sm font-[Geist] ${i > 0 ? 'border-t border-[#e8ddd0]' : ''}`}
              >
                <div className="min-w-0">
                  <p className="font-medium text-[#212122] text-xs sm:text-sm truncate">{m.orgName}</p>
                  <p className="text-xs text-[#8a7a6a] truncate mt-0.5">{m.oppName}</p>
                </div>
                <p className="text-xs text-right text-[#212122] hidden sm:block">{fmtFull(m.oppAmount)}</p>
                <p className="text-xs text-right text-[#212122] hidden sm:block">{fmtFull(m.orderAmount)}</p>
                <p className={`text-xs text-right font-medium whitespace-nowrap shrink-0 ${diff < 0 ? 'text-[#b83020]' : 'text-[#195e47]'}`}>
                  {diff >= 0 ? '+' : ''}{fmtFull(diff)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
