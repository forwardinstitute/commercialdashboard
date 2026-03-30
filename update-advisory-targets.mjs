#!/usr/bin/env node
// Run from project root: node update-advisory-targets.mjs
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ── Parse .env.local ──────────────────────────────────────────────────────────
const envVars = {};
try {
  readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    .split('\n')
    .forEach(line => {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const k = line.slice(0, eq).trim();
        const v = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        envVars[k] = v;
      }
    });
} catch {
  console.error('Could not read .env.local — make sure you run this from the project root.');
  process.exit(1);
}

const { SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET } = envVars;
if (!SF_INSTANCE_URL || !SF_CLIENT_ID || !SF_CLIENT_SECRET) {
  console.error('Missing SF_INSTANCE_URL, SF_CLIENT_ID, or SF_CLIENT_SECRET in .env.local');
  process.exit(1);
}

// ── Monthly targets ───────────────────────────────────────────────────────────
const TARGETS = [
  { month: '2026-03-31', amount: 233750,  label: 'Mar-26' },
  { month: '2026-04-30', amount: 247500,  label: 'Apr-26' },
  { month: '2026-05-31', amount: 247500,  label: 'May-26' },
  { month: '2026-06-30', amount: 233750,  label: 'Jun-26' },
  { month: '2026-07-31', amount: 220000,  label: 'Jul-26' },
  { month: '2026-08-31', amount: 178750,  label: 'Aug-26' },
  { month: '2026-09-30', amount: 247500,  label: 'Sep-26' },
  { month: '2026-10-31', amount: 261250,  label: 'Oct-26' },
  { month: '2026-11-30', amount: 233750,  label: 'Nov-26' },
  { month: '2026-12-31', amount: 178750,  label: 'Dec-26' },
  { month: '2027-01-31', amount: 206250,  label: 'Jan-27' },
  { month: '2027-02-28', amount: 261250,  label: 'Feb-27' },
];
const TOTAL = TARGETS.reduce((s, t) => s + t.amount, 0);
console.log(`Total to set: £${TOTAL.toLocaleString('en-GB')} (should be £2,750,000)\n`);

// ── SF helpers ────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function sfQuery(token, soql) {
  const res = await fetch(
    `${SF_INSTANCE_URL}/services/data/v59.0/query?q=${encodeURIComponent(soql)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  if (data.errorCode) throw new Error(`Query failed: ${data.message}`);
  return data.records ?? [];
}

async function sfCreate(token, object, fields) {
  const res = await fetch(
    `${SF_INSTANCE_URL}/services/data/v59.0/sobjects/${object}`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }
  );
  return res.json();
}

async function sfUpdate(token, object, id, fields) {
  const res = await fetch(
    `${SF_INSTANCE_URL}/services/data/v59.0/sobjects/${object}/${id}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    }
  );
  return res.status === 204 ? { success: true } : res.json();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Authenticating with Salesforce...');
  const token = await getToken();
  console.log('Authenticated.\n');

  // Find the Advisory Practice programme record
  const programmes = await sfQuery(token,
    "SELECT Id, Name FROM Programme__c WHERE Name LIKE '%Advisory Practice%' LIMIT 5"
  );
  if (!programmes.length) throw new Error('No Advisory Practice programme found in SF.');
  if (programmes.length > 1) {
    console.log('Multiple matches — using first:');
    programmes.forEach(p => console.log(`  ${p.Id}  ${p.Name}`));
  }
  const prog = programmes[0];
  console.log(`Programme: ${prog.Name} (${prog.Id})\n`);

  // Fetch existing monthly target records for this programme
  const existing = await sfQuery(token,
    `SELECT Id, Name, Recruitment_Target_Month__c, Target_Amount__c
     FROM Recruitment_Target__c
     WHERE Programme__c = '${prog.Id}'
     ORDER BY Recruitment_Target_Month__c ASC`
  );
  console.log(`Found ${existing.length} existing target record${existing.length !== 1 ? 's' : ''}.\n`);

  const byMonth = {};
  for (const r of existing) byMonth[r.Recruitment_Target_Month__c] = r.Id;

  // Upsert each month
  let updated = 0, created = 0;
  for (const { month, amount, label } of TARGETS) {
    if (byMonth[month]) {
      const result = await sfUpdate(token, 'Recruitment_Target__c', byMonth[month], {
        Target_Amount__c: amount,
      });
      if (result.success) {
        console.log(`  ✓ Updated  ${label}  £${amount.toLocaleString('en-GB')}`);
        updated++;
      } else {
        console.log(`  ✗ Failed   ${label}  ${JSON.stringify(result)}`);
      }
    } else {
      const result = await sfCreate(token, 'Recruitment_Target__c', {
        Programme__c: prog.Id,
        Recruitment_Target_Month__c: month,
        Target_Amount__c: amount,
        Name: `Advisory Practice FY2627 - ${label}`,
      });
      if (result.id) {
        console.log(`  + Created  ${label}  £${amount.toLocaleString('en-GB')}  (${result.id})`);
        created++;
      } else {
        console.log(`  ✗ Failed   ${label}  ${JSON.stringify(result)}`);
      }
    }
  }

  console.log(`\nDone — ${updated} updated, ${created} created.`);
}

main().catch(err => { console.error('\nError:', err.message); process.exit(1); });
