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

const STAGE_TILES = [
  {
    key: 'Ready to Invoice',
    label: 'Ready to Invoice',
    colours: 'border-[#e8ddd0] bg-[#faf5ee]',
    labelCls: 'text-[#8a7a6a]',
  },
  {
    key: 'Invoice Sent',
    label: 'Invoice Sent',
    colours: 'border-[#e8ddd0] bg-[#faf5ee]',
    labelCls: 'text-[#8a7a6a]',
  },
  {
    key: 'Partially Invoiced',
    label: 'Partially Invoiced',
    colours: 'border-[#e8ddd0] bg-[#faf5ee]',
    labelCls: 'text-[#8a7a6a]',
  },
  {
    key: 'Invoice Paid',
    label: 'Invoice Paid',
    colours: 'border-[#c8e6dc] bg-[#edf7f3]',
    labelCls: 'text-[#195e47]',
  },
] as const;

type OpenPanel = 'uninvoiced' | 'mismatches' | typeof STAGE_TILES[number]['key'];

export default function InvoicingSummary({ orders, mismatches, uninvoicedStarted }: Props) {
  const [open, setOpen] = useState<OpenPanel | null>(null);

  const toggle = (key: OpenPanel) =>
    setOpen(prev => prev === key ? null : key);

  const activeOrders = orders.filter(o => o.Status !== 'New');

  const stageGroups = STAGE_TILES.map(({ key, label, colours, labelCls }) => {
    const group = activeOrders.filter(o => o.Status === key)
      .sort((a, b) => (b.TotalAmount ?? 0) - (a.TotalAmount ?? 0));
    return { key, label, colours, labelCls, count: group.length, total: group.reduce((s, o) => s + (o.TotalAmount ?? 0), 0), orders: group };
  });

  const uninvoicedTotal = uninvoicedStarted.reduce((s, opp) => s + (opp.Amount ?? 0), 0);

  const sortedUninvoiced = [...uninvoicedStarted].sort((a, b) => {
    const da = a.Start_Date_All__c ? daysAgo(a.Start_Date_All__c) : 0;
    const db = b.Start_Date_All__c ? daysAgo(b.Start_Date_All__c) : 0;
    return db - da;
  });

  return (
    <div className="fi-card">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>
          Invoicing
        </h2>
        <p className="text-xs text-[#8a7a6a] font-[Geist]">{activeOrders.length} orders · see Finance tab for detail</p>
      </div>
      <p className="text-xs text-[#8a7a6a] font-[Geist] mb-4">
        Stages reflect the current status of every Advisory order in Salesforce. The no-invoice flag below is
        scoped to confirmed projects that have started within FY 2026/27 (1 Mar 2026 – 28 Feb 2027).
      </p>

      {/* Stage KPI tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <button
          onClick={() => toggle('uninvoiced')}
          disabled={uninvoicedStarted.length === 0}
          className={`text-left rounded-xl border px-4 py-3 transition-colors ${
            uninvoicedStarted.length === 0
              ? 'border-[#e8ddd0] bg-[#faf5ee] cursor-default'
              : open === 'uninvoiced'
                ? 'border-[#dd6945] bg-[#dd6945]'
                : 'border-[#f0d8d0] bg-[#fdf0ec] hover:bg-[#fbe4dc]'
          }`}
        >
          <p className={`text-xs font-[Geist] mb-1 flex items-center gap-1 ${
            uninvoicedStarted.length === 0 ? 'text-[#8a7a6a]' : open === 'uninvoiced' ? 'text-white' : 'text-[#dd6945]'
          }`}>
            {uninvoicedStarted.length > 0 && <span>⚑</span>}
            No Invoice Raised
          </p>
          <p className={`text-xl font-bold ${open === 'uninvoiced' ? 'text-white' : 'text-[#212122]'}`} style={{ fontFamily: 'Inria Serif, serif' }}>
            {uninvoicedStarted.length}
          </p>
          <p className={`text-xs font-[Geist] mt-0.5 ${open === 'uninvoiced' ? 'text-white/80' : 'text-[#8a7a6a]'}`}>{fmt(uninvoicedTotal)}</p>
        </button>

        {stageGroups.map(({ key, label, colours, labelCls, count, total }) => (
          <button
            key={key}
            onClick={() => toggle(key)}
            disabled={count === 0}
            className={`text-left rounded-xl border px-4 py-3 transition-colors ${
              count === 0
                ? `${colours} cursor-default`
                : open === key
                  ? 'border-[#212122] bg-[#212122]'
                  : `${colours} hover:brightness-95`
            }`}
          >
            <p className={`text-xs font-[Geist] mb-1 ${open === key ? 'text-white/80' : labelCls}`}>{label}</p>
            <p className={`text-xl font-bold ${open === key ? 'text-white' : 'text-[#212122]'}`} style={{ fontFamily: 'Inria Serif, serif' }}>
              {count}
            </p>
            <p className={`text-xs font-[Geist] mt-0.5 ${open === key ? 'text-white/80' : 'text-[#8a7a6a]'}`}>{fmt(total)}</p>
          </button>
        ))}
      </div>

      {/* Alert pills */}
      {mismatches.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
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

      {/* Stage expansion */}
      {stageGroups.map(({ key, orders: stageOrders }) => open === key && (
        <div key={key} className="mt-4 rounded-xl border border-[#e8ddd0] overflow-hidden">
          <div className="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr] gap-3 px-4 py-2 bg-[#f5ebe0] text-xs font-[Geist] text-[#8a7a6a] uppercase tracking-widest">
            <span>Order</span>
            <span className="text-right">Total</span>
            <span className="text-right">Invoiced</span>
            <span className="text-right">Paid</span>
          </div>
          {stageOrders.map((o, i) => (
            <div
              key={o.Id}
              className={`flex sm:grid sm:grid-cols-[2fr_1fr_1fr_1fr] gap-2 sm:gap-3 items-start sm:items-center px-4 py-3 text-sm font-[Geist] ${i > 0 ? 'border-t border-[#e8ddd0]' : ''}`}
            >
              <p className="font-medium text-[#212122] text-xs sm:text-sm truncate min-w-0">{o.Name}</p>
              <p className="text-xs text-right text-[#212122] hidden sm:block">{fmtFull(o.TotalAmount ?? 0)}</p>
              <p className="text-xs text-right text-[#212122] hidden sm:block">{fmtFull(o.Invoiced_Amount__c ?? 0)}</p>
              <p className="text-xs text-right text-[#212122] hidden sm:block">{fmtFull(o.Paid_Amount__c ?? 0)}</p>
            </div>
          ))}
        </div>
      ))}

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
