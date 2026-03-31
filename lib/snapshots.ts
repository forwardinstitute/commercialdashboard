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
