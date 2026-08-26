# Implementation Plan - Master Settings Granular RBAC Permissions & Visibility

Provide granular None / View / Modify permission controls for all Master Settings sub-modules, enforce sidebar tab visibility based on permissions, and restrict action capabilities (Add/Edit/Delete) on pages when permission is set to View-only.

## Precise Summary of Requirements

1. **Master Settings Module Toggles in Edit User Modal**:
   - Update `AVAILABLE_SYSTEMS` in `MasterSetting.jsx` under `id: 'master-setting'` to list all 5 sub-pages:
     - `User & System Access`
     - `Shop`
     - `Counter`
     - `Expenses`
     - `Purchase Settings`
   - Render None / View / Edit toggles in the Edit User modal for each sub-page, saving permission strings to `master_user_system_page_access` (e.g., `master-setting.Shop.view`, `master-setting.Shop.modify`, `master-setting.Counter.modify`, etc.).

2. **Sidebar Tab Visibility Control**:
   - Extract `master_user_system_page_access` from `localStorage.currentUser` (or logged-in user context).
   - In `systemsConfig.js`, evaluate permissions for Master Setting subtabs.
   - If a page permission is `.none` (neither `.view` nor `.modify` is present for a non-admin user), hide that tab from the left sidebar navigation. Admin/Masteradmin users see all tabs.

3. **Page-Level Action Restriction (View-Only vs Modify)**:
   - For each Master Settings page:
     - **`.modify`**: Full access to view, add, edit, delete, toggle, and save.
     - **`.view`**: Read-only mode. Content is visible, but all Add, Edit, Delete, Save, and Toggle actions are hidden or disabled.
     - **`.none`**: Sidebar tab hidden; direct URL access redirects or shows access denied.

---

## User Review Required

> [!IMPORTANT]
> **Sidebar Label Matching**: The permission keys saved in `master_user_system_page_access` will use standard Master Settings page names:
> - `master-setting.User & System Access.view` / `.modify`
> - `master-setting.Shop.view` / `.modify` (matches `master-setting.shops` as well)
> - `master-setting.Counter.view` / `.modify` (matches `master-setting.counters` as well)
> - `master-setting.Expenses.view` / `.modify`
> - `master-setting.Purchase Settings.view` / `.modify`

---

## Proposed Changes

### Configuration & Layout

#### [MODIFY] [systemsConfig.js](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/layout/systemsConfig.js)
- Update `isSubtabAllowed` helper to check granular `master-setting.{page_name}.view` and `master-setting.{page_name}.modify` permissions for all Master Setting subtabs (`User & System Access`, `Shop`, `Counter`, `Expenses`, `Purchase Settings`).
- Support case-insensitive and plural variations (`Shop`/`Shops`, `Counter`/`Counters`).

---

### Master Settings Component & Sub-pages

#### [MODIFY] [MasterSetting.jsx](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/pages/MasterSetting.jsx)
1. **`AVAILABLE_SYSTEMS`**:
   - Update `id: 'master-setting'` section to include all 5 pages: `['User & System Access', 'Shop', 'Counter', 'Expenses', 'Purchase Settings']`.
2. **Permission Helper**:
   - Add helper functions `hasPagePermission(pageName)` returning `'modify'`, `'view'`, or `'none'`.
3. **User & System Access Read-Only Enforcement**:
   - If user has only `.view` access: hide "Add User" button, hide or disable Edit user buttons / modals, and disable Quick Shop edit toggles.
4. **Sub-page Read-Only Props**:
   - Pass `readOnly={!hasModifyAccess}` prop to sub-page components (`JoiningCompany`, `CounterManagement`, `ExpensesManagement`, `PurchaseSettings`).

#### [MODIFY] [CounterManagement.jsx](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/pages/CounterManagement.jsx)
- Accept `readOnly` prop.
- When `readOnly` is true, hide/disable Add Counter, Edit Counter, Delete Counter, and status toggles.

#### [MODIFY] [ExpensesManagement.jsx](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/pages/ExpensesManagement.jsx)
- Accept `readOnly` prop.
- When `readOnly` is true, hide/disable Add Expense, Edit Expense, and Delete Expense buttons.

#### [MODIFY] [JoiningCompany.jsx](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/systems/hr/pages/JoiningCompany.jsx)
- Accept `readOnly` prop.
- When `readOnly` is true, hide/disable Add Shop/Company, Edit, Delete, and Save buttons.

#### [MODIFY] [Settings.jsx (Purchase Settings)](file:///c:/Users/shiva/Desktop/BOTIVATE/PUNE-WINES/drinqkart/src/systems/purchase/pages/Settings.jsx)
- Accept `readOnly` prop.
- When `readOnly` is true, hide/disable form submit/save buttons and action toggles.

---

## Verification Plan

### Manual Verification
1. **Edit User Modal Check**:
   - Open Master Settings -> Edit User modal for a user.
   - Verify that under `Master settings` system section, all 5 pages (`User & System Access`, `Shop`, `Counter`, `Expenses`, `Purchase Settings`) display None / View / Edit toggles.
2. **Permission Persistence Check**:
   - Assign `.view` permission for `Shop` and `.none` permission for `Expenses` to a test user. Save and verify database update in `master_user_system_page_access`.
3. **Sidebar Visibility Check**:
   - Log in as the test user.
   - Verify `Expenses` is hidden from the sidebar menu under Master Setting.
   - Verify `Shop` is visible in the sidebar menu.
4. **Read-Only Mode Check**:
   - Navigate to `Shop` as the test user.
   - Verify the table content is displayed, but Add, Edit, Delete, and Save buttons are hidden or disabled.
