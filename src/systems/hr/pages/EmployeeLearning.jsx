import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Check, CheckCircle2, Clock, AlertCircle, RefreshCw } from 'lucide-react';

/* ---------------- Task Catalogue ---------------- */
const TASKS = [
  // LEVEL 1
  { id: "t01", level: 1, en: "TP Bill Filing / Expense Filling", hi: "TP बिल फाइल में लगाना/खर्चे की एंट्री करना", dept: "EXCISE" },
  { id: "t02", level: 1, en: "Rack Cleaning & Filling", hi: "रैक की सफाई और माल भरना", dept: "RETAIL", tag: "Task" },
  { id: "t03", level: 1, en: "Fridge Filling & Cleaning", hi: "फ्रिज में बोतलें भरना और सफाई", dept: "RETAIL" },
  { id: "t04", level: 1, en: "UPI Payment Check", hi: "UPI पेमेंट चेक करना", dept: "RETAIL" },
  { id: "t05", level: 1, en: "Age Check (25+ Customers)", hi: "ग्राहक की उम्र चेक करना (25 साल से ऊपर)", dept: "RETAIL", tag: "Knowledge" },
  { id: "t06", level: 1, en: "Regular MRP & Brand Knowledge", hi: "MRP और ब्रांड की सामान्य जानकारी", dept: "RETAIL", tag: "Knowledge" },
  { id: "t07", level: 1, en: "Fast Moving Item Knowledge", hi: "ज्यादा बिकने वाले माल की जानकारी", dept: "RETAIL", tag: "Knowledge" },
  { id: "t08", level: 1, en: "Deal with Customer Politely/ Feedback", hi: "ग्राहकों से आराम से बात करना/फीडबैक", dept: "RETAIL", tag: "Knowledge" },
  { id: "t09", level: 1, en: "Home Delivery", hi: "होम डिलीवरी करना", dept: "RETAIL", tag: "Wholesale" },
  { id: "t10", level: 1, en: "Shop & Bathroom Cleaning (3 times)", hi: "दुकान और बाथरूम की सफाई (3 बार)", dept: "RETAIL", tag: "Task" },
  { id: "t11", level: 1, en: "Snacks Counter Set & Sale", hi: "स्नैक्स काउंटर सेट करना और बेचना", dept: "SANCKS" },
  { id: "t12", level: 1, en: "Ice Packing & SANCKS Expiry Check", hi: "बर्फ पैक करना और SANCKS एक्सपायरी चेक करना", dept: "SANCKS" },
  { id: "t13", level: 1, en: "physical stock knowledge in APP", hi: "", dept: "STOCKS" },
  { id: "t14", level: 1, en: "wholesale STOCK REMOVING", hi: "", dept: "WHOLESALE" },
  { id: "t15", level: 1, en: "Google Form( IN OUT / CASH TALLY/ PETTY CASH/ SANCKS .ETC)", hi: "गूगल फॉर्म भरना", dept: "EXCISE" },
  { id: "t50", level: 1, en: "Courier Bill to Office", hi: "ऑफिस में बिल कूरियर करना", dept: "EXCISE" },
  { id: "t51", level: 1, en: "Shop Property Maintenance", hi: "दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना", dept: "TECHNICAL" },

  // LEVEL 2
  { id: "t16", level: 2, en: "Brandwise Printout", hi: "ब्रांड के अनुसार प्रिंटआउट निकालना", dept: "EXCISE" },
  { id: "t17", level: 2, en: "PHYSICAL STOCK SANCK/ PURCHASE", hi: "", dept: "SANCKS" },
  { id: "t18", level: 2, en: "Expense/UPI/Slip/RECIPTS Updates", hi: "कंप्यूटर में खर्चा/UPI/स्लिप अपडेट करना", dept: "EXCISE" },
  { id: "t19", level: 2, en: "Register Maintenance (IMFL/CL/MML)", hi: "रजिस्टर (IMFL/CL/MML) भरना", dept: "EXCISE" },
  { id: "t20", level: 2, en: "TP Summary (IMFL + CL MML )", hi: "TP समरी (IMFL + CL) तैयार करना", dept: "EXCISE" },
  { id: "t21", level: 2, en: "N-Computing Maintenance", hi: "N-कंप्यूटिंग सिस्टम का रखरखाव", dept: "TECHNICAL" },
  { id: "t22", level: 2, en: "Fridge Bottle Breakage Record", hi: "फ्रिज में बोतल टूटने का रिकॉर्ड रखना", dept: "RETAIL" },
  { id: "t23", level: 2, en: "Sale Point Hisaab", hi: "सेल पॉइंट का हिसाब करना", dept: "IMP RETAIL/RETAIL /SANCKS" },
  { id: "t24", level: 2, en: "Offers & Gift Information", hi: "ग्राहकों को गिफ्ट और ऑफर बताना", dept: "RETAIL" },
  { id: "t25", level: 2, en: "Up-selling & Cross-selling", hi: "सेल बढ़ाने के लिए ग्राहकों को प्रेरित करना", dept: "RETAIL" },
  { id: "t26", level: 2, en: "Imported Brand MRP Knowledge", hi: "इम्पोर्टेड ब्रांड्स के रेट की जानकारी", dept: "IMP RETAIL/RETAIL /SANCKS" },
  { id: "t27", level: 2, en: "Batchwise Stock Checking (TP)", hi: "TP से बैच के अनुसार माल चेक करना", dept: "STOCKS" },
  { id: "t28", level: 2, en: "Damage BAEKGS Report", hi: "डैमेज रिपोर्ट और गिफ्ट आइटम का रखरखाव", dept: "RETAIL" },
  { id: "t29", level: 2, en: "TRADER KA ORDER NIKLANA", hi: "REGULAR STOCK ऑर्डर निकालना", dept: "STOCKS" },
  { id: "t30", level: 2, en: "Wholesale BILL CHECK KARNA / PAYMENTS", hi: "होलसेल पार्टी की जरूरत और पैकिंग चेक करना", dept: "WHOLESALE" },
  { id: "t31", level: 2, en: "Home Delivery Record", hi: "होम डिलीवरी का रिकॉर्ड रखना", dept: "RETAIL" },
  { id: "t32", level: 2, en: "SHORT STOCK ITEM LIST MAINTAIN BOOK", hi: "", dept: "RETAIL" },
  { id: "t33", level: 2, en: "REGULAR COUNTER KARNA", hi: "", dept: "RETAIL" },
  { id: "t52", level: 2, en: "BANK Slip Filling", hi: "BANK स्लिप भरना", dept: "RETAIL" },
  { id: "t53", level: 2, en: "whole sale party discount knowledge", hi: "", dept: "WHOLESALE" },
  { id: "t54", level: 2, en: "Snacks Order & Vendor Knowledge", hi: "स्नैक्स का ऑर्डर और वेंडर की जानकारी", dept: "SANCKS" },
  { id: "t55", level: 2, en: "Shop Property Maintenance", hi: "दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना", dept: "TECHNICAL" },

  // LEVEL 3
  { id: "t34", level: 3, en: "TP Purchase & Bill Highlighting", hi: "TP खरीद, बिल चेक और हाईलाइट करना", dept: "EXCISE" },
  { id: "t35", level: 3, en: "Sale Posting", hi: "सेल पोस्ट करना", dept: "EXCISE" },
  { id: "t36", level: 3, en: "Online SCM Filling", hi: "ऑनलाइन SCM भरना", dept: "EXCISE" },
  { id: "t37", level: 3, en: "Daily Computer Backup", hi: "कंप्यूटर का डेली बैकअप लेना", dept: "EXCISE" },
  { id: "t38", level: 3, en: "Cash Tally Report in Group", hi: "ग्रुप में कैश टैली रिपोर्ट भेजना", dept: "EXCISE" },
  { id: "t39", level: 3, en: "Increasing Wholesale Sales", hi: "होलसेल का काम बढ़ाना", dept: "WHOLESALE" },
  { id: "t40", level: 3, en: "PO SYSTEM ORDER NIKLAN PO ORDER ACCEPTS KARNA", hi: "IMS और FMS सिस्टम मैनेज करना", dept: "TECHNICAL" },
  { id: "t41", level: 3, en: "Attendance &", hi: "अटेंडेंस बुक अपडेट करना", dept: "RETAIL" },
  { id: "t42", level: 3, en: "Expense Book Maintenance", hi: "खर्चे वाली बुक को सही से मेंटेन करना", dept: "RETAIL" },
  { id: "t43", level: 3, en: "Shop Property Maintenance", hi: "दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर) का ध्यान रखना", dept: "TECHNICAL" },

  // LEVEL 4
  { id: "t44", level: 4, en: "IMPORETD BRAND ORDER NIKLANA", hi: "", dept: "IMP RETAIL/RETAIL /SANCKS" },
  { id: "t45", level: 4, en: "STAFF Training System", hi: "STAFF ट्रेनिंग देना", dept: "TECHNICAL" },
  { id: "t46", level: 4, en: "Theft Prevention", hi: "चोरी रोकना (Thrift Prevention)", dept: "TECHNICAL" },
  { id: "t47", level: 4, en: "Shutter Lock (Open/Close)", hi: "दुकान के शटर खोलना और बंद करना", dept: "TECHNICAL" },
  { id: "t48", level: 4, en: "Fire Safety & CCTV Checking", hi: "फायर सेफ्टी और CCTV की चेकिंग", dept: "TECHNICAL" },
  { id: "t49", level: 4, en: "Staff Management", hi: "पूरे स्टाफ का मैनेजमेंट", dept: "TECHNICAL" },
  { id: "t56", level: 4, en: "License & Legal Books (Excise)", hi: "एक्साइज रजिस्टर, शॉप एक्ट और जरूरी दस्तावेज संभालना", dept: "EXCISE" },
  { id: "t57", level: 4, en: "Shop Property Maintenance", hi: "दुकान की प्रॉपर्टी (बाइक, मशीन, कैलकुलेटर A TO Z) का ध्यान रखना", dept: "TECHNICAL" },
  { id: "t58", level: 4, en: "Level Up Boys", hi: "लड़कों का लेवल बढ़ाना", dept: "TECHNICAL" },
  { id: "t59", level: 4, en: "TASK COMPLETE KARWANA", hi: "", dept: "TECHNICAL" },
  { id: "t60", level: 4, en: "CASH HANDLING", hi: "", dept: "RETAIL" }
];

export default function EmployeeLearning() {
  const { user: currentUserObj } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showNewChecklistModal, setShowNewChecklistModal] = useState(false);
  const [shops, setShops] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedShop, setSelectedShop] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [checkedTasks, setCheckedTasks] = useState({});
  const [submissions, setSubmissions] = useState(() => {
    try {
      const stored = localStorage.getItem('drinqkart_employee_learning_submissions');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  // Modal State
  const [selectedModalEmp, setSelectedModalEmp] = useState(null);

  // Role & Permission Checks for Checklist Creation
  const userRole = (currentUserObj?.role || '').toLowerCase().trim();
  const userNameClean = (currentUserObj?.user_name || currentUserObj?.username || '').toLowerCase().trim();
  
  // Explicit Admin / Master / MasterAdmin check
  const isAdminUser = userRole === 'admin' || userRole === 'master' || userNameClean === 'masteradmin' || userNameClean === 'testadmin';
  const isManagerUser = userRole === 'manager';
  
  // Check if Manager has explicit modify permission for Employee Learning or HR system
  const hasModifyPermission = React.useMemo(() => {
    if (isAdminUser) return true;
    if (!isManagerUser || !currentUserObj) return false;

    // Check account status
    if (currentUserObj.is_active === false || currentUserObj.status === 'inactive') return false;

    // Parse master_user_system_page_access permission strings
    const rawVal = currentUserObj.master_user_system_page_access || localStorage.getItem('master_user_system_page_access');
    let pageAccessArr = [];
    if (typeof rawVal === 'string') {
      try { pageAccessArr = JSON.parse(rawVal); } catch (e) { pageAccessArr = []; }
    } else if (Array.isArray(rawVal)) {
      pageAccessArr = rawVal;
    } else if (rawVal && typeof rawVal === 'object') {
      pageAccessArr = Object.keys(rawVal);
    }

    // Require explicit .modify permission entry for Manager
    if (Array.isArray(pageAccessArr) && pageAccessArr.length > 0) {
      return pageAccessArr.some(item => {
        if (typeof item !== 'string') return false;
        const norm = item.toLowerCase().trim();
        return (
          norm === 'hr.employee learning.modify' ||
          norm === 'hr.employee_learning.modify' ||
          norm === 'hr.employees.modify' ||
          norm === 'hr.dashboard.modify' ||
          norm.endsWith('.modify')
        );
      });
    }

    // Default to false for manager if no explicit modify permission string exists
    return false;
  }, [currentUserObj, isAdminUser, isManagerUser]);
  
  const canCreateChecklist = isAdminUser || (isManagerUser && hasModifyPermission);

  useEffect(() => {
    loadInitialData();

    // Auto-refresh when returning to window/tab
    const onFocus = () => loadInitialData();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [currentUserObj]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Fetch shops
      const { data: shopData } = await supabase
        .from('shop')
        .select('*')
        .order('shop_name', { ascending: true });
      
      let allShops = shopData || [];

      // Filter shops for non-admin manager
      if (currentUserObj) {
        const uRole = (currentUserObj.role || '').toLowerCase().trim();
        const uName = (currentUserObj.user_name || currentUserObj.username || '').toLowerCase().trim();
        const isAdm = uRole === 'admin' || uRole === 'master' || uName === 'masteradmin' || uName === 'testadmin';
        
        if (!isAdm) {
          const userShopsStr = (currentUserObj.shop_name || currentUserObj.user_access || '').toString().trim().toLowerCase();
          const userShopsList = userShopsStr.split(',').map(s => s.trim()).filter(Boolean);

          if (userShopsList.length > 0) {
            allShops = allShops.filter(s => {
              const shopNameLower = (s.shop_name || '').toLowerCase().trim();
              return userShopsList.some(userShop => shopNameLower.includes(userShop) || userShop.includes(shopNameLower));
            });
          }
        }
      }

      setShops(allShops);

      // Fetch active users from 'users' table (Master Settings user management) and HR tables
      const [{ data: masterUsersData }, { data: hrMgmtData }, { data: empData }] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('hr_management_employees').select('*'),
        supabase.from('employees').select('*')
      ]);

      // Build active status map from Master Setting users table
      const activeUserEmpIdSet = new Set();
      const activeUserNameSet = new Set();
      const inactiveUserEmpIdSet = new Set();
      const inactiveUserNameSet = new Set();

      (masterUsersData || []).forEach(u => {
        const rawStatus = u.status ?? u.is_active ?? 'active';
        const isInactive = 
          rawStatus === false ||
          rawStatus === 0 ||
          ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());
        
        const empId = (u.employee_id || '').toString().trim().toLowerCase();
        const uname = (u.user_name || u.username || u.emp_name || '').toString().trim().toLowerCase();

        if (isInactive) {
          if (empId) inactiveUserEmpIdSet.add(empId);
          if (uname) inactiveUserNameSet.add(uname);
        } else {
          if (empId) activeUserEmpIdSet.add(empId);
          if (uname) activeUserNameSet.add(uname);
        }
      });

      const combinedMap = new Map();

      const addEmp = (emp) => {
        if (!emp) return;
        const details = emp.HR_SYSTEM_employee_data || {};
        const name = emp.name_as_per_aadhar || details.name_as_per_aadhar || emp.name || emp.employee_name || emp.candidate_name;
        const id = (emp.employee_id || details.employee_id || emp.id || '').toString().trim();
        const shop = emp.joining_company_name || details.joining_company_name || emp.joining_place || details.joining_place || '';
        
        const normId = id.toLowerCase();
        const normName = (name || '').toLowerCase().trim();

        if (!name) return;

        // If user is explicitly set inactive in Master Setting users table, skip
        if ((normId && inactiveUserEmpIdSet.has(normId)) || (normName && inactiveUserNameSet.has(normName))) {
          return;
        }

        // Check local record status
        const rawStatus = emp.status ?? details.status ?? emp.is_active ?? details.is_active ?? 'Active';
        const isInactive = 
          rawStatus === false ||
          rawStatus === 0 ||
          ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());

        if (isInactive) return;

        const dedupeKey = normId || normName;
        const existing = combinedMap.get(dedupeKey);

        // If not added, or existing entry has shorter name/missing shop, prefer full HR record
        if (!existing || (name.trim().length > (existing.name_as_per_aadhar || '').length)) {
          combinedMap.set(dedupeKey, {
            id: id || name,
            employee_id: id,
            name_as_per_aadhar: name.trim(),
            joining_company_name: shop || (existing ? existing.joining_company_name : ''),
            status: 'Active'
          });
        }
      };

      // 1. Process HR tables first so full Aadhar name and exact employee_id take primary precedence
      (hrMgmtData || []).forEach(addEmp);
      (empData || []).forEach(addEmp);

      // 2. Add users table entries only if employee_id or name doesn't already exist
      (masterUsersData || []).forEach(u => {
        const rawStatus = u.status ?? u.is_active ?? 'active';
        const isInactive = 
          rawStatus === false ||
          rawStatus === 0 ||
          ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());
        
        if (!isInactive) {
          const name = u.emp_name || u.user_name || u.username;
          const id = (u.employee_id || u.id || '').toString().trim();
          const shop = u.shop_name || u.user_access || '';
          const normId = id.toLowerCase();
          const normName = (name || '').toLowerCase().trim();
          const dedupeKey = normId || normName;

          if (name && !combinedMap.has(dedupeKey)) {
            combinedMap.set(dedupeKey, {
              id: id || name,
              employee_id: id,
              name_as_per_aadhar: name.trim(),
              joining_company_name: shop,
              status: 'Active'
            });
          }
        }
      });

      const combinedList = Array.from(combinedMap.values());
      combinedList.sort((a, b) => a.name_as_per_aadhar.localeCompare(b.name_as_per_aadhar));

      // -------------------------------------------------------------
      // ROLE & SHOP ACCESS CONTROL:
      // - User: Only sees himself/herself
      // - Manager: Sees all employees belonging to their affiliated shop(s)
      // - Admin / MasterAdmin: Sees all employees across all shops
      // -------------------------------------------------------------
      let scopedList = combinedList;

      if (currentUserObj) {
        const isAdmin = userRole === 'admin' || userRole === 'master' || userNameClean === 'masteradmin' || userNameClean === 'testadmin';

        const currentEmpId = (currentUserObj.employee_id || '').toString().trim().toLowerCase();
        const currentUserName = (currentUserObj.user_name || currentUserObj.username || currentUserObj.emp_name || '').toString().trim().toLowerCase();
        const userShopsStr = (currentUserObj.shop_name || currentUserObj.user_access || '').toString().trim().toLowerCase();
        const userShopsList = userShopsStr.split(',').map(s => s.trim()).filter(Boolean);

        if (!isAdmin) {
          if (userRole === 'manager') {
            // Manager: Access to all employees belonging to their affiliated shop(s)
            if (userShopsList.length > 0) {
              scopedList = combinedList.filter(emp => {
                const empShopNorm = (emp.joining_company_name || emp.shop_name || '').toString().trim().toLowerCase();
                return userShopsList.some(s => empShopNorm.includes(s) || s.includes(empShopNorm));
              });
            }
          } else {
            // Regular Employee / User: Access to himself/herself matching by employee_id or name
            scopedList = combinedList.filter(emp => {
              const empIdNorm = (emp.employee_id || '').toString().trim().toLowerCase();
              const empNameNorm = (emp.name_as_per_aadhar || '').toString().trim().toLowerCase();
              
              const matchId = currentEmpId && empIdNorm && (currentEmpId === empIdNorm || empIdNorm.includes(currentEmpId));
              const matchName = currentUserName && empNameNorm && (
                currentUserName === empNameNorm ||
                currentUserName.includes(empNameNorm) ||
                empNameNorm.includes(currentUserName)
              );

              return matchId || matchName;
            });

            // Fallback if no exact match
            if (scopedList.length === 0 && currentUserName) {
              scopedList = [{
                id: currentEmpId || currentUserName,
                employee_id: currentEmpId,
                name_as_per_aadhar: currentUserObj.emp_name || currentUserObj.user_name || currentUserObj.username,
                joining_company_name: currentUserObj.shop_name || '',
                status: 'Active'
              }];
            }
          }
        }
      }

      setEmployees(scopedList);
      setFilteredEmployees(scopedList);

      // 1. Sync / fetch task catalog from Supabase hr_learning_tasks
      await syncTasksWithSupabase();

      // 2. Load submissions from Supabase hr_learning_submissions
      await loadSubmissionsFromSupabase();
    } catch (err) {
      console.error('Error loading initial data:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncTasksWithSupabase = async () => {
    try {
      const { data: existingDbTasks, error: fetchErr } = await supabase
        .from('hr_learning_tasks')
        .select('*');

      if (!fetchErr && existingDbTasks && existingDbTasks.length > 0) {
        // Map database records to state catalog
        const mapped = existingDbTasks.map(t => ({
          id: t.id,
          level: t.level,
          dept: t.dept,
          en: t.task_en,
          hi: t.task_hi || '',
          tag: t.tag || ''
        }));
        setDbTasks(mapped);
      } else {
        // Table is empty or freshly created — auto populate seed records
        const seedPayload = INITIAL_TASKS.map(t => ({
          id: t.id,
          level: t.level,
          dept: t.dept,
          task_en: t.en,
          task_hi: t.hi || null,
          tag: t.tag || null
        }));

        const { error: seedErr } = await supabase
          .from('hr_learning_tasks')
          .upsert(seedPayload, { onConflict: 'id' });

        if (seedErr) console.warn('Supabase task seed warning:', seedErr.message);
        setDbTasks(INITIAL_TASKS);
      }
    } catch (e) {
      console.error('Failed syncing tasks with Supabase:', e);
      setDbTasks(INITIAL_TASKS);
    }
  };

  const loadSubmissionsFromSupabase = async () => {
    try {
      const { data: dbSubs, error } = await supabase
        .from('hr_learning_submissions')
        .select('*')
        .order('id', { ascending: false });

      if (!error && dbSubs) {
        let mappedSubs = dbSubs.map(s => {
          let tasksArr = [];
          if (typeof s.tasks_data === 'string') {
            try { tasksArr = JSON.parse(s.tasks_data); } catch (e) { tasksArr = []; }
          } else if (Array.isArray(s.tasks_data)) {
            tasksArr = s.tasks_data;
          }

          return {
            id: s.id,
            ts: new Date(s.created_at || Date.now()).getTime(),
            date: s.submission_date,
            shop: s.shop_name,
            employee: s.employee_name,
            employee_id: s.employee_id,
            tasks: tasksArr
          };
        });

        // -------------------------------------------------------------
        // SCOPE SUBMISSIONS BASED ON ROLE & SHOP ACCESS
        // -------------------------------------------------------------
        if (currentUserObj) {
          const isAdmin = userRole === 'admin' || userRole === 'master' || userNameClean === 'masteradmin' || userNameClean === 'testadmin';

          const currentEmpId = (currentUserObj.employee_id || '').toString().trim().toLowerCase();
          const currentUserName = (currentUserObj.user_name || currentUserObj.username || currentUserObj.emp_name || '').toString().trim().toLowerCase();
          const userShopsStr = (currentUserObj.shop_name || currentUserObj.user_access || '').toString().trim().toLowerCase();
          const userShopsList = userShopsStr.split(',').map(s => s.trim()).filter(Boolean);

          if (!isAdmin) {
            if (userRole === 'manager') {
              if (userShopsList.length > 0) {
                mappedSubs = mappedSubs.filter(s => {
                  const subShop = (s.shop || '').toString().trim().toLowerCase();
                  return userShopsList.some(shopToken => subShop.includes(shopToken) || shopToken.includes(subShop));
                });
              }
            } else {
              mappedSubs = mappedSubs.filter(s => {
                const subEmpId = (s.employee_id || '').toString().trim().toLowerCase();
                const subEmpName = (s.employee || '').toString().trim().toLowerCase();

                const matchId = currentEmpId && subEmpId && (currentEmpId === subEmpId || subEmpId.includes(currentEmpId));
                const matchName = currentUserName && subEmpName && (
                  currentUserName === subEmpName ||
                  currentUserName.includes(subEmpName) ||
                  subEmpName.includes(currentUserName)
                );

                return matchId || matchName;
              });
            }
          }
        }

        if (mappedSubs.length > 0) {
          setSubmissions(mappedSubs);
          localStorage.setItem('drinqkart_employee_learning_submissions', JSON.stringify(mappedSubs));
        } else {
          // If query returned 0 items (e.g. scoping issue or cold cache), check if local storage has existing records
          const stored = localStorage.getItem('drinqkart_employee_learning_submissions');
          if (stored) {
            try {
              const localSubs = JSON.parse(stored);
              setSubmissions(localSubs.length > 0 ? localSubs : dbSubs);
            } catch (e) {
              setSubmissions(dbSubs);
            }
          } else {
            setSubmissions(dbSubs);
          }
        }
      } else {
        loadSubmissionsFromLocalStorage();
      }
    } catch (e) {
      console.error('Error fetching submissions from Supabase:', e);
      loadSubmissionsFromLocalStorage();
    }
  };

  const loadSubmissionsFromLocalStorage = () => {
    try {
      const stored = localStorage.getItem('drinqkart_employee_learning_submissions');
      if (stored) {
        setSubmissions(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading stored submissions:', e);
    }
  };

  const saveSubmissionToSupabase = async (newSub) => {
    try {
      // Check if submission record already exists for this employee_id or employee_name
      let existingId = null;
      if (newSub.employee_id) {
        const { data: existingByEmpId } = await supabase
          .from('hr_learning_submissions')
          .select('id')
          .eq('employee_id', newSub.employee_id)
          .limit(1);
        if (existingByEmpId && existingByEmpId.length > 0) {
          existingId = existingByEmpId[0].id;
        }
      }

      if (!existingId && newSub.employee) {
        const { data: existingByName } = await supabase
          .from('hr_learning_submissions')
          .select('id')
          .eq('employee_name', newSub.employee)
          .limit(1);
        if (existingByName && existingByName.length > 0) {
          existingId = existingByName[0].id;
        }
      }

      const payload = {
        submission_date: newSub.date,
        shop_name: newSub.shop,
        employee_name: newSub.employee,
        employee_id: newSub.employee_id || null,
        tasks_data: newSub.tasks
      };

      if (existingId) {
        payload.id = existingId;
        const { error } = await supabase
          .from('hr_learning_submissions')
          .upsert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('hr_learning_submissions')
          .insert([payload]);
        if (error) throw error;
      }

      await loadSubmissionsFromSupabase();
    } catch (e) {
      console.warn('Fallback to local storage submission save:', e.message || e);
      // Filter out existing sub for this employee in local storage array
      const filteredOld = submissions.filter(s => {
        const sameId = s.employee_id && newSub.employee_id && (s.employee_id.toString().trim() === newSub.employee_id.toString().trim());
        const sameName = s.employee && newSub.employee && (s.employee.toString().trim().toLowerCase() === newSub.employee.toString().trim().toLowerCase());
        return !(sameId || sameName);
      });
      const updated = [newSub, ...filteredOld];
      setSubmissions(updated);
      localStorage.setItem('drinqkart_employee_learning_submissions', JSON.stringify(updated));
    }
  };

  const handleShopChange = (e) => {
    const shopVal = e.target.value;
    setSelectedShop(shopVal);
    setSelectedEmployee('');
    setCheckedTasks({});

    if (!shopVal) {
      setFilteredEmployees([]);
      return;
    }

    const shopLower = shopVal.toLowerCase().trim();
    
    // Filter employees assigned to this specific shop
    const matched = employees.filter(emp => {
      const empShop = (
        emp.joining_company_name ||
        emp.shop_name ||
        emp.user_access ||
        emp.joining_place ||
        ''
      ).toLowerCase().trim();

      if (!empShop) return false;

      // Direct match or partial token match (e.g. "Kunal Ulwe" / "Kunal")
      return (
        empShop === shopLower ||
        empShop.includes(shopLower) ||
        shopLower.includes(empShop)
      );
    });

    setFilteredEmployees(matched);
  };

  const handleEmployeeChange = (e) => {
    const empVal = e.target.value;
    setSelectedEmployee(empVal);

    if (!empVal) {
      setCheckedTasks({});
      return;
    }

    const empObj = filteredEmployees.find(
      (emp) =>
        (emp.employee_id && emp.employee_id.toString().trim() === empVal.toString().trim()) ||
        (emp.id && emp.id.toString().trim() === empVal.toString().trim()) ||
        (emp.name_as_per_aadhar && emp.name_as_per_aadhar.trim() === empVal.trim())
    );

    const empId = empObj?.employee_id || empObj?.id || empVal;
    const empName = empObj?.name_as_per_aadhar || empVal;

    // Search existing submission for this employee
    const existingSub = submissions.find((s) => {
      const sameId = s.employee_id && empId && (s.employee_id.toString().trim() === empId.toString().trim());
      const sameName = s.employee && empName && (s.employee.toString().trim().toLowerCase() === empName.toString().trim().toLowerCase());
      return sameId || sameName;
    });

    if (existingSub && Array.isArray(existingSub.tasks)) {
      const initialChecked = {};
      existingSub.tasks.forEach((t) => {
        if (t.checked) {
          initialChecked[t.id] = true;
        }
      });
      setCheckedTasks(initialChecked);
    } else {
      setCheckedTasks({});
    }
  };

  const toggleTask = (id) => {
    setCheckedTasks(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSubmit = async () => {
    if (!canCreateChecklist) {
      showToast('Permission Denied: Only Manager & Admin can submit checklists');
      return;
    }

    if (!selectedShop || !selectedEmployee) return;

    const empObj = employees.find(
      (e) =>
        e.employee_id?.toString() === selectedEmployee?.toString() ||
        e.id?.toString() === selectedEmployee?.toString() ||
        e.name_as_per_aadhar === selectedEmployee
    );
    const empName = empObj ? empObj.name_as_per_aadhar : selectedEmployee;
    const empId = empObj ? empObj.employee_id || empObj.id : selectedEmployee;

    const newRecord = {
      ts: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      shop: selectedShop,
      employee: empName,
      employee_id: empId ? empId.toString() : null,
      tasks: TASKS.map(t => ({
        id: t.id,
        en: t.en,
        hi: t.hi,
        dept: t.dept,
        level: t.level,
        checked: !!checkedTasks[t.id]
      }))
    };

    setSubmitting(true);
    try {
      await saveSubmissionToSupabase(newRecord);
      showToast(`Checklist submitted for ${empName}`);
      setCheckedTasks({});
    } catch (e) {
      console.error('Submission error:', e);
      showToast(`Saved locally for ${empName}`);
    } finally {
      setSubmitting(false);
    }
  };

  const deptOrder = () => {
    const seen = [];
    TASKS.forEach(t => {
      if (!seen.includes(t.dept)) seen.push(t.dept);
    });
    return seen;
  };

  const getInitials = (name) => {
    if (!name) return 'EMP';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Dashboard calculations
  const totalSubs = submissions.length;
  const totalTasksTicked = submissions.reduce((sum, s) => sum + s.tasks.filter(t => t.checked).length, 0);
  const activeEmployeesSet = new Set(submissions.map(s => s.employee)).size;
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#4f9d8a] text-[#0e1a17] px-5 py-3 rounded-md font-semibold text-sm shadow-xl transition-all animate-bounce">
          {toastMsg}
        </div>
      )}

      {/* Full-width Header Bar matching HR System style */}
      <div className="bg-white shadow-sm border border-slate-200 p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-slate-900 flex items-center gap-2">
            <span className="text-[#d4b457]">Employee Learning</span> — Staff Task Checklist
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track department and level-wise employee learning progress across 4 levels.
          </p>
        </div>

        {/* Action Button */}
        {canCreateChecklist && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowNewChecklistModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer rounded"
            >
              <span className="text-sm font-bold">+</span>
              <span>New Checklist</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="min-w-0">
        {activeTab === 'form' ? (
          <section className="space-y-6">
            <div className="bg-white border border-slate-200 p-5 shadow-sm">
              <h1 className="text-xl font-serif font-bold text-slate-900">Employee Task Checklist Matrix</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Select the shop and employee, then tick off each completed task across all four levels — grouped by department, same as the register.
              </p>
            </div>

            {/* Form Selection Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="bg-white border border-slate-200 p-4 shadow-sm rounded">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  SHOP NAME *
                </label>
                <select
                  value={selectedShop}
                  onChange={handleShopChange}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4b457] cursor-pointer font-medium"
                >
                  <option value="">Select shop…</option>
                  {shops.length > 0 ? (
                    shops.map((s) => (
                      <option key={s.id} value={s.shop_name}>
                        {s.shop_name}
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="Kunal">Kunal</option>
                      <option value="Vishal">Vishal</option>
                    </>
                  )}
                </select>
              </div>

              <div className="bg-white border border-slate-200 p-4 shadow-sm rounded">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                  EMPLOYEE *
                </label>
                <select
                  disabled={!selectedShop}
                  value={selectedEmployee}
                  onChange={handleEmployeeChange}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4b457] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
                >
                  <option value="">
                    {!selectedShop
                      ? 'Select shop first…'
                      : filteredEmployees.length === 0
                      ? 'No employees registered for this shop'
                      : 'Select employee…'}
                  </option>
                  {filteredEmployees.map((emp, idx) => {
                    const empName = emp.name_as_per_aadhar || emp.name || emp.employee_name || emp.candidate_name || `Employee #${emp.employee_id || emp.id || idx + 1}`;
                    const empId = emp.employee_id || emp.id || idx;
                    return (
                      <option key={empId} value={empId}>
                        {empName} ({empId})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>

            {/* Checklist Matrix Table */}
            {!selectedShop || !selectedEmployee ? (
              <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400 text-sm">
                Select a shop and employee above to load the interactive task checklist.
              </div>
            ) : (
              <div className="bg-white border border-slate-200 shadow-sm overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[950px] text-sm">
                  <thead>
                    <tr className="bg-[#1C120C] text-[#d4b457] text-[11px] uppercase font-serif tracking-wider border-b border-[#1C120C]">
                      <th className="py-3.5 px-4 min-w-[150px]">DEPARTMENT</th>
                      <th className="py-3.5 px-4 min-w-[220px]">LEVEL 1</th>
                      <th className="py-3.5 px-2 w-11 text-center">✓</th>
                      <th className="py-3.5 px-4 min-w-[220px]">LEVEL 2</th>
                      <th className="py-3.5 px-2 w-11 text-center">✓</th>
                      <th className="py-3.5 px-4 min-w-[220px]">LEVEL 3</th>
                      <th className="py-3.5 px-2 w-11 text-center">✓</th>
                      <th className="py-3.5 px-4 min-w-[220px]">LEVEL 4</th>
                      <th className="py-3.5 px-2 w-11 text-center">✓</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {deptOrder().map((dept) => {
                      const deptTasks = TASKS.filter((t) => t.dept === dept).sort((a, b) => a.level - b.level);
                      return deptTasks.map((t, idx) => {
                        const checked = !!checkedTasks[t.id];
                        return (
                          <tr key={t.id} className={idx === 0 ? 'border-t border-slate-200 bg-slate-50/50' : 'hover:bg-slate-50'}>
                            <td className="py-2.5 px-4 text-emerald-700 font-bold text-xs whitespace-nowrap">
                              {idx === 0 ? dept : ''}
                            </td>

                            {[1, 2, 3, 4].map((lvl) => {
                              if (t.level === lvl) {
                                return (
                                  <React.Fragment key={lvl}>
                                    <td className="py-2.5 px-4">
                                      <p className="text-slate-900 text-xs font-semibold">{t.en}</p>
                                      {t.hi && <p className="text-slate-500 text-[11px] mt-0.5">{t.hi}</p>}
                                      {t.tag && (
                                        <span className="inline-block mt-1 text-[10px] text-slate-500 border border-slate-300 rounded-full px-2 py-0.5 font-medium">
                                          {t.tag}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-2 text-center">
                                      <button
                                        onClick={() => toggleTask(t.id)}
                                        className={`w-5 h-5 rounded border border-slate-300 flex items-center justify-center transition-all cursor-pointer ${checked
                                            ? 'bg-[#d4b457] border-[#d4b457] text-slate-950 font-bold'
                                            : 'bg-white text-transparent hover:border-[#d4b457]'
                                          }`}
                                      >
                                        ✓
                                      </button>
                                    </td>
                                  </React.Fragment>
                                );
                              }
                              return (
                                <React.Fragment key={lvl}>
                                  <td></td>
                                  <td className="py-2.5 px-2 text-center">
                                    <button disabled className="w-5 h-5 rounded border border-slate-100 bg-slate-50 opacity-30 cursor-not-allowed" />
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      });
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sticky Submit Bar */}
            {selectedShop && selectedEmployee && (
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs p-4 border border-slate-200 shadow-lg rounded-t flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-600 flex items-center gap-4 font-medium">
                  <span>
                    <b className="text-slate-900 font-bold">
                      {Object.values(checkedTasks).filter(Boolean).length}
                    </b>{' '}
                    of {TASKS.length} tasks ticked overall
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">
                    {[1, 2, 3, 4]
                      .map((lvl) => {
                        const total = TASKS.filter((t) => t.level === lvl).length;
                        const done = TASKS.filter((t) => t.level === lvl && checkedTasks[t.id]).length;
                        return `L${lvl}: ${done}/${total}`;
                      })
                      .join(' · ')}
                  </span>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 px-6 py-2.5 rounded text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Submit Checklist'}
                </button>
              </div>
            )}
          </section>
        ) : (
          /* Dashboard View */
          <section className="space-y-6">
            {canCreateChecklist && (
              <div className="flex justify-end hidden">
                <button
                  onClick={() => setShowNewChecklistModal(true)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors shadow-sm cursor-pointer rounded shrink-0"
                >
                  <span className="text-base font-bold">+</span>
                  <span>New Checklist</span>
                </button>
              </div>
            )}

            {/* Stat Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200 shadow-sm p-4 rounded">
                <div className="text-3xl font-serif font-bold text-slate-900">{totalSubs}</div>
                <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-mono font-bold">CHECKLISTS SUBMITTED</div>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm p-4 rounded">
                <div className="text-3xl font-serif font-bold text-[#d4b457]">{totalTasksTicked}</div>
                <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-mono font-bold">TASKS COMPLETED (TOTAL)</div>
              </div>
              <div className="bg-white border border-slate-200 shadow-sm p-4 rounded">
                <div className="text-3xl font-serif font-bold text-emerald-600">{activeEmployeesSet}</div>
                <div className="text-[11px] text-slate-500 mt-1 uppercase tracking-wider font-mono font-bold">EMPLOYEES WITH RECORDS</div>
              </div>
            </div>

            <div className='pb-4'>
              <input type="search" className='w-full' placeholder='Search' value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
            

            {/* Active Employees Directory Table */}
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden rounded">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <span>Active Employees Directory</span>
                  <span className="text-xs font-mono font-normal text-slate-500">({employees.length})</span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1C120C] text-[#d4b457] uppercase font-serif text-[11px] tracking-wider border-b border-[#1C120C]">
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">Shop Location</th>
                      <th className="py-3 px-4 text-center">Submissions</th>
                      <th className="py-3 px-4 text-center">Tasks Completed</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {employees.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-6 text-center text-slate-400 italic">
                          No active employees found.
                        </td>
                      </tr>
                    ) : (
                      employees.map((emp) => {
                        const empName = emp.name_as_per_aadhar || emp.name || 'Employee';
                        const empId = (emp.employee_id || emp.id || '').toString().trim();
                        const empIdNorm = empId.toLowerCase();
                        const empNameNorm = (empName || '').toString().trim().toLowerCase();

                        // Match submissions by employee_id or name
                        const empSubs = submissions.filter((s) => {
                          const subEmpId = (s.employee_id || '').toString().trim().toLowerCase();
                          const subEmpName = (s.employee || '').toString().trim().toLowerCase();

                          const matchId = empIdNorm && subEmpId && (empIdNorm === subEmpId || subEmpId.includes(empIdNorm));
                          const matchName = empNameNorm && subEmpName && (
                            empNameNorm === subEmpName ||
                            empNameNorm.includes(subEmpName) ||
                            subEmpName.includes(empNameNorm)
                          );

                          return matchId || matchName;
                        });
                        const doneCount = empSubs.reduce((n, s) => n + s.tasks.filter((t) => t.checked).length, 0);

                        return (
                          <tr key={emp.id || emp.employee_id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-500 font-bold">{empId || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full bg-[#1C120C] border border-[#d4b457]/40 flex items-center justify-center font-serif text-[11px] text-[#d4b457] font-bold shrink-0">
                                  {getInitials(empName)}
                                </div>
                                <span className="font-bold text-slate-900">{empName}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 font-medium text-slate-600">
                              {emp.joining_company_name || emp.joining_place || emp.shop_name || 'N/A'}
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                              {empSubs.length}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[11px]">
                                {doneCount} tasks
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setSelectedModalEmp(empName)}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-[#1C120C] hover:bg-[#2a1c13] text-[#d4b457] text-[11px] font-bold rounded transition-colors cursor-pointer shadow-2xs"
                              >
                                View Profile
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Submission Log Table */}
            <div className="bg-white border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Submission Log & History
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1C120C] text-[#d4b457] uppercase font-serif text-[11px] tracking-wider border-b border-[#1C120C]">
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Shop</th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Completed</th>
                      <th className="py-3 px-4">By level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                          No checklists submitted yet.
                        </td>
                      </tr>
                    ) : (
                      submissions.map((s, idx) => {
                        const done = s.tasks.filter((t) => t.checked).length;
                        const pct = Math.round((done / s.tasks.length) * 100);
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-500">{s.date}</td>
                            <td className="py-3 px-4 font-medium text-slate-900">{s.shop}</td>
                            <td className="py-3 px-4 text-slate-950 font-bold">{s.employee}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="w-16 h-1.5 bg-slate-200 rounded inline-block align-middle mr-2 overflow-hidden">
                                <span className="h-full bg-emerald-600 block" style={{ width: `${pct}%` }} />
                              </span>
                              <span className="font-mono font-bold text-slate-800">{done}/{s.tasks.length}</span>
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              {[1, 2, 3, 4].map((lvl) => {
                                const total = s.tasks.filter((t) => t.level === lvl).length;
                                const d = s.tasks.filter((t) => t.level === lvl && t.checked).length;
                                return (
                                  <span
                                    key={lvl}
                                    className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded border mr-1 ${
                                      d === 0
                                        ? 'border-slate-200 bg-slate-50 text-slate-400'
                                        : 'border-[#d4b457]/40 bg-[#1C120C] text-[#d4b457] font-bold'
                                    }`}
                                  >
                                    L{lvl} {d}/{total}
                                  </span>
                                );
                              })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Employee Modal */}
      {selectedModalEmp && (
        <div
          className="fixed inset-0 z-50 bg-[#1A1A1A]/70 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedModalEmp(null)}
        >
          <div
            className="bg-white border border-slate-300 rounded-lg max-w-2xl w-full my-10 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1C120C] text-white p-5 border-b border-[#d4b457]/30 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-[#1C120C] border border-[#d4b457] flex items-center justify-center font-serif text-base text-[#d4b457] font-bold shadow-2xs">
                  {getInitials(selectedModalEmp)}
                </div>
                <div>
                  <h2 className="text-lg font-serif font-bold text-white">{selectedModalEmp}</h2>
                  <div className="text-xs text-[#d4b457]/80 font-mono">Staff Learning Profile & Task Progress</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedModalEmp(null)}
                className="text-white/60 hover:text-white p-1 text-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-6 text-slate-800">
              {(() => {
                const modalEmpObj = employees.find(e => e.name_as_per_aadhar === selectedModalEmp);
                const modalEmpId = (modalEmpObj?.employee_id || '').toString().trim().toLowerCase();
                const modalEmpNameNorm = (selectedModalEmp || '').toString().trim().toLowerCase();

                const empSubs = submissions.filter((s) => {
                  const subEmpId = (s.employee_id || '').toString().trim().toLowerCase();
                  const subEmpName = (s.employee || '').toString().trim().toLowerCase();
                  
                  if (modalEmpId && subEmpId) {
                    return modalEmpId === subEmpId;
                  }
                  if (modalEmpNameNorm && subEmpName) {
                    return modalEmpNameNorm === subEmpName ||
                           modalEmpNameNorm.includes(subEmpName) ||
                           subEmpName.includes(modalEmpNameNorm);
                  }
                  return false;
                });
                if (empSubs.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-dashed border-slate-300 p-6 text-center text-slate-400 rounded text-sm italic">
                      No checklists submitted for this employee yet.
                    </div>
                  );
                }

                const latestSub = empSubs[0];
                const checkedSet = new Set((latestSub?.tasks || []).filter(t => t.checked).map(t => t.id));
                const totalTicked = checkedSet.size;

                return (
                  <div className="space-y-6">
                    {/* Summary Banner */}
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Learning Progress Summary</div>
                        <div className="text-lg font-serif font-bold text-slate-900 mt-0.5">
                          {totalTicked} of {TASKS.length} Tasks Completed ({Math.round((totalTicked / TASKS.length) * 100)}%)
                        </div>
                      </div>
                      <div className="flex gap-2 text-xs font-semibold">
                        {[1, 2, 3, 4].map(lvl => {
                          const lvlTotal = TASKS.filter(t => t.level === lvl).length;
                          const lvlDone = TASKS.filter(t => t.level === lvl && checkedSet.has(t.id)).length;
                          return (
                            <div key={lvl} className="bg-white border border-slate-200 px-3 py-1.5 rounded text-center">
                              <span className="text-slate-400 block text-[10px] uppercase">L{lvl}</span>
                              <span className="text-slate-800 font-bold">{lvlDone}/{lvlTotal}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Matrix Checklist Report */}
                    <div className="bg-white border border-slate-200 shadow-xs overflow-x-auto rounded">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-[#1C120C] text-[#d4b457] text-[10px] uppercase font-serif tracking-wider border-b border-[#1C120C]">
                            <th className="py-2.5 px-2 w-[110px]">DEPT</th>
                            <th className="py-2.5 px-2 font-bold">LEVEL 1</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-2 font-bold">LEVEL 2</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-2 font-bold">LEVEL 3</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-2 font-bold">LEVEL 4</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800">
                          {deptOrder().map((dept) => {
                            const tasksByLevel = {
                              1: TASKS.filter((t) => t.dept === dept && t.level === 1),
                              2: TASKS.filter((t) => t.dept === dept && t.level === 2),
                              3: TASKS.filter((t) => t.dept === dept && t.level === 3),
                              4: TASKS.filter((t) => t.dept === dept && t.level === 4),
                            };
                            const maxRows = Math.max(
                              tasksByLevel[1].length,
                              tasksByLevel[2].length,
                              tasksByLevel[3].length,
                              tasksByLevel[4].length,
                              1
                            );

                            return Array.from({ length: maxRows }).map((_, rowIdx) => (
                              <tr
                                key={`${dept}-${rowIdx}`}
                                className={rowIdx === 0 ? 'border-t-2 border-slate-200 bg-slate-50/50' : 'hover:bg-slate-50'}
                              >
                                <td className="py-2 px-2 text-emerald-700 font-bold text-[11px] whitespace-nowrap align-top">
                                  {rowIdx === 0 ? dept : ''}
                                </td>

                                {[1, 2, 3, 4].map((lvl) => {
                                  const task = tasksByLevel[lvl][rowIdx];
                                  if (!task) {
                                    return (
                                      <React.Fragment key={lvl}>
                                        <td className="py-2 px-2"></td>
                                        <td className="py-2 px-1 text-center"></td>
                                      </React.Fragment>
                                    );
                                  }

                                  const isChecked = checkedSet.has(task.id);
                                  return (
                                    <React.Fragment key={lvl}>
                                      <td className={`py-2 px-2 align-top max-w-[180px] ${isChecked ? 'bg-emerald-50/70 border border-emerald-200/80 rounded-sm' : ''}`}>
                                        <p className={`text-xs font-semibold leading-tight ${isChecked ? 'text-emerald-950 font-bold' : 'text-slate-800'}`}>
                                          {task.en}
                                        </p>
                                        {task.hi && <p className={`text-[10px] mt-0.5 leading-tight ${isChecked ? 'text-emerald-800' : 'text-slate-500'}`}>{task.hi}</p>}
                                      </td>
                                      <td className="py-2 px-1 text-center align-top">
                                        <div
                                          className={`w-5 h-5 rounded flex items-center justify-center font-bold text-xs mx-auto ${
                                            isChecked
                                              ? 'bg-emerald-600 text-white shadow-xs'
                                              : 'bg-red-50 text-red-500 border border-red-200'
                                          }`}
                                        >
                                          {isChecked ? '✓' : '✕'}
                                        </div>
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Submission History */}
                    <div className="pt-2">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Submission Log & History</h3>
                      <div className="space-y-1">
                        {empSubs.map((s, idx) => {
                          const d = s.tasks.filter((t) => t.checked).length;
                          return (
                            <div key={idx} className="text-xs text-slate-700 font-medium bg-slate-50 border border-slate-200 p-2 rounded flex justify-between">
                              <span>📅 {s.date} — {s.shop}</span>
                              <span className="font-bold text-emerald-700">{d}/{s.tasks.length} completed</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Scrollable New Checklist Modal */}
      {showNewChecklistModal && canCreateChecklist && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-hidden"
          onClick={() => setShowNewChecklistModal(false)}
        >
          <div
            className="bg-white border border-slate-300 rounded-lg max-w-6xl w-full h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#1C120C] text-white p-4 sm:p-5 border-b border-[#d4b457]/30 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[#d4b457] text-[10px] font-mono font-bold tracking-widest uppercase block mb-0.5">
                  Staff Task Checklist Entry
                </span>
                <h2 className="text-lg sm:text-xl font-serif font-bold text-white flex items-center gap-2">
                  <span className="text-[#d4b457]">✓</span>
                  <span>New Staff Checklist</span>
                </h2>
              </div>
              <button
                onClick={() => setShowNewChecklistModal(false)}
                className="text-white/60 hover:text-white p-1.5 hover:bg-white/10 rounded-lg text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50">
              {/* Form Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                <div className="bg-white border border-slate-200 shadow-sm rounded p-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    SHOP NAME *
                  </label>
                  <select
                    value={selectedShop}
                    onChange={handleShopChange}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4b457] cursor-pointer font-medium"
                  >
                    <option value="">Select shop…</option>
                    {shops.length > 0 ? (
                      shops.map((s) => (
                        <option key={s.id || s.shop_name} value={s.shop_name}>
                          {s.shop_name}
                        </option>
                      ))
                    ) : (
                      <option value="" disabled>No authorized shops available</option>
                    )}
                  </select>
                </div>

                <div className="bg-white border border-slate-200 shadow-sm rounded p-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                    EMPLOYEE *
                  </label>
                  <select
                    disabled={!selectedShop}
                    value={selectedEmployee}
                    onChange={handleEmployeeChange}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#d4b457] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
                  >
                    <option value="">
                      {!selectedShop
                        ? 'Select shop first…'
                        : filteredEmployees.length === 0
                        ? 'No employees registered for this shop'
                        : 'Select employee…'}
                    </option>
                    {filteredEmployees.map((emp, idx) => {
                      const empName = emp.name_as_per_aadhar || emp.name || emp.employee_name || emp.candidate_name || `Employee #${emp.employee_id || emp.id || idx + 1}`;
                      const empId = emp.employee_id || emp.id || idx;
                      return (
                        <option key={empId} value={empId}>
                          {empName} ({empId})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Checklist Matrix Table */}
              {!selectedShop || !selectedEmployee ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-lg p-12 text-center text-slate-400 text-sm italic">
                  Please select a shop and an employee above to load the interactive task checklist matrix.
                </div>
              ) : (
                <div className="bg-white border border-slate-200 shadow-sm overflow-x-auto rounded">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1C120C] text-[#d4b457] text-[10px] uppercase font-serif tracking-wider border-b border-[#1C120C]">
                        <th className="py-2.5 px-2 w-[110px]">DEPT</th>
                        <th className="py-2.5 px-2 font-bold">LEVEL 1</th>
                        <th className="py-2.5 px-1 w-8 text-center">✓</th>
                        <th className="py-2.5 px-2 font-bold">LEVEL 2</th>
                        <th className="py-2.5 px-1 w-8 text-center">✓</th>
                        <th className="py-2.5 px-2 font-bold">LEVEL 3</th>
                        <th className="py-2.5 px-1 w-8 text-center">✓</th>
                        <th className="py-2.5 px-2 font-bold">LEVEL 4</th>
                        <th className="py-2.5 px-1 w-8 text-center">✓</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800">
                      {deptOrder().map((dept) => {
                        // Find max number of tasks across levels for this department
                        const tasksByLevel = {
                          1: TASKS.filter((t) => t.dept === dept && t.level === 1),
                          2: TASKS.filter((t) => t.dept === dept && t.level === 2),
                          3: TASKS.filter((t) => t.dept === dept && t.level === 3),
                          4: TASKS.filter((t) => t.dept === dept && t.level === 4),
                        };
                        const maxRows = Math.max(
                          tasksByLevel[1].length,
                          tasksByLevel[2].length,
                          tasksByLevel[3].length,
                          tasksByLevel[4].length,
                          1
                        );

                        return Array.from({ length: maxRows }).map((_, rowIdx) => (
                          <tr
                            key={`${dept}-${rowIdx}`}
                            className={rowIdx === 0 ? 'border-t-2 border-slate-200 bg-slate-50/50' : 'hover:bg-slate-50'}
                          >
                            <td className="py-2 px-2 text-emerald-700 font-bold text-[11px] whitespace-nowrap align-top">
                              {rowIdx === 0 ? dept : ''}
                            </td>

                            {[1, 2, 3, 4].map((lvl) => {
                              const task = tasksByLevel[lvl][rowIdx];
                              if (!task) {
                                return (
                                  <React.Fragment key={lvl}>
                                    <td className="py-2 px-2"></td>
                                    <td className="py-2 px-1 text-center"></td>
                                  </React.Fragment>
                                );
                              }

                              const checked = !!checkedTasks[task.id];
                              return (
                                <React.Fragment key={lvl}>
                                  <td className="py-2 px-2 align-top max-w-[180px]">
                                    <p className="text-slate-900 text-xs font-semibold leading-tight">{task.en}</p>
                                    {task.hi && <p className="text-slate-500 text-[10px] mt-0.5 leading-tight">{task.hi}</p>}
                                    {task.tag && (
                                      <span className="inline-block mt-1 text-[9px] text-slate-500 border border-slate-300 rounded px-1.5 py-0.2 font-medium">
                                        {task.tag}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-1 text-center align-top">
                                    <button
                                      type="button"
                                      onClick={() => toggleTask(task.id)}
                                      className={`w-4 h-4 rounded border border-slate-300 flex items-center justify-center transition-all cursor-pointer ${
                                        checked
                                          ? 'bg-[#d4b457] border-[#d4b457] text-slate-950 font-bold text-[10px]'
                                          : 'bg-white text-transparent hover:border-[#d4b457]'
                                      }`}
                                    >
                                      ✓
                                    </button>
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        ));
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Fixed Footer Submit Bar */}
            <div className="bg-white p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg">
              <div className="text-xs text-slate-600 flex items-center gap-4 font-medium">
                <span>
                  <b className="text-slate-900 font-bold">
                    {Object.values(checkedTasks).filter(Boolean).length}
                  </b>{' '}
                  of {TASKS.length} tasks ticked overall
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline">
                  {[1, 2, 3, 4]
                    .map((lvl) => {
                      const total = TASKS.filter((t) => t.level === lvl).length;
                      const done = TASKS.filter((t) => t.level === lvl && checkedTasks[t.id]).length;
                      return `L${lvl}: ${done}/${total}`;
                    })
                    .join(' · ')}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewChecklistModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider rounded border border-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleSubmit();
                    setShowNewChecklistModal(false);
                  }}
                  disabled={submitting || !selectedShop || !selectedEmployee}
                  className="bg-[#d4b457] hover:bg-[#c3a346] text-slate-950 px-6 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  {submitting ? 'Saving…' : 'Submit Checklist'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
