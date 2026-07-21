import { AdvisoryOpportunity, AdvisoryOrder, FellowshipHistoryOpp, FellowshipOpportunity, OrganisationAccount, ProgrammeFinanceRecord, ProgrammeOpportunity } from '@/types';

const SF_INSTANCE_URL = process.env.SF_INSTANCE_URL!;
const SF_CLIENT_ID = process.env.SF_CLIENT_ID!;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET!;

let tokenCache: { token: string; expires: number } | null = null;

// Retry transient failures — a brief Vercel↔Salesforce network blip throws a
// "fetch failed" rejection, and SF occasionally returns a 5xx. Both usually clear
// within a moment. We do NOT retry 4xx (real auth/permission errors that won't
// self-heal). Short backoff keeps worst-case added latency under ~1s.
async function fetchWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status >= 500 && i < attempts - 1) {
        await new Promise(r => setTimeout(r, 300 * (i + 1)));
        continue;
      }
      return res;
    } catch (e) {
      if (i >= attempts - 1) throw e;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetchWithRetry(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce auth failed: ${error}`);
  }

  const data = await response.json();
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + 55 * 60 * 1000,
  };

  return data.access_token;
}

async function query<T>(soql: string): Promise<T[]> {
  const token = await getAccessToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  // Follow nextRecordsUrl until done — Salesforce paginates results, and the
  // batch size shrinks when a query contains a parent-to-child sub-query, so we
  // must page through rather than trust the first response to be complete.
  const records: T[] = [];
  let path: string = `/services/data/v59.0/query?q=${encodeURIComponent(soql)}`;

  while (path) {
    const response: Response = await fetchWithRetry(`${SF_INSTANCE_URL}${path}`, { headers });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Salesforce query failed: ${error}`);
    }
    const data: { records: T[]; done: boolean; nextRecordsUrl?: string } = await response.json();
    records.push(...data.records);
    path = data.done ? '' : (data.nextRecordsUrl ?? '');
  }

  return records;
}

export async function getProgrammeFinanceRecords(): Promise<ProgrammeFinanceRecord[]> {
  // FY 2026/27: March 2026 – February 2027
  // Dates stored as end-of-month in Salesforce (e.g. 2026-03-31)
  const soql = `
    SELECT Id, Name, Type__c,
           Programme__r.Name,
           Programme__r.RecordType.DeveloperName,
           Recruitment_Target_Month__c,
           Target_Amount__c,
           Monthly_Confirmed__c,
           Monthly_Expected__c,
           Monthly_Potential__c,
           Monthly_Costs__c,
           Invoiced_Paid__c,
           Invoiced_Amount__c
    FROM Recruitment_Target__c
    WHERE Recruitment_Target_Month__c >= 2026-03-01
      AND Recruitment_Target_Month__c <= 2027-02-28
    ORDER BY Recruitment_Target_Month__c ASC
  `;
  return query<ProgrammeFinanceRecord>(soql);
}

// Last year's confirmed Advisory opps: FY 2025/26 (Mar 2025 – Feb 2026)
export async function getAdvisoryOpportunitiesLY(): Promise<AdvisoryOpportunity[]> {
  const soql = `
    SELECT Id, Name, Amount, StageName, Probability,
           Start_Date_All__c, End_DateAll__c, Number_of_Months__c,
           Organisation_Sector__c, Account.Id, Account.Name,
           Programme__r.Name
    FROM Opportunity
    WHERE Programme__r.Name LIKE '%Advisory Practice%'
      AND StageName = 'Confirmed'
      AND Amount != null
      AND Start_Date_All__c != null
      AND End_DateAll__c != null
      AND Start_Date_All__c <= 2026-02-28
      AND End_DateAll__c >= 2025-03-01
    ORDER BY Start_Date_All__c ASC
  `;
  return query<AdvisoryOpportunity>(soql);
}

export async function getAdvisoryOpportunities(): Promise<AdvisoryOpportunity[]> {
  // Fetch all Advisory opportunities that overlap with FY 2026/27 (Mar 2026 – Feb 2027).
  // We exclude lost opps. Confirmed income is prorated: Amount / Number_of_Months__c
  // per month the opportunity runs, bypassing the unreliable flow-triggered finance records.
  const soql = `
    SELECT Id, Name, Amount, StageName, Probability,
           Start_Date_All__c, End_DateAll__c, Number_of_Months__c,
           Organisation_Sector__c, Order__c, Costs__c, Project_Code__c, Account.Id, Account.Name,
           Programme__r.Name
    FROM Opportunity
    WHERE Programme__r.Name LIKE '%Advisory Practice%'
      AND StageName != 'Opportunity lost'
      AND Amount != null
      AND Start_Date_All__c != null
      AND End_DateAll__c != null
      AND Start_Date_All__c <= 2027-02-28
      AND End_DateAll__c >= 2026-03-01
    ORDER BY Start_Date_All__c ASC
  `;
  return query<AdvisoryOpportunity>(soql);
}

export async function getProgrammeOrders(): Promise<AdvisoryOrder[]> {
  const soql = `
    SELECT Id, Name, OpportunityId, Status, TotalAmount,
           Project_Start_Date__c, Project_End_Date__c, Project_Length_Months__c,
           Number_of_invoices__c,
           Invoiced_Amount__c, Monthly_Invoiced_Amount__c,
           Paid_Amount__c, Paid_Amount_Per_Month__c,
           Invoice_Amount_Remaining__c, Sector__c
    FROM Order
    WHERE Type != 'Advisory Practice Project'
    ORDER BY CreatedDate ASC
  `;
  return query<AdvisoryOrder>(soql);
}

export async function getAdvisoryOrders(): Promise<AdvisoryOrder[]> {
  const soql = `
    SELECT Id, Name, OpportunityId, Status, TotalAmount,
           Project_Start_Date__c, Project_End_Date__c, Project_Length_Months__c,
           Number_of_invoices__c,
           Invoiced_Amount__c, Monthly_Invoiced_Amount__c,
           Paid_Amount__c, Paid_Amount_Per_Month__c,
           Invoice_Amount_Remaining__c, Sector__c
    FROM Order
    WHERE Type = 'Advisory Practice Project'
    ORDER BY CreatedDate ASC
  `;
  return query<AdvisoryOrder>(soql);
}

// ─── Programmes ───────────────────────────────────────────────────────────────

// All programme opportunities closing in FY 2026/27 (Mar 2026 – Feb 2027).
// Advisory Practice opps are excluded in code (NOT LIKE is invalid SOQL).
// Income lands in the month of CloseDate (not prorated).
export async function getProgrammeOpportunities(): Promise<ProgrammeOpportunity[]> {
  const soql = `
    SELECT Id, Name, Amount, StageName, Probability,
           CloseDate, Total_Places__c,
           Organisation_Sector__c, Order__c, Account.Id, Account.Name,
           Programme__r.Name,
           (SELECT Quantity, UnitPrice, ListPrice, Product2.ProductCode, Product2.Name FROM OpportunityLineItems)
    FROM Opportunity
    WHERE Programme__c != null
      AND StageName != 'Opportunity lost'
      AND Amount != null
      AND CloseDate >= 2026-01-01
      AND CloseDate <= 2027-02-28
    ORDER BY CloseDate ASC
  `;
  return query<ProgrammeOpportunity>(soql);
}

// Confirmed programme opportunities from last FY (Mar 2025 – Feb 2026) for LY comparison.
// Advisory Practice opps are excluded in code (NOT LIKE is invalid SOQL).
export async function getProgrammeOpportunitiesLY(): Promise<ProgrammeOpportunity[]> {
  const soql = `
    SELECT Id, Name, Amount, StageName, Probability,
           CloseDate, Total_Places__c,
           Organisation_Sector__c, Account.Name,
           Programme__r.Name
    FROM Opportunity
    WHERE Programme__c != null
      AND StageName = 'Confirmed'
      AND Amount != null
      AND CloseDate >= 2025-01-01
      AND CloseDate <= 2026-02-28
    ORDER BY CloseDate ASC
  `;
  return query<ProgrammeOpportunity>(soql);
}

// ─── Organisations ────────────────────────────────────────────────────────────

// Fetch Account records for partner organisations including potential target fields.
export async function getPartnerAccounts(accountIds: string[]): Promise<OrganisationAccount[]> {
  if (accountIds.length === 0) return [];
  const idList = accountIds.map(id => `'${id}'`).join(',');
  const soql = `
    SELECT Id, Name,
      Advisory_Potential__c, Advisory_Potential_Percent__c,
      Programme_Potential__c, Programme_Potential_Percent__c
    FROM Account
    WHERE Id IN (${idList})
    ORDER BY Name ASC
  `;
  return query<OrganisationAccount>(soql);
}

// ─── Fellowship ────────────────────────────────────────────────────────────────

// All opportunities for the current Fellowship cohort (e.g. "Fellowship Programme 2026").
// We pull the place line items so the sector/free split comes off the product code,
// and Account.Owner.Name which Forward Institute uses as the "Partner Lead".
// Lost opps are excluded; every other stage (Hopeful/Possible/Expecting/Confirmed) is kept.
export async function getFellowshipOpportunities(cohortYear: number): Promise<FellowshipOpportunity[]> {
  const soql = `
    SELECT Id, Name, Amount, StageName, Probability, CloseDate,
           Total_Places__c, Organisation_Sector__c,
           Account.Id, Account.Name, Account.Owner.Name,
           Programme__r.Name,
           (SELECT Quantity, Product2.ProductCode, Product2.Name FROM OpportunityLineItems)
    FROM Opportunity
    WHERE Programme__r.Name LIKE 'Fellowship Programme ${cohortYear}%'
      AND StageName != 'Opportunity lost'
    ORDER BY CloseDate ASC
  `;
  return query<FellowshipOpportunity>(soql);
}

// Confirmed Fellowship opps from prior cohorts — drives the derived "relationship
// with fellowship" classification and the year-on-year confirmed comparison.
// `years` are the prior cohort years to include, e.g. [2023, 2024, 2025].
export async function getFellowshipHistory(years: number[]): Promise<FellowshipHistoryOpp[]> {
  if (years.length === 0) return [];
  const nameList = years.map(y => `'Fellowship Programme ${y}'`).join(',');
  const soql = `
    SELECT Account.Id, Programme__r.Name, Amount, CloseDate, StageName
    FROM Opportunity
    WHERE Programme__r.Name IN (${nameList})
      AND StageName = 'Confirmed'
      AND Amount != null
    ORDER BY CloseDate ASC
  `;
  return query<FellowshipHistoryOpp>(soql);
}
