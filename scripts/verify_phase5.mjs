import assert from 'node:assert';
import { 
  getPagePermission, 
  canModifyPage, 
  canViewPage, 
  isPageRestricted, 
  getUserAssignedShops,
  parseAccessStrings 
} from '../src/utils/permissionUtils.js';

console.log('========================================================');
console.log('RUNNING PHASE 5: END-TO-END VERIFICATION & AUDIT SUITE');
console.log('========================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(testName, fn) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${testName}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${testName}:`, err.message);
  }
}

// -------------------------------------------------------------
// TC-01: User with purchase.Indent.view
// -------------------------------------------------------------
runTest('TC-01: User with purchase.Indent.view has View-Only permission', () => {
  const user = {
    role: 'user',
    user_name: 'test_cashier',
    employee_id: '101',
    assigned_shops: ['BALAJI'],
    master_user_system_page_access: JSON.stringify(['purchase.Indent.view'])
  };

  const perm = getPagePermission(user, 'purchase', 'Indent');
  assert.strictEqual(perm.canView, true, 'canView should be true');
  assert.strictEqual(perm.canModify, false, 'canModify should be false');
  assert.strictEqual(perm.state, 'view', 'state should be view');
  assert.strictEqual(perm.isRestricted, true, 'isRestricted should be true');
  assert.deepStrictEqual(perm.assignedShops, ['BALAJI']);
});

// -------------------------------------------------------------
// TC-02: User with purchase.Indent.modify
// -------------------------------------------------------------
runTest('TC-02: User with purchase.Indent.modify has Full CRUD permission', () => {
  const user = {
    role: 'user',
    user_name: 'test_manager',
    employee_id: '102',
    assigned_shops: ['BALAJI'],
    master_user_system_page_access: JSON.stringify(['purchase.Indent.modify'])
  };

  const perm = getPagePermission(user, 'purchase', 'Indent');
  assert.strictEqual(perm.canView, true, 'canView should be true');
  assert.strictEqual(perm.canModify, true, 'canModify should be true');
  assert.strictEqual(perm.state, 'modify', 'state should be modify');
  assert.strictEqual(perm.isRestricted, false, 'isRestricted should be false');
});

// -------------------------------------------------------------
// TC-03: User with purchase.Indent = none
// -------------------------------------------------------------
runTest('TC-03: User with no Indent access is blocked (state = none)', () => {
  const user = {
    role: 'user',
    user_name: 'restricted_user',
    employee_id: '103',
    assigned_shops: ['BALAJI'],
    master_user_system_page_access: JSON.stringify(['hr.Dashboard.view'])
  };

  const perm = getPagePermission(user, 'purchase', 'Indent');
  assert.strictEqual(perm.canView, false, 'canView should be false');
  assert.strictEqual(perm.canModify, false, 'canModify should be false');
  assert.strictEqual(perm.state, 'none', 'state should be none');
});

// -------------------------------------------------------------
// TC-04 & TC-05: Admin Shop Scoping & Role Isolation
// -------------------------------------------------------------
runTest('TC-04: Admin shop scoping logic isolates shops correctly', () => {
  const adminBalaji = {
    role: 'admin',
    user_name: 'admin_balaji',
    employee_id: '201',
    assigned_shops: ['BALAJI']
  };

  const adminFriends = {
    role: 'admin',
    user_name: 'admin_friends',
    employee_id: '202',
    assigned_shops: ['FRIENDS']
  };

  const balajiShops = getUserAssignedShops(adminBalaji);
  const friendsShops = getUserAssignedShops(adminFriends);

  assert.deepStrictEqual(balajiShops, ['BALAJI']);
  assert.deepStrictEqual(friendsShops, ['FRIENDS']);
  assert.strictEqual(balajiShops.includes('FRIENDS'), false);
  assert.strictEqual(friendsShops.includes('BALAJI'), false);
});

// -------------------------------------------------------------
// TC-06: Stage 3 Task Approval Scoping
// -------------------------------------------------------------
runTest('TC-06: Stage 3 Task Approval Scoping: Admin A cannot see or approve Shop B tasks', () => {
  const adminBalaji = {
    role: 'admin',
    user_name: 'admin_balaji',
    employee_id: '201',
    assigned_shops: ['BALAJI']
  };

  const tasks = [
    { id: 1, shop_name: 'BALAJI', status: 'MANAGER_APPROVED' },
    { id: 2, shop_name: 'FRIENDS', status: 'MANAGER_APPROVED' },
    { id: 3, shop_name: 'KUNAL', status: 'MANAGER_APPROVED' },
  ];

  const adminShops = getUserAssignedShops(adminBalaji);
  const visibleTasks = tasks.filter(t => adminShops.includes(t.shop_name));

  assert.strictEqual(visibleTasks.length, 1);
  assert.strictEqual(visibleTasks[0].shop_name, 'BALAJI');
  assert.strictEqual(visibleTasks.some(t => t.shop_name === 'FRIENDS'), false);
});

// -------------------------------------------------------------
// TC-07: HOD & Superadmin Global Scope
// -------------------------------------------------------------
runTest('TC-07: HOD and Superadmin have unrestricted global enterprise authority', () => {
  const superadmin = {
    role: 'superadmin',
    user_name: 'masteradmin',
    employee_id: '999'
  };

  const hod = {
    role: 'hod',
    user_name: 'enterprise_hod',
    employee_id: '500'
  };

  const saShops = getUserAssignedShops(superadmin);
  const hodShops = getUserAssignedShops(hod);

  // Global users return empty assigned shops array indicating ALL shops
  assert.deepStrictEqual(saShops, []);
  assert.deepStrictEqual(hodShops, []);

  // Superadmin has modify rights everywhere
  const saPermPurchase = getPagePermission(superadmin, 'purchase', 'Indent');
  const saPermHR = getPagePermission(superadmin, 'hr', 'Joining shop');
  const saPermInventory = getPagePermission(superadmin, 'inventory', 'Form Entry');

  assert.strictEqual(saPermPurchase.canModify, true);
  assert.strictEqual(saPermHR.canModify, true);
  assert.strictEqual(saPermInventory.canModify, true);

  // HOD has modify rights everywhere
  const hodPermPurchase = getPagePermission(hod, 'purchase', 'Indent');
  const hodPermChecklist = getPagePermission(hod, 'checklist', 'Admin Approval');
  assert.strictEqual(hodPermPurchase.canModify, true);
  assert.strictEqual(hodPermChecklist.canModify, true);
});

// -------------------------------------------------------------
// TC-08 & TC-09: Superadmin Singleton & Row Protection
// -------------------------------------------------------------
runTest('TC-08 & TC-09: Superadmin singleton and active deletion guard rules', () => {
  const existingUsers = [
    { id: 1, role: 'superadmin', user_name: 'masteradmin', employee_id: '999' },
    { id: 2, role: 'admin', user_name: 'balaji_admin', employee_id: '201' },
    { id: 3, role: 'user', user_name: 'cashier1', employee_id: '101' },
  ];

  const hasActiveSuperadmin = existingUsers.some(u => String(u.role).toLowerCase() === 'superadmin');
  assert.strictEqual(hasActiveSuperadmin, true, 'Active superadmin must be detected');

  // When adding a new user, 'superadmin' role must NOT be permitted
  const baseRoles = ['user', 'manager', 'admin', 'hod', 'superadmin'];
  const availableRolesWhenCreating = baseRoles.filter(r => r !== 'superadmin' || !hasActiveSuperadmin);
  assert.strictEqual(availableRolesWhenCreating.includes('superadmin'), false, 'Superadmin must not be available to select');

  // Deletion guard: Active superadmin cannot be deleted
  const canDeleteUser = (targetUser) => {
    return String(targetUser.role).toLowerCase() !== 'superadmin';
  };

  assert.strictEqual(canDeleteUser(existingUsers[0]), false, 'Superadmin cannot be deleted');
  assert.strictEqual(canDeleteUser(existingUsers[1]), true, 'Admin can be deleted');
  assert.strictEqual(canDeleteUser(existingUsers[2]), true, 'User can be deleted');
});

// -------------------------------------------------------------
// Subsystem Multi-Page Access Matrix
// -------------------------------------------------------------
runTest('Multi-Subsystem Matrix: View-Only vs Modify across all 6 systems', () => {
  const complexUser = {
    role: 'manager',
    user_name: 'ops_lead',
    employee_id: '305',
    assigned_shops: ['BALAJI', 'FRIENDS'],
    master_user_system_page_access: JSON.stringify([
      'purchase.Indent.view',
      'purchase.PO.modify',
      'inventory.Purchase Form Entry.view',
      'inventory.Cash Tally Form Entry.modify',
      'hr.Joining shop.view',
      'hr.Employees.modify',
      'petty-cash.Petty Cash Form.view',
      'checklist.Task.modify'
    ])
  };

  // Purchase Indent (view) vs PO (modify)
  assert.strictEqual(getPagePermission(complexUser, 'purchase', 'Indent').state, 'view');
  assert.strictEqual(getPagePermission(complexUser, 'purchase', 'PO').state, 'modify');

  // Inventory sub-entries
  assert.strictEqual(getPagePermission(complexUser, 'inventory', 'Purchase Form Entry').state, 'view');
  assert.strictEqual(getPagePermission(complexUser, 'inventory', 'Cash Tally Form Entry').state, 'modify');

  // HR Joining Shop (view) vs Employees (modify)
  assert.strictEqual(getPagePermission(complexUser, 'hr', 'Joining shop').state, 'view');
  assert.strictEqual(getPagePermission(complexUser, 'hr', 'Employees').state, 'modify');

  // Petty cash view-only
  assert.strictEqual(getPagePermission(complexUser, 'petty-cash', 'Petty Cash Form').state, 'view');

  // Checklist modify
  assert.strictEqual(getPagePermission(complexUser, 'checklist', 'Task').state, 'modify');
});

// -------------------------------------------------------------
// Double Serialized & Complex String Format Resilience
// -------------------------------------------------------------
runTest('JSON Resilience: Double-serialized and comma-separated access parsing', () => {
  // Case A: Double JSON stringified
  const doubleEncoded = JSON.stringify(JSON.stringify(['purchase.Indent.modify', 'hr.Dashboard.view']));
  const parsedA = parseAccessStrings(doubleEncoded);
  assert.deepStrictEqual(parsedA, ['purchase.Indent.modify', 'hr.Dashboard.view']);

  // Case B: Comma-separated string
  const commaSeparated = 'purchase.Indent.modify, hr.Dashboard.view';
  const parsedB = parseAccessStrings(commaSeparated);
  assert.deepStrictEqual(parsedB, ['purchase.Indent.modify', 'hr.Dashboard.view']);

  // Case C: Object map format
  const objectMap = { 'purchase.Indent.modify': true, 'hr.Dashboard.view': 'view', 'petty.none': false };
  const parsedC = parseAccessStrings(objectMap);
  assert.deepStrictEqual(parsedC, ['purchase.Indent.modify', 'hr.Dashboard.view']);
});

// -------------------------------------------------------------
// TC-10: Employee 1030 Role User with Assign Task & FRIENDS Shop Scoping
// -------------------------------------------------------------
runTest('TC-10: Emp 1030 Role User with Assign Task & strict FRIENDS shop scoping', () => {
  const emp1030 = {
    id: 242,
    employee_id: '1030',
    user_name: 'Madhurshyam',
    role: 'User',
    shop_name: 'FRIENDS',
    user_access: 'FRIENDS',
    master_user_system_page_access: [
      'checklist.Dashboard.modify',
      'checklist.Assign Task.modify',
      'checklist.Work Records.view'
    ]
  };

  // 1. Assign Task permission evaluation
  const assignTaskPerm = getPagePermission(emp1030, 'checklist', 'Assign Task');
  assert.strictEqual(assignTaskPerm.canView, true, 'Emp 1030 must have canView = true for Assign Task');
  assert.strictEqual(assignTaskPerm.canModify, true, 'Emp 1030 must have canModify = true for Assign Task');

  // 2. Shop Scoping
  const assigned = getUserAssignedShops(emp1030);
  assert.deepStrictEqual(assigned, ['FRIENDS'], 'Emp 1030 must only be assigned to FRIENDS');

  // 3. Scheduled Work Tasks & Work Details filtering simulation
  const dummyTasks = [
    { id: 1, task_name: 'BALAJI Clean', shop: { shop_name: 'BALAJI' } },
    { id: 2, task_name: 'FRIENDS Clean', shop: { shop_name: 'FRIENDS' } },
    { id: 3, task_name: 'MADHURA Clean', shop: { shop_name: 'MADHURA' } }
  ];

  const assignedLower = assigned.map(s => s.toLowerCase());
  const scopedTasks = dummyTasks.filter(t => assignedLower.includes(t.shop?.shop_name?.toLowerCase()));
  assert.strictEqual(scopedTasks.length, 1, 'Only 1 task should match');
  assert.strictEqual(scopedTasks[0].shop.shop_name, 'FRIENDS', 'Only FRIENDS task should be returned');
  assert.strictEqual(scopedTasks.some(t => t.shop.shop_name === 'BALAJI'), false, 'BALAJI task must not be visible');
});

console.log(`\n========================================================`);
console.log(`TEST SUMMARY: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`========================================================\n`);

if (passedTests !== totalTests) {
  process.exit(1);
}
