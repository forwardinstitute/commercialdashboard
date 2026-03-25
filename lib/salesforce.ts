import { ProgrammeFinanceRecord } from '@/types';

const SF_INSTANCE_URL = process.env.SF_INSTANCE_URL!;
const SF_CLIENT_ID = process.env.SF_CLIENT_ID!;
const SF_CLIENT_SECRET = process.env.SF_CLIENT_SECRET!;

let tokenCache: { token: string; expires: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expires > Date.now()) {
    return tokenCache.token;
  }

  const response = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
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
  const response = await fetch(
    `${SF_INSTANCE_URL}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Salesforce query failed: ${error}`);
  }

  const data = await response.json();
  return data.records as T[];
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
           Invoiced_Paid__c,
           Invoiced_Amount__c
    FROM Recruitment_Target__c
    WHERE Recruitment_Target_Month__c >= 2026-03-01
      AND Recruitment_Target_Month__c <= 2027-02-28
    ORDER BY Recruitment_Target_Month__c ASC
  `;
  return query<ProgrammeFinanceRecord>(soql);
}
