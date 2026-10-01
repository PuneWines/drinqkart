import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxtvvjijtraobzaqdevz.supabase.co';
const supabaseKey = 'sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  const { data: users } = await supabase.from('users').select('*').limit(1);
  console.log('users table sample row:', users ? Object.keys(users[0] || {}) : 'null');

  const { data: hr } = await supabase.from('hr_management_employees').select('*').limit(1);
  console.log('hr_management_employees table sample row:', hr ? Object.keys(hr[0] || {}) : 'null');
}

inspectSchema();
