import {
  getAdvisoryOpportunities,
  getProgrammeOpportunities,
  getPartnerAccounts,
} from '@/lib/salesforce';
import {
  OrganisationAccount,
  OrganisationSummary,
  OrganisationsData,
  ProgrammeOpportunity,
  SectorSummary,
} from '@/types';

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

  const advPot = account?.Advisory_Potential__c    ?? null;
  const advPct = account?.Advisory_Potential_Percent__c ?? null;
  const prgPot = account?.Programme_Potential__c   ?? null;
  const prgPct = account?.Programme_Potential_Percent__c ?? null;

  const advWeighted = advPot !== null && advPct !== null ? advPot * (advPct / 100) : null;
  const prgWeighted = prgPot !== null && prgPct !== null ? prgPot * (prgPct / 100) : null;

  const totalPotential = (advPot !== null || prgPot !== null)
    ? (advPot ?? 0) + (prgPot ?? 0) : null;
  const totalWeighted = (advWeighted !== null || prgWeighted !== null)
    ? (advWeighted ?? 0) + (prgWeighted ?? 0) : null;

  const summary: OrganisationSummary = {
    accountId,
    name: account?.Name ?? name,
    sector,
    advisoryConfirmed:     0,
    advisoryExpected:      0,
    advisoryPipeline:      0,
    advisoryPotential:     advPot,
    advisoryPotentialPct:  advPct,
    advisoryWeighted:      advWeighted,
    programmesConfirmed:   0,
    programmesExpected:    0,
    programmesPipeline:    0,
    programmePotential:    prgPot,
    programmePotentialPct: prgPct,
    programmeWeighted:     prgWeighted,
    combinedConfirmed:     0,
    combinedExpected:      0,
    totalPotential,
    totalWeighted,
  };
  map.set(accountId, summary);
  return summary;
}

function buildSectors(orgs: OrganisationSummary[]): SectorSummary[] {
  const map = new Map<string, SectorSummary>();

  for (const org of orgs) {
    const s = org.sector;
    if (!map.has(s)) {
      map.set(s, {
        sector: s,
        advisoryConfirmed: 0,  advisoryExpected:   0,
        programmeConfirmed: 0, programmeExpected:  0,
        combinedConfirmed: 0,  combinedExpected:   0,
        advisoryPotential: 0,  advisoryWeighted:   0,
        programmePotential: 0, programmeWeighted:  0,
        totalPotential: 0,     totalWeighted:      0,
      });
    }
    const sec = map.get(s)!;
    sec.advisoryConfirmed  += org.advisoryConfirmed;
    sec.advisoryExpected   += org.advisoryExpected;
    sec.programmeConfirmed += org.programmesConfirmed;
    sec.programmeExpected  += org.programmesExpected;
    sec.combinedConfirmed  += org.combinedConfirmed;
    sec.combinedExpected   += org.combinedExpected;
    sec.advisoryPotential  += org.advisoryPotential  ?? 0;
    sec.advisoryWeighted   += org.advisoryWeighted   ?? 0;
    sec.programmePotential += org.programmePotential ?? 0;
    sec.programmeWeighted  += org.programmeWeighted  ?? 0;
    sec.totalPotential     += org.totalPotential     ?? 0;
    sec.totalWeighted      += org.totalWeighted      ?? 0;
  }

  // Consistent sector order: Private, Public, Social, then others alpha
  const ORDER = ['Private', 'Public', 'Social'];
  return [...map.values()].sort((a, b) => {
    const ai = ORDER.indexOf(a.sector), bi = ORDER.indexOf(b.sector);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.sector.localeCompare(b.sector);
  });
}

export async function buildOrganisationsData(): Promise<OrganisationsData> {
  const [advisoryOpps, rawProgrammeOpps] = await Promise.all([
    getAdvisoryOpportunities(),
    getProgrammeOpportunities(),
  ]);

  const programmeOpps = rawProgrammeOpps.filter(
    o => !(o.Programme__r?.Name ?? '').includes('Advisory Practice') && !isOldFellowship(o)
  );

  const accountIdSet = new Set<string>();
  for (const o of advisoryOpps)  if (o.Account?.Id) accountIdSet.add(o.Account.Id);
  for (const o of programmeOpps) if (o.Account?.Id) accountIdSet.add(o.Account.Id);

  const accounts   = await getPartnerAccounts([...accountIdSet]);
  const accountMap = new Map<string, OrganisationAccount>(accounts.map(a => [a.Id, a]));
  const orgMap     = new Map<string, OrganisationSummary>();

  for (const opp of advisoryOpps) {
    if (!opp.Account?.Id) continue;
    const org = getOrCreate(orgMap, opp.Account.Id, opp.Account.Name,
      opp.Organisation_Sector__c ?? 'Unknown', accountMap.get(opp.Account.Id));
    const amount = opp.Amount ?? 0;
    if (opp.StageName === 'Confirmed') {
      org.advisoryConfirmed += amount;
    } else if (opp.StageName !== 'Opportunity lost') {
      const prob = (opp.Probability ?? 0) / 100;
      org.advisoryExpected += amount * prob;
      org.advisoryPipeline += amount * (1 - prob);
    }
  }

  for (const opp of programmeOpps) {
    if (!opp.Account?.Id) continue;
    const org = getOrCreate(orgMap, opp.Account.Id, opp.Account.Name,
      opp.Organisation_Sector__c ?? 'Unknown', accountMap.get(opp.Account.Id));
    const amount = opp.Amount ?? 0;
    if (opp.StageName === 'Confirmed') {
      org.programmesConfirmed += amount;
    } else if (opp.StageName !== 'Opportunity lost') {
      const prob = (opp.Probability ?? 0) / 100;
      org.programmesExpected += amount * prob;
      org.programmesPipeline += amount * (1 - prob);
    }
  }

  for (const org of orgMap.values()) {
    org.combinedConfirmed = org.advisoryConfirmed + org.programmesConfirmed;
    org.combinedExpected  = org.advisoryExpected  + org.programmesExpected;
  }

  const organisations = [...orgMap.values()].sort(
    (a, b) => b.combinedConfirmed - a.combinedConfirmed
  );

  return {
    organisations,
    sectors: buildSectors(organisations),
    lastUpdated: new Date().toISOString(),
  };
}
