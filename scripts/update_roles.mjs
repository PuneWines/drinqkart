import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxtvvjijtraobzaqdevz.supabase.co';
const supabaseKey = 'sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateRoles() {
  console.log('--- Checking users table ---');
  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, user_name, role, emp_id')
    .ilike('role', 'employee');

  if (uErr) {
    console.error('Error fetching users:', uErr.message);
  } else {
    console.log(`Found ${users.length} users with role 'employee' / 'Employee':`);
    users.forEach(u => console.log(`  - [ID: ${u.id}] ${u.user_name} (${u.emp_id}): role = ${u.role}`));

    if (users.length > 0) {
      const { data: uUpd, error: uUpdErr } = await supabase
        .from('users')
        .update({ role: 'User' })
        .ilike('role', 'employee')
        .select();

      if (uUpdErr) {
        console.error('Error updating users:', uUpdErr.message);
      } else {
        console.log(`Successfully updated ${uUpd ? uUpd.length : 'all'} users to role = 'User'!`);
      }
    }
  }

  console.log('\n--- Checking hr_management_employees table ---');
  const { data: hrEmployees, error: hrErr } = await supabase
    .from('hr_management_employees')
    .select('id, emp_name, emp_id, designation')
    .ilike('designation', 'employee');

  if (hrErr) {
    console.error('Error fetching hr_management_employees:', hrErr.message);
  } else {
    console.log(`Found ${hrEmployees.length} HR employees with designation 'employee' / 'Employee':`);
    hrEmployees.forEach(e => console.log(`  - [ID: ${e.id}] ${e.emp_name} (${e.emp_id}): designation = ${e.designation}`));

    if (hrEmployees.length > 0) {
      const { data: hrUpd, error: hrUpdErr } = await supabase
        .from('hr_management_employees')
        .update({ designation: 'User' })
        .ilike('designation', 'employee')
        .select();

      if (hrUpdErr) {
        console.error('Error updating hr_management_employees:', hrUpdErr.message);
      } else {
        console.log(`Successfully updated ${hrUpd ? hrUpd.length : 'all'} HR employees to designation = 'User'!`);
      }
    }
  }
}

updateRoles();
