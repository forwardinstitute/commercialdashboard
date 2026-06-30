import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export type PriceChange = {
  opp_id:          string;
  opp_name:        string;
  account_name:    string;
  stream:          string;
  sector:          string;
  first_amount:    number;
  first_fy_amount: number;
  first_date:      string;
  latest_amount:   number;
  latest_fy_amount: number;
  latest_date:     string;
  delta:           number;
  fy_delta:        number;
};

export async function getConfirmedPriceChanges(days = 30): Promise<PriceChange[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('confirmed_price_changes', { lookback_days: days });

  if (error) {
    console.error('[snapshots] confirmed_price_changes error:', error.message);
    return [];
  }

  return (data ?? []) as PriceChange[];
}

export type FellowshipMovementRow = {
  snapshot_date: string;
  sector:        string;
  weighted:      number;
  confirmed:     number;
  gross:         number;
  opps:          number;
};

// Daily Fellowship weighted-pipeline history, broken out by sector — drives the
// "Pipeline movement" view. Read via SECURITY DEFINER RPC (RLS-safe).
// Pass the current cohort's opp IDs to scope it to Cohort 12 / Fellowship
// Programme 2026 (matching the live Pipeline view); null/empty = all fellowship.
export async function getFellowshipMovement(oppIds?: string[] | null): Promise<FellowshipMovementRow[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase.rpc('fellowship_movement', {
    p_opp_ids: oppIds && oppIds.length ? oppIds : null,
  });

  if (error) {
    console.error('[snapshots] fellowship_movement error:', error.message);
    return [];
  }

  // numeric comes back as string from PostgREST — coerce to number.
  return (data ?? []).map((r: any) => ({
    snapshot_date: r.snapshot_date,
    sector:        r.sector,
    weighted:      Number(r.weighted)  || 0,
    confirmed:     Number(r.confirmed) || 0,
    gross:         Number(r.gross)     || 0,
    opps:          Number(r.opps)      || 0,
  })) as FellowshipMovementRow[];
}
