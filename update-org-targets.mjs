/**
 * update-org-targets.mjs
 *
 * Reads "Update Targets - with IDs.csv" and updates each Salesforce Account record with:
 *   Advisory_Potential__c          (col 1 – advisory max potential)
 *   Advisory_Potential_Percent__c  (col 2 – advisory likelihood %)
 *   Programme_Potential__c         (col 3 – programme max potential)
 *   Programme_Potential_Percent__c (col 4 – programme likelihood %)
 *
 * Usage:
 *   node update-org-targets.mjs
 *
 * Requires .env.local with SF_CLIENT_ID, SF_CLIENT_SECRET, SF_INSTANCE_URL
 */

import fs from 'fs';
import path from 'path';
import { createReadStream } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load env ─────────────────────────────────────────────────────────────────
const envPath = path.join(__dirname, '.env.local');
if (!fs.existsSync(envPath)) {
  console.error('Could not read .env.local — run: npx vercel env pull .env.local');
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const { SF_CLIENT_ID, SF_CLIENT_SECRET, SF_INSTANCE_URL } = env;
if (!SF_CLIENT_ID || !SF_CLIENT_SECRET || !SF_INSTANCE_URL) {
  console.error('Missing SF_CLIENT_ID, SF_CLIENT_SECRET or SF_INSTANCE_URL in .env.local');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Parse £80,000 → 80000, £- / blank → null */
function parseMoney(raw) {
  if (!raw) return null;
  const cleaned = raw.replace(/[£,\s]/g, '').replace('−', '-');
  if (cleaned === '-' || cleaned === '' || cleaned === '0' || isNaN(Number(cleaned))) return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Parse 70% → 70, blank → null */
function parsePct(raw) {
  if (!raw) return null;
  const cleaned = raw.replace('%', '').trim();
  if (cleaned === '' || cleaned === '0') return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/** Parse CSV line respecting quoted fields */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; }
    else if (c === ',' && !inQuotes) { fields.push(current); current = ''; }
    else { current += c; }
  }
  fields.push(current);
  return fields.map(f => f.trim());
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function getToken() {
  const res = await fetch(`${SF_INSTANCE_URL}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: SF_CLIENT_ID,
      client_secret: SF_CLIENT_SECRET,
    }),
  });
  if (!res.ok) { console.error('Auth failed:', await res.text()); process.exit(1); }
  return (await res.json()).access_token;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, '..', 'Update Targets - with IDs.csv');
if (!fs.existsSync(CSV_PATH)) {
  console.error(`CSV not found at: ${CSV_PATH}`);
  process.exit(1);
}

const lines = fs.readFileSync(CSV_PATH, 'utf8').split('\n').filter(l => l.trim());
// Skip header row (index 0). Columns by index:
// 0: Partner  1: Advisory Max Potential  2: Advisory Likelihood%
// 3: Programme Max Potential  4: Programme Likelihood%  5: Id
// 6: Confidence  7: Matched To

const rows = lines.slice(1).map(parseCsvLine).filter(cols => cols[5] && cols[5].startsWith('0'));

console.log(`Found ${rows.length} rows with Salesforce IDs\n`);

const token = await getToken();
console.log('Authenticated ✓\n');

let updated = 0, skipped = 0, errors = 0;

for (const cols of rows) {
  const [partner, advPot, advPct, progPot, progPct, id] = cols;

  const payload = {};
  const ap = parseMoney(advPot);   if (ap  !== null) payload.Advisory_Potential__c           = ap;
  const al = parsePct(advPct);     if (al  !== null) payload.Advisory_Potential_Percent__c    = al;
  const pp = parseMoney(progPot);  if (pp  !== null) payload.Programme_Potential__c           = pp;
  const pl = parsePct(progPct);    if (pl  !== null) payload.Programme_Potential_Percent__c   = pl;

  if (Object.keys(payload).length === 0) {
    console.log(`  SKIP  ${partner} — no values to set`);
    skipped++;
    continue;
  }

  const res = await fetch(
    `${SF_INSTANCE_URL}/services/data/v59.0/sobjects/Account/${id}`,
    {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (res.status === 204) {
    console.log(`  OK    ${partner} (${id}) →`, JSON.stringify(payload));
    updated++;
  } else {
    const err = await res.text();
    console.error(`  ERR   ${partner} (${id}): ${err}`);
    errors++;
  }
}

console.log(`\n✓ Done — ${updated} updated, ${skipped} skipped, ${errors} errors`);
