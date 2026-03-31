'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { OrganisationsData, OrganisationSummary } from '@/types';

interface Props { data: OrganisationsData }

type Tab = 'organisations' | 'sectors';

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
    <span className="px-2 py-0.5 rounded-full text-xs font-[Geist] whitespace-nowrap"
          style={{ backgroundColor: bg, color: text }}>
      {sector}
    </span>
  );
}

function ProgressBar({ confirmed, target, realistic }: { confirmed: number; target: number | null; realistic: number | null }) {
  if (!target) return <span className="text-xs text-[#8a7a6a] font-[Geist]">No target set</span>;
  const pct = Math.min((confirmed / target) * 100, 100);
  const realPct = realistic ? Math.min((realistic / target) * 100, 100) : null;
  return (
    <div className="w-full">
      <div className="relative h-2 bg-[#e8ddd0] rounded-full overflow-visible w-full min-w-[80px]">
        {/* Realistic target marker */}
        {realPct !== null && (
          <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-[#dd6945] rounded-full z-10"
               style={{ left: `${realPct}%` }} title={`Realistic: ${fmt(realistic!)}`} />
        )}
        {/* Confirmed fill */}
        <div className="h-full rounded-full bg-[#195e47] transition-all"
             style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-[#8a7a6a] font-[Geist] mt-0.5">
        {fmt(confirmed)} of {fmt(target)}
        {realistic && <span className="text-[#dd6945]"> · {fmt(realistic)} realistic</span>}
      </p>
    </div>
  );
}

// ── Sector summary ────────────────────────────────────────────────────────────

interface SectorRow {
  sector: string;
  orgs: OrganisationSummary[];
  confirmed: number;
  expected: number;
  pipeline: number;
  target: number | null;
  realistic: number | null;
}

function buildSectorRows(orgs: OrganisationSummary[]): SectorRow[] {
  const map = new Map<string, SectorRow>();
  for (const org of orgs) {
    const s = org.sector;
    if (!map.has(s)) {
      map.set(s, { sector: s, orgs: [], confirmed: 0, expected: 0, pipeline: 0, target: null, realistic: null });
    }
    const row = map.get(s)!;
    row.orgs.push(org);
    row.confirmed += org.combinedConfirmed;
    row.expected  += org.combinedExpected;
    row.pipeline  += (org.advisoryPipeline + org.programmesPipeline);
    if (org.totalPotential !== null) row.target   = (row.target   ?? 0) + org.totalPotential;
    if (org.totalWeighted  !== null) row.realistic = (row.realistic ?? 0) + org.totalWeighted;
  }
  return [...map.values()].sort((a, b) => b.confirmed - a.confirmed);
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function OrganisationsTable({ data }: Props) {
  const { organisations } = data;

  type SortKey = 'name' | 'confirmed' | 'expected' | 'target';

  const [tab, setTab]               = useState<Tab>('organisations');
  const [activeSector, setActiveSector] = useState<string | null>(null);
  const [expandedSectors, setExpandedSectors] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey]       = useState<SortKey>('confirmed');

  const sectorRows = useMemo(() => buildSectorRows(organisations), [organisations]);

  const displayedOrgs = useMemo(() => {
    const filtered = activeSector
      ? organisations.filter(o => o.sector === activeSector)
      : organisations;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name')      return a.name.localeCompare(b.name);
      if (sortKey === 'confirmed') return b.combinedConfirmed - a.combinedConfirmed;
      if (sortKey === 'expected')  return b.combinedExpected  - a.combinedExpected;
      if (sortKey === 'target') {
        const ta = a.totalPotential ?? -1;
        const tb = b.totalPotential ?? -1;
        return tb - ta;
      }
      return 0;
    });
  }, [organisations, sortKey, activeSector]);

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => setSortKey(k)}
      className={`text-xs font-[Geist] transition-colors ${
        sortKey === k ? 'text-[#212122] font-semibold' : 'text-[#8a7a6a] hover:text-[#212122]'
      }`}>
      {label}{sortKey === k ? ' ↓' : ''}
    </button>
  );

  const toggleSector = (sector: string) => {
    setExpandedSectors(prev => {
      const next = new Set(prev);
      next.has(sector) ? next.delete(sector) : next.add(sector);
      return next;
    });
  };

  return (
    <div className="fi-card space-y-6">

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[#e8ddd0] pb-4">
        {(['organisations', 'sectors'] as Tab[]).map(t => (
          <button key={t}
            onClick={() => { setTab(t); setActiveSector(null); }}
            className={`px-4 py-1.5 rounded-full text-sm font-[Geist] border transition-colors capitalize ${
              tab === t
                ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
                : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'
            }`}>
            By {t === 'organisations' ? 'Organisation' : 'Sector'}
          </button>
        ))}
      </div>

      {/* ── BY ORGANISATION ──────────────────────────────────────────────────── */}
      {tab === 'organisations' && (
        <div>
          {/* Sector filter pills */}
          <div className="flex items-center flex-wrap gap-2 mb-4">
            <span className="text-xs text-[#8a7a6a] font-[Geist]">Filter:</span>
            <button
              onClick={() => setActiveSector(null)}
              className={`px-3 py-1 rounded-full text-xs font-[Geist] border transition-colors ${
                !activeSector ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]' : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'
              }`}>
              All
            </button>
            {sectorRows.map(s => (
              <button key={s.sector}
                onClick={() => setActiveSector(activeSector === s.sector ? null : s.sector)}
                className={`px-3 py-1 rounded-full text-xs font-[Geist] border transition-colors ${
                  activeSector === s.sector
                    ? 'bg-[#212122] text-[#fcf2e3] border-[#212122]'
                    : 'text-[#8a7a6a] border-[#e8ddd0] hover:bg-[#f5ebe0]'
                }`}>
                {s.sector}
              </button>
            ))}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-3 mb-3 text-xs text-[#8a7a6a] font-[Geist]">
            <span>Sort:</span>
            <SortButton k="confirmed" label="Confirmed" />
            <SortButton k="expected"  label="Expected" />
            <SortButton k="target"    label="Target" />
            <SortButton k="name"      label="Name" />
          </div>

          {/* Table */}
          <div className="space-y-2">
            {displayedOrgs.map(org => (
              <Link key={org.accountId} href={`/organisations/${org.accountId}`}
                    className="block rounded-xl border border-[#e8ddd0] bg-white hover:border-[#195e47] hover:bg-[#f9f5ef] transition-colors p-4">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">

                  {/* Left: name + sector */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[#212122] font-[Geist] text-sm truncate">
                        {org.name}
                      </span>
                      <SectorBadge sector={org.sector} />
                    </div>
                    <ProgressBar
                      confirmed={org.combinedConfirmed}
                      target={org.totalPotential}
                      realistic={org.totalWeighted}
                    />
                  </div>

                  {/* Right: income breakdown */}
                  <div className="flex items-center gap-4 text-right shrink-0">
                    <div>
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Advisory</p>
                      <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(org.advisoryConfirmed)}</p>
                      {org.advisoryExpected > 0 && (
                        <p className="text-xs text-[#85d1e3] font-[Geist]">+{fmt(org.advisoryExpected)} exp</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Programmes</p>
                      <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(org.programmesConfirmed)}</p>
                      {org.programmesExpected > 0 && (
                        <p className="text-xs text-[#85d1e3] font-[Geist]">+{fmt(org.programmesExpected)} exp</p>
                      )}
                    </div>
                    <div className="border-l border-[#e8ddd0] pl-4">
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Total</p>
                      <p className="text-sm font-bold text-[#212122] font-[Geist]">{fmt(org.combinedConfirmed)}</p>
                      {org.combinedExpected > 0 && (
                        <p className="text-xs text-[#85d1e3] font-[Geist]">+{fmt(org.combinedExpected)} exp</p>
                      )}
                    </div>
                  </div>

                </div>
              </Link>
            ))}

            {displayedOrgs.length === 0 && (
              <p className="text-center text-[#8a7a6a] font-[Geist] py-8 text-sm">
                No organisations found{activeSector ? ` in ${activeSector} sector` : ''}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── BY SECTOR ────────────────────────────────────────────────────────── */}
      {tab === 'sectors' && (
        <div className="space-y-3">
          {sectorRows.map(row => {
            const isExpanded = expandedSectors.has(row.sector);
            return (
              <div key={row.sector} className="rounded-xl border border-[#e8ddd0] overflow-hidden">

                {/* Sector header row */}
                <button
                  onClick={() => toggleSector(row.sector)}
                  className="w-full flex items-center justify-between p-4 bg-white hover:bg-[#f9f5ef] transition-colors text-left">
                  <div className="flex items-center gap-3">
                    <SectorBadge sector={row.sector} />
                    <span className="text-sm text-[#8a7a6a] font-[Geist]">
                      {row.orgs.length} organisation{row.orgs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Advisory</p>
                      <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(row.orgs.reduce((s,o) => s + o.advisoryConfirmed, 0))}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Programmes</p>
                      <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(row.orgs.reduce((s,o) => s + o.programmesConfirmed, 0))}</p>
                    </div>
                    <div className="border-l border-[#e8ddd0] pl-4 min-w-[80px]">
                      <p className="text-[10px] text-[#8a7a6a] font-[Geist] uppercase tracking-wide">Confirmed</p>
                      <p className="text-sm font-bold text-[#212122] font-[Geist]">{fmt(row.confirmed)}</p>
                      {row.expected > 0 && (
                        <p className="text-xs text-[#85d1e3] font-[Geist]">+{fmt(row.expected)} exp</p>
                      )}
                    </div>
                    <span className="text-[#8a7a6a] text-sm ml-2">{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* Expanded org list within sector */}
                {isExpanded && (
                  <div className="border-t border-[#e8ddd0] divide-y divide-[#f0e8dc]">
                    {row.orgs
                      .sort((a, b) => b.combinedConfirmed - a.combinedConfirmed)
                      .map(org => (
                        <Link key={org.accountId} href={`/organisations/${org.accountId}`}
                              className="flex items-center justify-between px-4 py-3 bg-[#fdf8f2] hover:bg-[#f5ebe0] transition-colors">
                          <span className="text-sm font-[Geist] text-[#212122]">{org.name}</span>
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-xs text-[#8a7a6a] font-[Geist]">Advisory</p>
                              <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(org.advisoryConfirmed)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#8a7a6a] font-[Geist]">Programmes</p>
                              <p className="text-sm font-semibold text-[#195e47] font-[Geist]">{fmt(org.programmesConfirmed)}</p>
                            </div>
                            <div className="border-l border-[#e8ddd0] pl-4 min-w-[70px]">
                              <p className="text-xs text-[#8a7a6a] font-[Geist]">Total</p>
                              <p className="text-sm font-bold text-[#212122] font-[Geist]">{fmt(org.combinedConfirmed)}</p>
                            </div>
                            <span className="text-[#8a7a6a] text-sm">→</span>
                          </div>
                        </Link>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-[#b0a090] font-[Geist] text-right">
        Last updated {new Date(data.lastUpdated).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        {' · '}Targets shown once SF fields are configured
      </p>
    </div>
  );
}
