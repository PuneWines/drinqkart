import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://yxtvvjijtraobzaqdevz.supabase.co';
const supabaseAnonKey = 'sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testPayrollDatabase() {
    console.log("--- 1. Testing table structure and fetching hr_management_payroll ---");
    const { data: selectData, error: selectError } = await supabase
        .from('hr_management_payroll')
        .select('*')
        .limit(5);

    if (selectError) {
        console.error("Select Error:", selectError);
    } else {
        console.log("Select Sample Data Keys:", Object.keys(selectData[0] || {}));
    }

    console.log("\n--- 2. Upserting test record with way_off = 500 ---");
    const testRecord = {
        employee_id: '3011',
        year: 2026,
        month: 'September',
        way_off: 500,
        way_off_deduction: 500,
        salary: 20000,
        net_salary: 19500
    };

    const { data: upsertData, error: upsertError } = await supabase
        .from('hr_management_payroll')
        .upsert(testRecord, { onConflict: 'employee_id,year,month' })
        .select();

    if (upsertError) {
        console.error("Upsert Error:", upsertError);
    } else {
        console.log("Upsert Response Success:", upsertData);
    }

    console.log("\n--- 3. Verifying stored data ---");
    const { data: verifyData, error: verifyError } = await supabase
        .from('hr_management_payroll')
        .select('*')
        .eq('employee_id', '3011')
        .eq('year', 2026)
        .eq('month', 'September');

    if (verifyError) {
        console.error("Verify Error:", verifyError);
    } else {
        console.log("Verified Record from DB:", verifyData);
    }
}

testPayrollDatabase();
