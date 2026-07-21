'use client';

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { AdvisoryOpportunity, AdvisoryOrder } from '@/types';

interface Props {
  opportunities: AdvisoryOpportunity[];
  orders: AdvisoryOrder[];
  lastUpdated: string;
}

const STATUSES = ['Ready to Invoice', 'Invoice Sent', 'Partially Invoiced', 'Invoice Paid'] as const;
type StatusFilter = 'All' | typeof STATUSES[number] | 'No Order';
type SectorFilter = 'All' | 'Private' | 'Public' | 'Social';
type SortKey = 'start' | 'amount' | 'org';

const SECTORS: SectorFilter[] = ['Private', 'Public', 'Social'];

const STATUS_COLOURS: Record<string, { bg: string; text: string }> = {
  'Ready to Invoice':   { bg: 'bg-[#fff8e0]', text: 'text-[#b8860b]' },
  'Invoice Sent':       { bg: 'bg-[#e8f0ff]', text: 'text-[#3355cc]' },
  'Partially Invoiced': { bg: 'bg-[#fdf0ec]', text: 'text-[#dd6945]' },
  'Invoice Paid':       { bg: 'bg-[#e8f5f0]', text: 'text-[#195e47]' },
  'No Order':           { bg: 'bg-[#f5ebe0]', text: 'text-[#8a7a6a]' },
};

const FY_MONTHS = [
  { year: 2026, month: 2, label: 'Mar' },
  { year: 2026, month: 3, label: 'Apr' },
  { year: 2026, month: 4, label: 'May' },
  { year: 2026, month: 5, label: 'Jun' },
  { year: 2026, month: 6, label: 'Jul' },
  { year: 2026, month: 7, label: 'Aug' },
  { year: 2026, month: 8, label: 'Sep' },
  { year: 2026, month: 9, label: 'Oct' },
  { year: 2026, month: 10, label: 'Nov' },
  { year: 2026, month: 11, label: 'Dec' },
  { year: 2027, month: 0,  label: 'Jan' },
  { year: 2027, month: 1,  label: 'Feb' },
];

const FY_START = new Date('2026-03-01');
const FY_END   = new Date('2027-02-28');

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const fmtCompact = (n: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 0 }).format(n);

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : '—';

function overlapsCurrentFY(opp: AdvisoryOpportunity): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  return new Date(opp.Start_Date_All__c) <= FY_END && new Date(opp.End_DateAll__c) >= FY_START;
}

function orderCoversMonth(order: AdvisoryOrder, year: number, month: number): boolean {
  if (!order.Project_Start_Date__c || !order.Project_End_Date__c) return false;
  const s = new Date(order.Project_Start_Date__c);
  const e = new Date(order.Project_End_Date__c);
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  return s <= monthEnd && e >= monthStart;
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#e8ddd0] rounded-xl p-3 text-sm shadow-lg">
      <p className="font-bold text-[#212122] mb-2" style={{ fontFamily: 'Inria Serif, serif' }}>{label}</p>
      {payload.map((p: any) => (
        p.value > 0 && (
          <p key={p.name} className="flex justify-between gap-6 mb-0.5">
            <span style={{ color: p.color }}>{p.name}</span>
            <span className="font-medium text-[#212122]">{fmt(p.value)}</span>
          </p>
        )
      ))}
    </div>
  );
};

function oppCoversMonth(opp: AdvisoryOpportunity, year: number, month: number): boolean {
  if (!opp.Start_Date_All__c || !opp.End_DateAll__c) return false;
  const s = new Date(opp.Start_Date_All__c);
  const e = new Date(opp.End_DateAll__c);
  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month + 1, 0);
  return s <= monthEnd && e >= monthStart;
}

function monthlySlice(opp: AdvisoryOpportunity): number {
  if (!opp.Amount) return 0;
  const months = opp.Number_of_Months__c && opp.Number_of_Months__c > 0 ? opp.Number_of_Months__c : 1;
  return opp.Amount / months;
}

export default function AdvisoryFinanceTab({ opportunities, orders, lastUpdated }: Props) {
  const [sector, setSector]         = useState<SectorFilter>('All');
  const [status, setStatus]         = useState<StatusFilter>('All');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [sortKey, setSortKey]       = useState<SortKey>('start');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const today = new Date();
  const orderById = useMemo(() => new Map(orders.map(o => [o.Id, o])), [orders]);

  const rows = useMemo(() => {
    return opportunities
      .filter(opp => opp.StageName === 'Confirmed' && overlapsCurrentFY(opp))
      .map(opp => {
        const order = opp.Order__c ? orderById.get(opp.Order__c) : undefined;
        const hasStarted = opp.Start_Date_All__c ? new Date(opp.Start_Date_All__c) <= today : false;
        const invoiceCount = order?.Number_of_invoices__c ?? 0;
        const flagged = hasStarted && (!order || invoiceCount === 0);
        const orderStatus: string = order?.Status ?? 'No Order';
        return { opp, order, flagged, orderStatus, invoiceCount };
      });
  }, [opportunities, orderById]);

  const filtered = useMemo(() => {
    return rows
      .filter(r => sector === 'All' || (r.opp.Organisation_Sector__c ?? 'Other') === sector)
      .filter(r => status === 'All' || r.orderStatus === status)
      .filter(r => !flaggedOnly || r.flagged)
      .sort((a, b) => {
        if (sortKey === 'org')    return (a.opp.Account?.Name ?? '').localeCompare(b.opp.Account?.Name ?? '');
        if (sortKey === 'amount') return (b.opp.Amount ?? 0) - (a.opp.Amount ?? 0);
        return (a.opp.Start_Date_All__c ?? '') < (b.opp.Start_Date_All__c ?? '') ? -1 : 1;
      });
  }, [rows, sector, status, flaggedOnly, sortKey]);

  const totalWon      = filtered.reduce((s, r) => s + (r.order?.TotalAmount        ?? 0), 0);
  const totalInvoiced = filtered.reduce((s, r) => s + (r.order?.Invoiced_Amount__c ?? 0), 0);
  const totalPaid     = filtered.reduce((s, r) => s + (r.order?.Paid_Amount__c     ?? 0), 0);
  const totalRemain   = filtered.reduce((s, r) => s + (r.order?.Invoice_Amount_Remaining__c ?? 0), 0);
  const flagCount     = filtered.filter(r => r.flagged).length;

  const chartData = useMemo(() =>
    FY_MONTHS.map(({ year, month, label }) => {
      let won = 0, invoiced = 0, paid = 0;
      for (const { opp, order } of filtered) {
        if (oppCoversMonth(opp, year, month)) {
          won += monthlySlice(opp);
        }
        if (order && orderCoversMonth(order, year, month)) {
          invoiced += order.Monthly_Invoiced_Amount__c ?? 0;
          paid     += order.Paid_Amount_Per_Month__c   ?? 0;
        }
      }
      return { month: label, won, invoiced, paid };
    }),
  [filtered]);

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
            <p className="text-xl font-bold text-[#212122]" style={{ fontFamily: 'Inria Serif, serif' }}>{fmtCompact(value)}</p>
            <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Line chart */}
      <div className="fi-card">
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h3 className="font-bold text-[#212122] text-base" style={{ fontFamily: 'Inria Serif, serif' }}>
              Income, invoicing &amp; payment — FY 2026/27
            </h3>
            <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
              Monthly figures for the {filtered.length} project{filtered.length !== 1 ? 's' : ''} shown below
            </p>
          </div>
          <p className="text-xs text-[#8a7a6a] font-[Geist] shrink-0 mt-0.5">
            Data as of {new Date(lastUpdated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#e8ddd0" strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist' }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#8a7a6a', fontFamily: 'Geist' }} axisLine={false} tickLine={false} width={52} />
            <Tooltip content={<ChartTooltip />} />
            <Line type="monotone" dataKey="won"      name="Won (income recognition)" stroke="#195e47" strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4, fill: '#195e47', strokeWidth: 0 }} />
            <Line type="monotone" dataKey="invoiced" name="Invoiced"                 stroke="#dd6945" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#dd6945', strokeWidth: 0 }} />
            <Line type="monotone" dataKey="paid"     name="Paid"                     stroke="#85d1e3" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#85d1e3', strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 pt-3 border-t border-[#e8ddd0]">
          <span className="flex items-center gap-2 text-xs font-[Geist]">
            <span className="w-5 shrink-0" style={{ borderTop: '2px dashed #195e47', display: 'inline-block', marginTop: 1 }} />
            <span className="text-[#212122] font-medium">Won</span>
            <span className="text-[#8a7a6a]">— confirmed income recognised each month (prorated across delivery)</span>
          </span>
          <span className="flex items-center gap-2 text-xs font-[Geist]">
            <span className="w-5 shrink-0" style={{ borderTop: '2px solid #dd6945', display: 'inline-block', marginTop: 1 }} />
            <span className="text-[#212122] font-medium">Invoiced</span>
            <span className="text-[#8a7a6a]">— invoice amounts attributed to each delivery month</span>
          </span>
          <span className="flex items-center gap-2 text-xs font-[Geist]">
            <span className="w-5 shrink-0" style={{ borderTop: '2px solid #85d1e3', display: 'inline-block', marginTop: 1 }} />
            <span className="text-[#212122] font-medium">Paid</span>
            <span className="text-[#8a7a6a]">— cash received, attributed to each delivery month</span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Sector</span>
          {pill(sector === 'All', () => setSector('All'), 'All')}
          {SECTORS.map(s => pill(sector === s, () => setSector(s), s))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Status</span>
          {pill(status === 'All', () => setStatus('All'), 'All')}
          {([...STATUSES, 'No Order'] as StatusFilter[]).map(s => pill(status === s, () => setStatus(s), s))}
        </div>
        {flagCount > 0 && pill(flaggedOnly, () => setFlaggedOnly(v => !v), `⚑ Needs invoicing (${flagCount})`, true)}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest">Sort</span>
        {(['start', 'org', 'amount'] as SortKey[]).map(key =>
          pill(sortKey === key, () => setSortKey(key), key === 'start' ? 'Start date' : key === 'org' ? 'Organisation' : 'Amount'),
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
          <p className="px-4 py-6 text-sm text-center text-[#8a7a6a] font-[Geist]">No projects match the current filters.</p>
        )}

        {filtered.map(({ opp, order, flagged, orderStatus, invoiceCount }, i) => {
          const sc = STATUS_COLOURS[orderStatus] ?? STATUS_COLOURS['No Order'];
          const isExpanded = expandedId === opp.Id;
          const toggle = () => setExpandedId(isExpanded ? null : opp.Id);

          return (
            <div key={opp.Id} className={i > 0 ? 'border-t border-[#e8ddd0]' : ''}>
              {/* Desktop row */}
              <button
                onClick={toggle}
                className={`hidden sm:grid w-full grid-cols-[2fr_1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 text-sm font-[Geist] text-left transition-colors hover:bg-[#f5ebe0] ${flagged ? 'bg-[#fdf5f2] hover:bg-[#faeae6]' : ''} ${isExpanded ? 'bg-[#f5ebe0]' : ''}`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {flagged && <span className="text-[#dd6945] shrink-0 text-xs">⚑</span>}
                    <p className="font-medium text-[#212122] truncate">{opp.Account?.Name ?? '—'}</p>
                    {opp.Project_Code__c && (
                      <span className="text-xs font-mono text-[#8a7a6a] shrink-0">{opp.Project_Code__c}</span>
                    )}
                  </div>
                  <p className="text-xs text-[#8a7a6a] truncate mt-0.5">{opp.Name}</p>
                </div>
                <p className="text-xs text-[#8a7a6a] whitespace-nowrap">
                  {fmtDate(opp.Start_Date_All__c)} → {fmtDate(opp.End_DateAll__c)}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${sc.bg} ${sc.text}`}>{orderStatus}</span>
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
              </button>

              {/* Mobile row */}
              <button
                onClick={toggle}
                className={`sm:hidden w-full px-4 py-3 text-left transition-colors hover:bg-[#f5ebe0] ${flagged ? 'bg-[#fdf5f2]' : ''} ${isExpanded ? 'bg-[#f5ebe0]' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {flagged && <span className="text-[#dd6945] text-xs">⚑</span>}
                      <p className="font-medium text-[#212122] text-sm truncate">{opp.Account?.Name ?? '—'}</p>
                      {opp.Project_Code__c && (
                        <span className="text-xs font-mono text-[#8a7a6a] shrink-0">{opp.Project_Code__c}</span>
                      )}
                    </div>
                    <p className="text-xs text-[#8a7a6a] truncate">{opp.Name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 ${sc.bg} ${sc.text}`}>{orderStatus}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#8a7a6a] mt-1">
                  <span>{fmtDate(opp.Start_Date_All__c)} → {fmtDate(opp.End_DateAll__c)}</span>
                  {order && <><span>·</span><span>{invoiceCount} inv.</span><span>·</span><span className="text-[#212122]">{fmt(order.Invoiced_Amount__c ?? 0)} invoiced</span></>}
                </div>
              </button>

              {/* Expanded drill-down */}
              {isExpanded && (
                <div className="border-t border-[#e8ddd0] bg-[#faf5ee] px-4 sm:px-6 py-4 space-y-4">
                  {/* Project info */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Organisation</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">{opp.Account?.Name ?? '—'}</p>
                    </div>
                    {opp.Project_Code__c && (
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Project Code</p>
                        <p className="text-sm font-mono font-medium text-[#212122]">{opp.Project_Code__c}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Sector</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">{opp.Organisation_Sector__c ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Duration</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">
                        {opp.Number_of_Months__c ? `${opp.Number_of_Months__c} months` : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Start date</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">{fmtDate(opp.Start_Date_All__c)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">End date</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">{fmtDate(opp.End_DateAll__c)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Opp amount</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">{opp.Amount != null ? fmt(opp.Amount) : '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Monthly slice</p>
                      <p className="text-sm font-medium text-[#212122] font-[Geist]">
                        {opp.Amount && opp.Number_of_Months__c
                          ? fmt(opp.Amount / opp.Number_of_Months__c)
                          : '—'}
                        {' '}<span className="text-[#8a7a6a] font-normal">/mo</span>
                      </p>
                    </div>
                  </div>

                  {/* Order / invoicing info */}
                  {order ? (
                    <div className="border-t border-[#e8ddd0] pt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Order ref</p>
                        <p className="text-sm font-mono font-medium text-[#212122]">{order.Name}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Order status</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{order.Status}</span>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Order amount</p>
                        <p className="text-sm font-medium text-[#212122] font-[Geist]">{order.TotalAmount != null ? fmt(order.TotalAmount) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Invoices raised</p>
                        <p className={`text-sm font-medium font-[Geist] ${flagged ? 'text-[#dd6945]' : 'text-[#212122]'}`}>
                          {invoiceCount}
                          {flagged && <span className="ml-2 text-xs">⚑ none raised</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Invoiced</p>
                        <p className="text-sm font-medium text-[#212122] font-[Geist]">{order.Invoiced_Amount__c != null ? fmt(order.Invoiced_Amount__c) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Paid</p>
                        <p className="text-sm font-medium text-[#212122] font-[Geist]">{order.Paid_Amount__c != null ? fmt(order.Paid_Amount__c) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Remaining</p>
                        <p className="text-sm font-medium text-[#212122] font-[Geist]">{order.Invoice_Amount_Remaining__c != null ? fmt(order.Invoice_Amount_Remaining__c) : '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-widest mb-1">Monthly invoiced</p>
                        <p className="text-sm font-medium text-[#212122] font-[Geist]">
                          {order.Monthly_Invoiced_Amount__c != null ? fmt(order.Monthly_Invoiced_Amount__c) : '—'}
                          {' '}<span className="text-[#8a7a6a] font-normal">/mo</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-[#e8ddd0] pt-4">
                      <p className="text-sm text-[#dd6945] font-[Geist]">
                        ⚑ No order linked to this opportunity. Project has started with no order in place.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
