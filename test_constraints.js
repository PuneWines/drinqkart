import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Querying constraints on petty_cash_expense...');
  const { data, error } = await supabase.rpc('get_table_constraints', { table_name: 'petty_cash_expense' });
  
  if (error) {
    console.error('RPC Error:', error);
    // Let's do select constraints query via standard RPC if there is any general sql function,
    // otherwise we can try inserting dummy rows to trigger the constraint error and read details!
    console.log('Trying custom insert to test constraints...');
    const { data: insData, error: insError } = await supabase
      .from('petty_cash_expense')
      .insert([
        { patty_id: 'TEST-CONSTR', date: '2026-08-05' },
        { patty_id: 'TEST-CONSTR', date: '2026-08-05' }
      ]);
    
    if (insError) {
      console.log('Insert Error details:', insError);
    } else {
      console.log('Inserted successfully (no unique constraint on patty_id?):', insData);
      // clean up
      await supabase.from('petty_cash_expense').delete().eq('patty_id', 'TEST-CONSTR');
    }
  } else {
    console.log('Constraints:', data);
  }
}

run();
