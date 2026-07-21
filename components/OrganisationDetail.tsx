'use client';

import { useState } from 'react';
import { AdvisoryOpportunity, AdvisoryOrder, OrganisationSummary, ProgrammeOpportunity } from '@/types';

interface Props {
  org: OrganisationSummary;
  advisoryOpps: AdvisoryOpportunity[];
  programmeOpps: ProgrammeOpportunity[];
  advisoryOrders?: AdvisoryOrder[];
}

type Stream = 'all' | 'advisory' | 'programmes';
type StageFilter = 'all' | 'confirmed' | 'open';

const fmt = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP',
    notation: 'compact', maximumFractionDigits: 0,
  }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('en-GB', {
    style: 'currency', currency: 'GBP', maximumFractionDigits: 0,
  }).format(n);

const SECTOR_COLOURS: Record<string, string> = {
  'Private': '#195e47',
  'Public':  '#85d1e3',
  'Social':  '#ffcc12',
};

function SectorBadge({ sector }: { sector: string }) {
  const bg = SECTOR_COLOURS[sector] ?? '#e8ddd0';
  const text = sector === 'Public' ? '#212122' : sector === 'Social' ? '#212122' : '#fcf2e3';
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-[Geist]"
          style={{ backgroundColor: bg, color: text }}>
      {sector}
    </span>
  );
}

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="fi-card !py-4 !px-5">
      <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-xl font-bold font-[Geist]" style={{ color: accent ?? '#212122' }}>{value}</p>
      {sub && <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">{sub}</p>}
    </div>
  );
}

function TargetBar({ confirmed, target, realistic, label }: {
  confirmed: number; target: number | null; realistic: number | null; label: string;
}) {
  if (!target && !confirmed) return null;
  const pct = target ? Math.min((confirmed / target) * 100, 100) : 0;
  const realPct = target && realistic ? Math.min((realistic / target) * 100, 100) : null;
  return (
    <div className="fi-card !py-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-[#212122] font-[Geist]">{label}</p>
        <p className="text-xs text-[#8a7a6a] font-[Geist]">
          {fmtFull(confirmed)} confirmed
          {target && <span> of {fmtFull(target)} target</span>}
        </p>
      </div>
      {target ? (
        <div className="relative h-3 bg-[#e8ddd0] rounded-full overflow-visible">
          {realPct !== null && (
            <div className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-[#dd6945] rounded-full z-10"
                 title={`Realistic target: ${fmtFull(realistic!)}`}
                 style={{ left: `${realPct}%` }} />
          )}
          <div className="h-full rounded-full bg-[#195e47]" style={{ width: `${pct}%` }} />
        </div>
      ) : (
        <p className="text-xs text-[#8a7a6a] font-[Geist] italic">No target set yet</p>
      )}
      {realistic && target && (
        <p className="text-xs text-[#dd6945] font-[Geist] mt-1">
          Realistic target: {fmtFull(realistic)}
        </p>
      )}
    </div>
  );
}

function OppRow({ name, amount, stage, programme, date, prob, costs, order }: {
  name: string; amount: number | null; stage: string;
  programme?: string; date?: string | null; prob?: number | null;
  costs?: number | null; order?: AdvisoryOrder | null;
}) {
  const isConfirmed = stage === 'Confirmed';
  const stageColour = isConfirmed ? '#195e47' : '#85d1e3';
  const stageBg     = isConfirmed ? '#e8f5f0' : '#e8f5fa';
  const hasFinance = costs || order?.Invoiced_Amount__c || order?.Invoice_Amount_Remaining__c;
  return (
    <div className="py-3 border-b border-[#f0e8dc] last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-[#212122] font-[Geist] truncate">{name}</p>
          {programme && <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5 truncate">{programme}</p>}
          {date && <p className="text-xs text-[#b0a090] font-[Geist]">{date}</p>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {prob !== null && prob !== undefined && !isConfirmed && (
            <span className="text-xs text-[#8a7a6a] font-[Geist]">{Math.round(prob)}%</span>
          )}
          <span className="px-2 py-0.5 rounded-full text-xs font-[Geist] whitespace-nowrap"
                style={{ backgroundColor: stageBg, color: stageColour }}>
            {stage}
          </span>
          <span className="text-sm font-semibold font-[Geist] text-[#212122] min-w-[80px] text-right">
            {amount !== null ? fmtFull(amount) : '—'}
          </span>
        </div>
      </div>
      {hasFinance && (
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5">
          {costs != null && (
            <span className="text-xs text-[#8a7a6a] font-[Geist]">
              Costs <span className="text-[#212122]">{fmtFull(costs)}</span>
            </span>
          )}
          {order?.Invoiced_Amount__c != null && (
            <span className="text-xs text-[#8a7a6a] font-[Geist]">
              Invoiced <span className="text-[#212122]">{fmtFull(order.Invoiced_Amount__c)}</span>
              {order.Number_of_invoices__c != null && (
                <span className="text-[#b0a090]"> ({order.Number_of_invoices__c} inv)</span>
              )}
            </span>
          )}
          {order?.Invoice_Amount_Remaining__c != null && (
            <span className="text-xs text-[#8a7a6a] font-[Geist]">
              Remaining <span className="text-[#212122]">{fmtFull(order.Invoice_Amount_Remaining__c)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrganisationDetail({ org, advisoryOpps, programmeOpps, advisoryOrders = [] }: Props) {
  const [stream, setStream] = useState<Stream>('all');
  const [stageFilter, setStageFilter] = useState<StageFilter>('all');

  const orderByOppId = new Map<string, AdvisoryOrder>(
    advisoryOrders.filter(o => o.OpportunityId).map(o => [o.OpportunityId!, o])
  );

  const filteredAdvisory = advisoryOpps.filter(o =>
    stageFilter === 'all' ? true :
    stageFilter === 'confirmed' ? o.StageName === 'Confirmed' :
    o.StageName !== 'Confirmed' && o.StageName !== 'Opportunity lost'
  );

  const filteredProgrammes = programmeOpps.filter(o =>
    stageFilter === 'all' ? true :
    stageFilter === 'confirmed' ? o.StageName === 'Confirmed' :
    o.StageName !== 'Confirmed' && o.StageName !== 'Opportunity lost'
  );

  const showAdvisory   = stream === 'all' || stream === 'advisory';
  const showProgrammes = stream === 'all' || stream === 'programmes';

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="fi-card">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-[#212122]"
                style={{ fontFamily: 'Inria Serif, serif' }}>
              {org.name}
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <SectorBadge sector={org.sector} />
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#195e47] font-[Geist]">
              {fmtFull(org.combinedConfirmed)}
            </p>
            <p className="text-xs text-[#8a7a6a] font-[Geist]">total confirmed income</p>
            {org.combinedExpected > 0 && (
              <p className="text-sm text-[#85d1e3] font-[Geist]">
                +{fmtFull(org.combinedExpected)} expected
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Target progress bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fi-card !py-4">
          <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-2">Advisory</p>
          <p className="text-xl font-bold text-[#195e47] font-[Geist]">{fmtFull(org.advisoryConfirmed)}</p>
          {org.advisoryPotential ? (
            <>
              <div className="relative h-2 bg-[#e8ddd0] rounded-full overflow-visible mt-2">
                {org.advisoryWeighted && (
                  <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-[#dd6945] rounded-full z-10"
                       style={{ left: `${Math.min((org.advisoryWeighted / org.advisoryPotential) * 100, 100)}%` }} />
                )}
                <div className="h-full rounded-full bg-[#195e47]"
                     style={{ width: `${Math.min((org.advisoryConfirmed / org.advisoryPotential) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-1">of {fmtFull(org.advisoryPotential)} potential</p>
              {org.advisoryWeighted && <p className="text-xs text-[#dd6945] font-[Geist]">{fmtFull(org.advisoryWeighted)} weighted</p>}
            </>
          ) : <p className="text-xs text-[#b0a090] font-[Geist] mt-1 italic">No potential set</p>}
        </div>

        <div className="fi-card !py-4">
          <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-2">Programmes</p>
          <p className="text-xl font-bold text-[#195e47] font-[Geist]">{fmtFull(org.programmesConfirmed)}</p>
          {org.programmePotential ? (
            <>
              <div className="relative h-2 bg-[#e8ddd0] rounded-full overflow-visible mt-2">
                {org.programmeWeighted && (
                  <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-[#dd6945] rounded-full z-10"
                       style={{ left: `${Math.min((org.programmeWeighted / org.programmePotential) * 100, 100)}%` }} />
                )}
                <div className="h-full rounded-full bg-[#195e47]"
                     style={{ width: `${Math.min((org.programmesConfirmed / org.programmePotential) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-1">of {fmtFull(org.programmePotential)} potential</p>
              {org.programmeWeighted && <p className="text-xs text-[#dd6945] font-[Geist]">{fmtFull(org.programmeWeighted)} weighted</p>}
            </>
          ) : <p className="text-xs text-[#b0a090] font-[Geist] mt-1 italic">No potential set</p>}
        </div>

        <div className="fi-card !py-4 border-[#195e47]">
          <p className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-2">Combined</p>
          <p className="text-xl font-bold text-[#212122] font-[Geist]">{fmtFull(org.combinedConfirmed)}</p>
          {org.totalPotential ? (
            <>
              <div className="relative h-2 bg-[#e8ddd0] rounded-full overflow-visible mt-2">
                {org.totalWeighted && (
                  <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-[#dd6945] rounded-full z-10"
                       style={{ left: `${Math.min((org.totalWeighted / org.totalPotential) * 100, 100)}%` }} />
                )}
                <div className="h-full rounded-full bg-[#212122]"
                     style={{ width: `${Math.min((org.combinedConfirmed / org.totalPotential) * 100, 100)}%` }} />
              </div>
              <p className="text-xs text-[#8a7a6a] font-[Geist] mt-1">of {fmtFull(org.totalPotential)} potential</p>
              {org.totalWeighted && <p className="text-xs text-[#dd6945] font-[Geist]">{fmtFull(org.totalWeighted)} weighted</p>}
            </>
          ) : <p className="text-xs text-[#b0a090] font-[Geist] mt-1 italic">No potential set</p>}
        </div>
      </div>

      {/* Opportunity list */}
      <div className="fi-card">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <h2 className="text-lg font-bold text-[#212122]"
              style={{ fontFamily: 'Inria Serif, serif' }}>
            Opportunities
          </h2>
          <div className="flex items-center flex-wrap gap-2">
            {/* Stream filter */}
            <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
              {(['all', 'advisory', 'programmes'] as Stream[]).map(s => (
                <button key={s}
                  onClick={() => setStream(s)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    stream === s ? 'bg-[#212122] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'
                  }`}>
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
            {/* Stage filter */}
            <div className="flex rounded-lg border border-[#e8ddd0] overflow-hidden text-xs font-[Geist]">
              {(['all', 'confirmed', 'open'] as StageFilter[]).map(s => (
                <button key={s}
                  onClick={() => setStageFilter(s)}
                  className={`px-3 py-1.5 capitalize transition-colors ${
                    stageFilter === s ? 'bg-[#195e47] text-[#fcf2e3]' : 'text-[#8a7a6a] hover:bg-[#f5ebe0]'
                  }`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Advisory opps */}
        {showAdvisory && filteredAdvisory.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-2">
              Advisory · {filteredAdvisory.length} opp{filteredAdvisory.length !== 1 ? 's' : ''}
              {' · '}{fmtFull(filteredAdvisory.reduce((s, o) => s + (o.Amount ?? 0), 0))}
            </h3>
            {filteredAdvisory.map(opp => (
              <OppRow
                key={opp.Id}
                name={opp.Name}
                amount={opp.Amount}
                stage={opp.StageName}
                programme={opp.Programme__r?.Name}
                date={opp.Start_Date_All__c
                  ? `${opp.Start_Date_All__c.slice(0,7)} – ${opp.End_DateAll__c?.slice(0,7) ?? '?'}`
                  : undefined}
                prob={opp.Probability}
                costs={opp.Costs__c}
                order={orderByOppId.get(opp.Id)}
              />
            ))}
          </div>
        )}

        {/* Programme opps */}
        {showProgrammes && filteredProgrammes.length > 0 && (
          <div>
            <h3 className="text-xs text-[#8a7a6a] font-[Geist] uppercase tracking-wide mb-2">
              Programmes · {filteredProgrammes.length} opp{filteredProgrammes.length !== 1 ? 's' : ''}
              {' · '}{fmtFull(filteredProgrammes.reduce((s, o) => s + (o.Amount ?? 0), 0))}
            </h3>
            {filteredProgrammes.map(opp => (
              <OppRow
                key={opp.Id}
                name={opp.Name}
                amount={opp.Amount}
                stage={opp.StageName}
                programme={opp.Programme__r?.Name}
                date={opp.CloseDate ?? undefined}
                prob={opp.Probability}
              />
            ))}
          </div>
        )}

        {showAdvisory && filteredAdvisory.length === 0 && showProgrammes && filteredProgrammes.length === 0 && (
          <p className="text-center text-[#8a7a6a] font-[Geist] py-8 text-sm">
            No opportunities match the current filters.
          </p>
        )}
      </div>
    </div>
  );
}
