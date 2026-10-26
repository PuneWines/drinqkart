# Universal Route Protection, Shop-Scoped Query Architecture & Master Setting UI Enhancements

> **Document:** `req.md`  
> **Status:** Active Requirement & Implementation Architecture  
> **Date:** October 2026  
> **System:** Drinqkart Enterprise Console  

---

## 1. Executive Summary

This requirement addresses three critical enterprise capabilities across Drinqkart:
1. **Universal Route Protection (Zero-Trust Navigation)**: Prevent unauthorized access when users directly enter URLs (e.g. `/systems/master-setting`, `/systems/purchase`, `/systems/hr`, etc.). Users must only be allowed to view routes and modules explicitly granted to their role and `master_user_system_page_access`.
2. **Shop-Scoped Supabase Query Engine**: Ensure all Supabase queries across systems strictly filter by the user's assigned shop(s). Only Superadmin (Apex L5) and HOD (L4) hold global multi-shop query authority. Shop Admins (L3), Managers (L2), and Users (L1) must never fetch or receive data belonging to other branches.
3. **Master Setting User Access Modal UI Enhancements**:
   - Accordion-style collapsible system sections: All systems in `master_user_system_page_access` must be **collapsed (closed) by default**. Clicking a system card expands it to display its sub-pages and permission controls (`none`, `.view`, `.modify`).
   - Automated `.modify` selection: Selecting **Admin** or **HOD** in the role dropdown must automatically select `.modify` across all system pages.

---

## 2. Problem Statement & Threat Model

### Vulnerability A: Direct URL Route Traversal
- **Observed Behavior:** The `ConsoleRoute` wrapper in `App.jsx` previously only verified `if (!user) return <Navigate to="/login" replace />;`.
- **Exploit:** An unprivileged user (e.g., standard cashier or store staff) without permissions for Master Settings or Purchase could type `/systems/master-setting` or `/systems/purchase` in the browser address bar and bypass the sidebar, viewing confidential employee credentials, financial reports, or purchase orders.

### Vulnerability B: Enterprise-Wide Unbounded Database Queries
- **Observed Behavior:** Components performed queries like `supabase.from('users').select('*')` or `supabase.from('tasks').select('*')` without filtering by the logged-in user's assigned shop.
- **Risk:** Data leakage across retail branches, elevated network overhead, and database connection queue starvation on Supabase.

### Usability Issue C: Cluttered Permissions Modal
- In `MasterSetting.jsx`, all 11 enterprise systems and their pages were rendered expanded simultaneously in the Edit/Add User modals, requiring excessive scrolling and creating a cumbersome user experience.

---

## 3. Architecture & Functional Requirements

### 3.1 Universal Route Protection Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │          User Requests Route Path            │
                    │        (e.g., /systems/master-setting)       │
                    └──────────────────────┬───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │               ConsoleRoute Gate              │
                    │         Is user authenticated?               │
                    └──────────────┬───────────────────────────────┘
                                   │ YES
                                   ▼
          ┌──────────────────────────────────────────────────────────────┐
          │  Evaluate System Visibility via getVisibleSystems(user)      │
          │  • Superadmin (L5) & Unconfigured HOD (L4) = Global (Pass)   │
          │  • Other roles = Must match visibleSystems for current route │
          └──────────────────────────────┬───────────────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │                               │
                 SYSTEM AUTHORIZED              SYSTEM UNAUTHORIZED
                         │                               │
                         ▼                               ▼
          ┌─────────────────────────────┐ ┌─────────────────────────────┐
          │ Render Target System Module │ │ Redirect to First Allowed   │
          │ (Internal page guards check │ │ Module or /systems/profile  │
          │  .view vs .modify for CRUD) │ │ with Access Denied Notice   │
          └─────────────────────────────┘ └─────────────────────────────┘
```

#### Acceptance Criteria for Route Protection:
1. `ConsoleRoute` in `src/App.jsx` dynamically identifies the target system using route base path.
2. Checks whether the target system exists in `getVisibleSystems(user)`.
3. If unauthorized, seamlessly redirects the user to their first accessible module in `visibleSystems` or to `/systems/profile` if no sub-system is permitted.
4. `MasterSetting.jsx` enforces an immediate component-level guard: If `!isSuperadmin && !isHod && userAccessPerm === "none"`, it blocks rendering and redirects.

---

### 3.2 Shop-Scoped Supabase Query Engine

#### Scoping Rules:
- **Superadmin (Level 5)**: Global scope — can fetch all shops (`SELECT * FROM table`).
- **HOD (Level 4)**: Global scope — can fetch all shops across the enterprise.
- **Shop Admin (Level 3)**: Strictly scoped to `userAssignedShops` (`assigned_shops`, `shop_name`, `user_access`). Query MUST include `.in('shop_name', userAssignedShops)`.
- **Manager (Level 2)**: Strictly scoped to assigned shop.
- **User (Level 1)**: Strictly scoped to assigned shop and counter.

```javascript
// Universal Query Scoping Pattern:
const userAssignedShops = getUserAssignedShops(currentUser);
let query = supabase.from('target_table').select('*');

if (!isSuperadmin && !isHod) {
  if (userAssignedShops.length === 0) {
    // Isolated user with no assigned shop cannot see other shops' data
    query = query.eq('shop_name', '__UNASSIGNED_NO_ACCESS__');
  } else if (userAssignedShops.length === 1) {
    query = query.eq('shop_name', userAssignedShops[0]);
  } else {
    query = query.in('shop_name', userAssignedShops);
  }
}
```

---

### 3.3 Open-by-Default System Permissions & Strict Granular Enforcement (`MasterSetting.jsx`)

#### UI / UX Requirements:
1. **Open by Default (Auto-Close OFF)**: All system cards (`AVAILABLE_SYSTEMS`) in the "Edit User Access" modal are expanded and fully visible upon opening, displaying all page rows and controls immediately without requiring clicks.
2. **No Accordion Auto-Closing**: Toggling or modifying permissions in one system card leaves all other systems open and visible. Top "Expand All" and "Collapse All" buttons provide global manual toggle.
3. **No Auto-Selection on Admin / HOD**:
   - Switching user role to **Admin** or **HOD** does NOT auto-populate all modify permissions.
   - Preserves granular permissions explicitly configured for each user in `master_user_system_page_access`.
4. **Strict HOD & Admin Permission Enforcement**:
   - HOD and Admin accounts are subject to granular permissions in `master_user_system_page_access`.
   - If an HOD or Admin user has a page permission set to `none` (e.g. `Shop` page for `hod 73`):
     - The subtab is hidden from the navigation sidebar (`systemsConfig.js`).
     - Direct URL navigation to `/systems/master-setting/Shop` displays the **Access Restricted** screen.
     - Viewing or editing the shop records is blocked.

---

## 4. Implementation Matrix

| File | Change Scope |
| :--- | :--- |
| `src/App.jsx` | Add route authorization check in `ConsoleRoute` against `getVisibleSystems(user)`. |
| `src/layout/systemsConfig.js` | 1. Ensure `isMasterAdmin` only includes apex superadmin/masteradmin.<br>2. Filter out `none` permissions from sidebar subtabs for HOD and Admin. |
| `src/utils/permissionUtils.js` | 1. Ensure `getUserAssignedShops` correctly treats Admin as shop-scoped.<br>2. Restrict `ViewOnlyBanner` elevated bypass to superadmin only. |
| `src/pages/MasterSetting.jsx` | 1. Remove `!isHod` bypass across all sub-route permission guards (`Shop`, `Counter`, `Expenses`, `Shop Visit Checklist`, `Scheme Master`, `User Access`).<br>2. Auto-close OFF: all permission divs open and visible by default.<br>3. Remove auto-selection of modify permissions when Admin/HOD role is selected.<br>4. Relocate Shop Access (`user_access`) above `master_user_system_page_access`. |
| `requirements.md` | Synchronize the master specification with this architecture. |