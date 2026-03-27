import {
  getAdvisoryOpportunities,
  getProgrammeOpportunities,
  getPartnerAccounts,
} from '@/lib/salesforce';
import {
  AdvisoryOpportunity,
  OrganisationAccount,
  OrganisationSummary,
  OrganisationsData,
  ProgrammeOpportunity,
} from '@/types';

// Reuse the same old-fellowship filter as programmes.ts
function isOldFellowship(o: ProgrammeOpportunity): boolean {
  const name = (o.Programme__r?.Name ?? '').toLowerCase();
  return name.includes('fellowship') && !name.includes('fellowship programme 2026');
}

function getOrCreate(
  map: Map<string, OrganisationSummary>,
  accountId: string,
  name: string,
  sector: string,
  account: OrganisationAccount | undefined
): OrganisationSummary {
  if (map.has(accountId)) return map.get(accountId)!;

  const pct    = account?.Realistic_Target_Pct__c ?? null;
  const advTgt = account?.Advisory_FY_Target__c   ?? null;
  const prgTgt = account?.Programmes_FY_Target__c  ?? null;

  const advReal = advTgt !== null && pct !== null ? advTgt * (pct / 100) : null;
  const prgReal = prgTgt !== null && pct !== null ? prgTgt * (pct / 100) : null;
  const comTgt  = advTgt !== null || prgTgt !== null
    ? (advTgt ?? 0) + (prgTgt ?? 0) : null;
  const comReal = advReal !== null || prgReal !== null
    ? (advReal ?? 0) + (prgReal ?? 0) : null;

  const summary: OrganisationSummary = {
    accountId,
    name: account?.Name ?? name,
    sector,
    realisticPct: pct,
    advisoryTarget: advTgt,
    advisoryRealisticTarget: advReal,
    advisoryConfirmed: 0,
    advisoryExpected: 0,
    advisoryPipeline: 0,
    programmesTarget: prgTgt,
    programmesRealisticTarget: prgReal,
    programmesConfirmed: 0,
    programmesExpected: 0,
    programmesPipeline: 0,
    combinedTarget: comTgt,
    combinedRealisticTarget: comReal,
    combinedConfirmed: 0,
    combinedExpected: 0,
  };
  map.set(accountId, summary);
  return summary;
}

export async function buildOrganisationsData(): Promise<OrganisationsData> {
  // Fetch in parallel — we already have these queries wired up
  const [advisoryOpps, rawProgrammeOpps] = await Promise.all([
    getAdvisoryOpportunities(),
    getProgrammeOpportunities(),
  ]);

  // Apply same programme filters as lib/programmes.ts
  const programmeOpps = rawProgrammeOpps.filter(
    o => !(o.Programme__r?.Name ?? '').includes('Advisory Practice') && !isOldFellowship(o)
  );

  // Collect unique account IDs across both streams
  const accountIdSet = new Set<string>();
  for (const o of advisoryOpps)   if (o.Account?.Id) accountIdSet.add(o.Account.Id);
  for (const o of programmeOpps)  if (o.Account?.Id) accountIdSet.add(o.Account.Id);

  // Fetch Account records (target fields when available — see salesforce.ts TODO)
  const accounts = await getPartnerAccounts([...accountIdSet]);
  const accountMap = new Map<string, OrganisationAccount>(accounts.map(a => [a.Id, a]));

  const orgMap = new Map<string, OrganisationSummary>();

  // ── Advisory opps ─────────────────────────────────────────────────────────
  for (const opp of advisoryOpps) {
    if (!opp.Account?.Id) continue;
    const org = getOrCreate(
      orgMap,
      opp.Account.Id,
      opp.Account.Name,
      opp.Organisation_Sector__c ?? 'Unknown',
      accountMap.get(opp.Account.Id)
    );
    const amount = opp.Amount ?? 0;
    if (opp.StageName === 'Confirmed') {
      org.advisoryConfirmed += amount;
    } else if (opp.StageName !== 'Opportunity lost') {
      const prob = (opp.Probability ?? 0) / 100;
      org.advisoryExpected += amount * prob;
      org.advisoryPipeline += amount * (1 - prob);
    }
  }

  // ── Programme opps ────────────────────────────────────────────────────────
  for (const opp of programmeOpps) {
    if (!opp.Account?.Id) continue;
    const org = getOrCreate(
      orgMap,
      opp.Account.Id,
      opp.Account.Name,
      opp.Organisation_Sector__c ?? 'Unknown',
      accountMap.get(opp.Account.Id)
    );
    const amount = opp.Amount ?? 0;
    if (opp.StageName === 'Confirmed') {
      org.programmesConfirmed += amount;
    } else if (opp.StageName !== 'Opportunity lost') {
      const prob = (opp.Probability ?? 0) / 100;
      org.programmesExpected += amount * prob;
      org.programmesPipeline += amount * (1 - prob);
    }
  }

  // ── Combined totals ───────────────────────────────────────────────────────
  for (const org of orgMap.values()) {
    org.combinedConfirmed = org.advisoryConfirmed + org.programmesConfirmed;
    org.combinedExpected  = org.advisoryExpected  + org.programmesExpected;
  }

  // Sort by total confirmed desc
  const organisations = [...orgMap.values()].sort(
    (a, b) => b.combinedConfirmed - a.combinedConfirmed
  );

  return { organisations, lastUpdated: new Date().toISOString() };
}
