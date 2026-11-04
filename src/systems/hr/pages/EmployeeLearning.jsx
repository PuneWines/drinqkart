import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { isUserShopScoped, getUserAssignedShops, getPagePermission } from '../../../utils/permissionUtils';
import {
  Check, CheckCircle2, Clock, AlertCircle, RefreshCw, Search, Filter, X,
  GraduationCap, ClipboardCheck, Users, ChevronDown, CheckCheck
} from 'lucide-react';

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

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFilterShop, setSelectedFilterShop] = useState('');
  const [isSubmissionLogOpen, setIsSubmissionLogOpen] = useState(false);

  // Modal State
  const [selectedModalEmp, setSelectedModalEmp] = useState(null);

  // Role & Permission Checks for Checklist Creation
  const userRole = (currentUserObj?.role || '').toLowerCase().trim();
  const canCreateChecklist = getPagePermission(currentUserObj, 'hr', 'Employee Learning').canModify;

  useEffect(() => {
    loadInitialData();

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

      // Filter shops for shop-scoped roles (Admin & Manager)
      if (currentUserObj) {
        const isScoped = isUserShopScoped(currentUserObj);
        if (isScoped) {
          const userShopsList = getUserAssignedShops(currentUserObj).map(s => s.toLowerCase());
          if (userShopsList.length > 0) {
            allShops = allShops.filter(s => {
              const shopNameLower = (s.shop_name || '').toLowerCase().trim();
              return userShopsList.some(userShop => shopNameLower.includes(userShop) || userShop.includes(shopNameLower));
            });
          }
        }
      }

      setShops(allShops);

      // Fetch active users from 'users' table and HR tables
      const [{ data: masterUsersData }, { data: hrMgmtData }] = await Promise.all([
        supabase.from('users').select('*').then(res => res, () => ({ data: [] })),
        supabase.from('hr_management_employees').select('*').then(res => res, () => ({ data: [] }))
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

        if ((normId && inactiveUserEmpIdSet.has(normId)) || (normName && inactiveUserNameSet.has(normName))) {
          return;
        }

        const rawStatus = emp.status ?? details.status ?? emp.is_active ?? details.is_active ?? 'Active';
        const isInactive =
          rawStatus === false ||
          rawStatus === 0 ||
          ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());

        if (isInactive) return;

        const dedupeKey = normId || normName;
        const existing = combinedMap.get(dedupeKey);

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

      (hrMgmtData || []).forEach(addEmp);

      (masterUsersData || []).forEach(u => {
        const rawStatus = u.status ?? u.is_active ?? 'active';
        const isInactive =
          rawStatus === false ||
          rawStatus === 0 ||
          ['inactive', 'resigned', 'terminated', 'left', 'disabled', 'false', '0'].includes(String(rawStatus).toLowerCase().trim());

        if (!isInactive) {
          const name = u.emp_name || u.user_name || u.username;
          const id = (u.employee_id || u.id || '').toString().trim();
          const shop = [u.shop_name, u.user_access].filter(Boolean).join(",") || '';
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

      let scopedList = combinedList;

      if (currentUserObj) {
        const isScoped = isUserShopScoped(currentUserObj);
        const currentEmpId = (currentUserObj.employee_id || '').toString().trim().toLowerCase();
        const currentUserName = (currentUserObj.user_name || currentUserObj.username || currentUserObj.emp_name || '').toString().trim().toLowerCase();

        if (isScoped) {
          const userShopsList = getUserAssignedShops(currentUserObj).map(s => s.toLowerCase());
          if (userRole === 'admin' || userRole === 'manager') {
            if (userShopsList.length > 0) {
              scopedList = combinedList.filter(emp => {
                const empShopNorm = (emp.joining_company_name || emp.shop_name || '').toString().trim().toLowerCase();
                return userShopsList.some(s => empShopNorm.includes(s) || s.includes(empShopNorm));
              });
            }
          } else {
            scopedList = combinedList.filter(emp => {
              const empIdNorm = (emp.employee_id || emp.id || '').toString().trim().toLowerCase();
              const empNameNorm = (emp.name_as_per_aadhar || emp.name || emp.candidate_name || '').toString().trim().toLowerCase();

              const matchId = currentEmpId && empIdNorm && (
                currentEmpId === empIdNorm ||
                empIdNorm.includes(currentEmpId) ||
                currentEmpId.includes(empIdNorm) ||
                currentEmpId.replace(/^0+/, '') === empIdNorm.replace(/^0+/, '') ||
                parseInt(currentEmpId, 10) === parseInt(empIdNorm, 10)
              );

              const matchName = currentUserName && empNameNorm && (
                currentUserName === empNameNorm ||
                currentUserName.includes(empNameNorm) ||
                empNameNorm.includes(currentUserName)
              );

              return matchId || matchName;
            });

            if (scopedList.length === 0 && (currentEmpId || currentUserName)) {
              scopedList = [{
                id: currentUserObj.employee_id || currentUserObj.id || currentEmpId || currentUserName,
                employee_id: currentUserObj.employee_id || currentEmpId,
                name_as_per_aadhar: currentUserObj.emp_name || currentUserObj.user_name || currentUserObj.username || 'My Profile',
                joining_company_name: currentUserObj.shop_name || '',
                status: 'Active'
              }];
            }
          }
        }
      }

      setEmployees(scopedList);
      setFilteredEmployees(scopedList);

      await syncTasksWithSupabase();
      await loadSubmissionsFromSupabase(combinedList, scopedList);
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

      if (!fetchErr && (!existingDbTasks || existingDbTasks.length === 0)) {
        const seedPayload = TASKS.map(t => ({
          id: t.id,
          level: t.level,
          dept: t.dept,
          task_en: t.en,
          task_hi: t.hi || null,
          tag: t.tag || null
        }));

        await supabase
          .from('hr_learning_tasks')
          .upsert(seedPayload, { onConflict: 'id' });
      }
    } catch (e) {
      // Ignore task seed errors gracefully
    }
  };

  const loadSubmissionsFromSupabase = async (combinedListParam = [], scopedListParam = []) => {
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

        if (currentUserObj) {
          const isScoped = isUserShopScoped(currentUserObj);
          const currentEmpId = (currentUserObj.employee_id || '').toString().trim().toLowerCase();
          const currentUserName = (currentUserObj.user_name || currentUserObj.username || currentUserObj.emp_name || '').toString().trim().toLowerCase();

          if (isScoped) {
            const userShopsList = getUserAssignedShops(currentUserObj).map(s => s.toLowerCase());
            if (userRole === 'admin' || userRole === 'manager') {
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

                const matchId = currentEmpId && subEmpId && (
                  currentEmpId === subEmpId ||
                  subEmpId.includes(currentEmpId) ||
                  currentEmpId.includes(subEmpId) ||
                  currentEmpId.replace(/^0+/, '') === subEmpId.replace(/^0+/, '') ||
                  parseInt(currentEmpId, 10) === parseInt(subEmpId, 10)
                );

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

        setSubmissions(mappedSubs);
        localStorage.setItem('drinqkart_employee_learning_submissions', JSON.stringify(mappedSubs));
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
      let existingRecordId = null;

      if (newSub.employee_id) {
        const { data: byId } = await supabase
          .from('hr_learning_submissions')
          .select('id')
          .eq('employee_id', newSub.employee_id)
          .limit(1);

        if (byId && byId.length > 0) {
          existingRecordId = byId[0].id;
        }
      }

      if (!existingRecordId && newSub.employee) {
        const { data: byName } = await supabase
          .from('hr_learning_submissions')
          .select('id')
          .eq('employee_name', newSub.employee)
          .limit(1);

        if (byName && byName.length > 0) {
          existingRecordId = byName[0].id;
        }
      }

      const payload = {
        employee_id: newSub.employee_id || null,
        employee_name: newSub.employee,
        shop_name: newSub.shop,
        submission_date: newSub.date,
        tasks_data: newSub.tasks,
        submitted_by: currentUserObj?.user_name || currentUserObj?.username || 'admin',
        updated_at: new Date().toISOString()
      };

      if (existingRecordId) {
        await supabase
          .from('hr_learning_submissions')
          .update(payload)
          .eq('id', existingRecordId);
      } else {
        await supabase
          .from('hr_learning_submissions')
          .insert([{ ...payload, created_at: new Date().toISOString() }]);
      }
    } catch (e) {
      console.error('Error saving submission to Supabase:', e);
    }
  };

  const handleShopChange = (e) => {
    const shop = e.target.value;
    setSelectedShop(shop);
    setSelectedEmployee('');
    setCheckedTasks({});

    if (!shop) {
      setFilteredEmployees(employees);
    } else {
      const match = employees.filter((emp) => {
        const empShop = (emp.joining_company_name || emp.joining_place || emp.shop_name || '').toLowerCase();
        const searchShop = shop.toLowerCase();
        return empShop.includes(searchShop) || searchShop.includes(empShop);
      });
      setFilteredEmployees(match.length > 0 ? match : employees);
    }
  };

  const handleEmployeeChange = (e) => {
    const empId = e.target.value;
    setSelectedEmployee(empId);

    const empObj = employees.find(
      (emp) => (emp.employee_id && emp.employee_id.toString() === empId) || emp.id.toString() === empId
    );
    const empName = empObj?.name_as_per_aadhar || empObj?.name || empObj?.employee_name || empId;

    const empSubs = submissions.filter((s) => {
      const matchId = empObj?.employee_id && s.employee_id && s.employee_id.toString().trim() === empObj.employee_id.toString().trim();
      const matchName = s.employee && empName && s.employee.trim().toLowerCase() === empName.trim().toLowerCase();
      return matchId || matchName;
    });

    if (empSubs.length > 0) {
      const latestSub = empSubs[0];
      const taskState = {};
      (latestSub.tasks || []).forEach((t) => {
        if (t.checked) taskState[t.id] = true;
      });
      setCheckedTasks(taskState);
    } else {
      setCheckedTasks({});
    }
  };

  const toggleTask = (taskId) => {
    setCheckedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleSubmit = async () => {
    if (!selectedShop) {
      alert('Please select a Shop.');
      return;
    }
    if (!selectedEmployee) {
      alert('Please select an Employee.');
      return;
    }

    setSubmitting(true);
    try {
      const empObj = employees.find(
        (emp) => (emp.employee_id && emp.employee_id.toString() === selectedEmployee) || emp.id.toString() === selectedEmployee
      );
      const empName = empObj ? empObj.name_as_per_aadhar || empObj.name || empObj.employee_name : selectedEmployee;
      const empId = empObj ? empObj.employee_id || empObj.id : selectedEmployee;

      const taskPayload = TASKS.map((t) => ({
        id: t.id,
        level: t.level,
        dept: t.dept,
        en: t.en,
        hi: t.hi,
        tag: t.tag,
        checked: !!checkedTasks[t.id],
      }));

      const newSubmission = {
        id: 'sub_' + Date.now(),
        ts: Date.now(),
        date: new Date().toISOString().slice(0, 10),
        shop: selectedShop,
        employee: empName,
        employee_id: empId,
        tasks: taskPayload,
      };

      await saveSubmissionToSupabase(newSubmission);

      const existingIndex = submissions.findIndex((s) => {
        const matchId = empId && s.employee_id && s.employee_id.toString().trim() === empId.toString().trim();
        const matchName = s.employee && empName && s.employee.trim().toLowerCase() === empName.trim().toLowerCase();
        return matchId || matchName;
      });

      let updatedSubs;
      if (existingIndex >= 0) {
        updatedSubs = [...submissions];
        updatedSubs[existingIndex] = newSubmission;
      } else {
        updatedSubs = [newSubmission, ...submissions];
      }

      setSubmissions(updatedSubs);
      localStorage.setItem('drinqkart_employee_learning_submissions', JSON.stringify(updatedSubs));

      setToastMsg(`Checklist saved successfully for ${empName}!`);
      setTimeout(() => setToastMsg(''), 3500);

      setSelectedEmployee('');
      setCheckedTasks({});
      setActiveTab('dashboard');
    } catch (e) {
      console.error('Submit error:', e);
      alert('Failed to save checklist.');
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalSubs = submissions.length;
  const totalTasksTicked = useMemo(() => {
    return submissions.reduce((acc, sub) => {
      const checked = (sub.tasks || []).filter((t) => t.checked).length;
      return acc + checked;
    }, 0);
  }, [submissions]);

  const activeEmployeesSet = useMemo(() => {
    return new Set(submissions.map((s) => (s.employee_id || s.employee || '').toString().toLowerCase())).size;
  }, [submissions]);

  const deptOrder = () => {
    return Array.from(new Set(TASKS.map((t) => t.dept)));
  };

  const getInitials = (name) => {
    if (!name) return '??';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const filteredEmps = useMemo(() => {
    return employees.filter((emp) => {
      if (selectedFilterShop) {
        const empShop = (emp.joining_company_name || emp.joining_place || emp.shop_name || '').toLowerCase().trim();
        const filterShop = selectedFilterShop.toLowerCase().trim();
        const matchShop = empShop === filterShop || empShop.includes(filterShop) || filterShop.includes(empShop);
        if (!matchShop) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();
      const name = (emp.name_as_per_aadhar || emp.name || emp.employee_name || emp.candidate_name || '').toLowerCase();
      const id = (emp.employee_id || emp.id || '').toString().toLowerCase();
      const shop = (emp.joining_company_name || emp.joining_place || emp.shop_name || '').toLowerCase();

      return name.includes(term) || id.includes(term) || shop.includes(term);
    });
  }, [employees, searchTerm, selectedFilterShop]);

  const filteredSubs = useMemo(() => {
    return submissions.filter((s) => {
      if (selectedFilterShop) {
        const subShop = (s.shop || '').toLowerCase().trim();
        const filterShop = selectedFilterShop.toLowerCase().trim();
        const matchShop = subShop === filterShop || subShop.includes(filterShop) || filterShop.includes(subShop);
        if (!matchShop) return false;
      }

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();
      const emp = (s.employee || '').toLowerCase();
      const empId = (s.employee_id || '').toString().toLowerCase();
      const shop = (s.shop || '').toLowerCase();
      const date = (s.date || '').toLowerCase();

      return emp.includes(term) || empId.includes(term) || shop.includes(term) || date.includes(term);
    });
  }, [submissions, searchTerm, selectedFilterShop]);

  return (
    <div className="w-full max-w-7xl mx-auto p-3 sm:p-4 md:p-6 space-y-5 font-sans text-xs text-slate-800">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white px-5 py-3 !rounded-xl font-bold text-xs shadow-2xl transition-all flex items-center gap-2 border border-emerald-600 animate-fade-in font-sans">
          <CheckCircle2 size={16} />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Page Header matching standard DRINQKART Enterprise style */}
      <div className="bg-white p-4 sm:p-5 !rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 !rounded-2xl border border-indigo-100/80 shadow-2xs shrink-0">
            <GraduationCap size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight truncate font-sans">
              Employee Learning <span className="text-slate-400 font-normal">— Staff Task Checklist</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5 font-sans">
              Track department and level-wise employee learning progress across 4 levels.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 shrink-0">
          {canCreateChecklist && (
            <button
              onClick={() => setShowNewChecklistModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white !rounded-lg shadow-2xs transition-all cursor-pointer font-sans"
            >
              <span className="text-sm font-bold leading-none">+</span>
              <span>New Checklist</span>
            </button>
          )}
          <button
            onClick={loadInitialData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 !rounded-lg shadow-2xs transition-all cursor-pointer font-sans"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-indigo-600" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="min-w-0">
        {activeTab === 'form' ? (
          <section className="space-y-5">
            <div className="bg-white border border-slate-200/80 p-5 shadow-2xs !rounded-2xl">
              <h2 className="text-lg font-bold text-slate-900 font-sans">Employee Task Checklist Matrix</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl font-medium">
                Select the shop and employee, then tick off each completed task across all four levels — grouped by department, same as the register.
              </p>
            </div>

            {/* Form Selection Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div className="bg-white border border-slate-200/80 p-4 shadow-2xs !rounded-xl">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                  SHOP NAME *
                </label>
                <select
                  value={selectedShop}
                  onChange={handleShopChange}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 !rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium"
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

              <div className="bg-white border border-slate-200/80 p-4 shadow-2xs !rounded-xl">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                  EMPLOYEE *
                </label>
                <select
                  disabled={!selectedShop}
                  value={selectedEmployee}
                  onChange={handleEmployeeChange}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 !rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium"
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
              <div className="bg-white border border-dashed border-slate-300 !rounded-2xl p-12 text-center text-slate-400 text-xs font-medium">
                Select a shop and employee above to load the interactive task checklist.
              </div>
            ) : (
              <div className="bg-white border border-slate-200/80 shadow-2xs !rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[950px] text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase font-bold tracking-wider border-b border-slate-700">
                        <th className="py-3 px-4 min-w-[150px]">DEPARTMENT</th>
                        <th className="py-3 px-4 min-w-[220px]">LEVEL 1</th>
                        <th className="py-3 px-2 w-11 text-center">✓</th>
                        <th className="py-3 px-4 min-w-[220px]">LEVEL 2</th>
                        <th className="py-3 px-2 w-11 text-center">✓</th>
                        <th className="py-3 px-4 min-w-[220px]">LEVEL 3</th>
                        <th className="py-3 px-2 w-11 text-center">✓</th>
                        <th className="py-3 px-4 min-w-[220px]">LEVEL 4</th>
                        <th className="py-3 px-2 w-11 text-center">✓</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
                      {deptOrder().map((dept) => {
                        const deptTasks = TASKS.filter((t) => t.dept === dept).sort((a, b) => a.level - b.level);
                        return deptTasks.map((t, idx) => {
                          const checked = !!checkedTasks[t.id];
                          return (
                            <tr key={t.id} className={idx === 0 ? 'border-t border-slate-200 bg-slate-50/50' : 'hover:bg-slate-50'}>
                              <td className="py-2.5 px-4 text-indigo-700 font-bold text-xs whitespace-nowrap">
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
                                          <span className="inline-block mt-1 text-[10px] text-slate-500 border border-slate-200 bg-slate-50 !rounded-full px-2 py-0.5 font-medium">
                                            {t.tag}
                                          </span>
                                        )}
                                      </td>
                                      <td className="py-2.5 px-2 text-center">
                                        <button
                                          onClick={() => toggleTask(t.id)}
                                          className={`w-5 h-5 !rounded-md border flex items-center justify-center transition-all cursor-pointer ${checked
                                            ? 'bg-emerald-600 border-emerald-600 text-white font-bold'
                                            : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'
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
                                      <button disabled className="w-5 h-5 !rounded-md border border-slate-100 bg-slate-50 opacity-30 cursor-not-allowed" />
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
              </div>
            )}

            {/* Sticky Submit Bar */}
            {selectedShop && selectedEmployee && (
              <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs p-4 border border-slate-200/80 shadow-lg !rounded-t-2xl flex flex-wrap items-center justify-between gap-4 font-sans">
                <div className="text-xs text-slate-600 flex items-center gap-4 font-medium">
                  <span>
                    <b className="text-slate-900 font-bold font-mono">
                      {Object.values(checkedTasks).filter(Boolean).length}
                    </b>{' '}
                    of {TASKS.length} tasks ticked overall
                  </span>
                  <span className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline font-mono">
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
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 !rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Submit Checklist'}
                </button>
              </div>
            )}
          </section>
        ) : (
          /* Dashboard View */
          <section className="space-y-5">
            {/* KPI Stat Row matching enterprise StaticsCard design */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-200/80 shadow-2xs p-4 sm:p-5 !rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider font-sans">
                    Checklists Submitted
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100/80 text-indigo-700 flex items-center justify-center">
                    <ClipboardCheck size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-bold text-slate-900">{totalSubs}</div>
              </div>

              <div className="bg-white border border-slate-200/80 shadow-2xs p-4 sm:p-5 !rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider font-sans">
                    Tasks Completed (Total)
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100/80 text-violet-700 flex items-center justify-center">
                    <CheckCheck size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-bold text-violet-700">{totalTasksTicked}</div>
              </div>

              <div className="bg-white border border-slate-200/80 shadow-2xs p-4 sm:p-5 !rounded-2xl">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider font-sans">
                    Employees With Records
                  </span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100/80 text-emerald-700 flex items-center justify-center">
                    <Users size={16} />
                  </div>
                </div>
                <div className="text-3xl font-mono font-bold text-emerald-600">{activeEmployeesSet}</div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white border border-slate-200/80 p-3.5 sm:p-4 !rounded-xl shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-sans">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by employee name, ID, or shop location..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-9 pl-9 pr-8 bg-white border border-slate-200 !rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans shadow-2xs"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 text-xs cursor-pointer"
                    title="Clear search"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Filter by Shop */}
              <div className="relative md:w-64 shrink-0">
                <select
                  value={selectedFilterShop}
                  onChange={(e) => setSelectedFilterShop(e.target.value)}
                  className="w-full h-9 appearance-none pl-3 pr-8 bg-white border border-slate-200 !rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer shadow-2xs font-sans"
                >
                  <option value="">All Shops ({shops.length})</option>
                  {shops.map((s) => (
                    <option key={s.id || s.shop_name} value={s.shop_name}>
                      {s.shop_name}
                    </option>
                  ))}
                </select>
                <Filter size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Reset Filters */}
              {(searchTerm || selectedFilterShop) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedFilterShop('');
                  }}
                  className="h-9 px-3.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold !rounded-lg border border-slate-200 transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 font-sans shadow-2xs"
                >
                  <RefreshCw size={12} />
                  <span>Reset</span>
                </button>
              )}
            </div>

            {/* Submission Log & History (Collapsible Section) */}
            <div className="bg-white border border-slate-200/80 shadow-2xs overflow-hidden !rounded-xl font-sans">
              <button
                type="button"
                onClick={() => setIsSubmissionLogOpen((prev) => !prev)}
                className="w-full p-4 bg-slate-50 hover:bg-slate-100/80 border-b border-slate-200/80 flex items-center justify-between cursor-pointer transition-colors text-left select-none"
              >
                <div className="flex items-center gap-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-sans">
                    <span>Submission Log & History</span>
                    <span className="text-xs font-mono font-normal text-slate-500">
                      ({filteredSubs.length}{filteredSubs.length !== submissions.length ? ` of ${submissions.length}` : ''})
                    </span>
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 !rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {isSubmissionLogOpen ? 'Expanded' : 'Collapsed — Click to View'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-xs font-semibold">
                  <span>{isSubmissionLogOpen ? 'Hide' : 'Show'}</span>
                  <ChevronDown
                    className={`w-4 h-4 transform transition-transform duration-200 text-slate-500 ${isSubmissionLogOpen ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {isSubmissionLogOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700">
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Shop</th>
                        <th className="py-3 px-4">Employee</th>
                        <th className="py-3 px-4 text-center">Total</th>
                        <th className="py-3 px-4 text-center">Completed</th>
                        <th className="py-3 px-4 text-center">Learning</th>
                        <th className="py-3 px-4 text-center">By level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                      {filteredSubs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-8 text-center text-slate-400 italic">
                            <p>{submissions.length === 0 ? 'No checklists submitted yet.' : 'No submissions match your search or filter criteria.'}</p>
                            {(searchTerm || selectedFilterShop) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSearchTerm('');
                                  setSelectedFilterShop('');
                                }}
                                className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-bold"
                              >
                                Clear filters
                              </button>
                            )}
                          </td>
                        </tr>
                      ) : (
                        filteredSubs.map((s, idx) => {
                          const totalTasks = s.tasks?.length || 0;
                          const done = s.tasks ? s.tasks.filter((t) => t.checked).length : 0;
                          const pct = totalTasks > 0 ? Math.round((done / totalTasks) * 100) : 0;
                          return (
                            <tr key={s.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-500 whitespace-nowrap">{s.date}</td>
                              <td className="py-3 px-4 font-semibold text-slate-900">{s.shop}</td>
                              <td className="py-3 px-4 text-slate-950 font-bold">
                                <button
                                  type="button"
                                  onClick={() => setSelectedModalEmp(s.employee)}
                                  className="hover:underline hover:text-indigo-600 text-left cursor-pointer"
                                >
                                  {s.employee}
                                </button>
                              </td>
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                                {totalTasks}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <span className="inline-block font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 !rounded-full text-[11px]">
                                  {done}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <div className="inline-flex items-center gap-2">
                                  <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <span className="font-mono font-bold text-slate-800 text-[11px]">{pct}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                {[1, 2, 3, 4].map((lvl) => {
                                  const total = s.tasks ? s.tasks.filter((t) => t.level === lvl).length : 0;
                                  const d = s.tasks ? s.tasks.filter((t) => t.level === lvl && t.checked).length : 0;
                                  return (
                                    <span
                                      key={lvl}
                                      className={`inline-block text-[10px] font-mono px-2 py-0.5 !rounded-md border mr-1 ${d === 0
                                          ? 'border-slate-200 bg-slate-50 text-slate-400'
                                          : 'border-indigo-200 bg-indigo-50 text-indigo-700 font-bold'
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
              )}
            </div>

            {/* Active Employees Directory Table */}
            <div className="bg-white border border-slate-200/80 shadow-2xs overflow-hidden !rounded-xl font-sans">
              <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2 font-sans">
                  <span>Active Employees Directory</span>
                  <span className="text-xs font-mono font-normal text-slate-500">
                    ({filteredEmps.length}{filteredEmps.length !== employees.length ? ` of ${employees.length}` : ''})
                  </span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider border-b border-slate-700">
                      <th className="py-3 px-4">Employee ID</th>
                      <th className="py-3 px-4">Employee Name</th>
                      <th className="py-3 px-4">Shop Location</th>
                      <th className="py-3 px-4 text-center">Submissions</th>
                      <th className="py-3 px-4 text-center">Tasks Completed</th>
                      <th className="py-3 px-4 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <RefreshCw size={20} className="animate-spin text-indigo-600" />
                            <span className="text-xs font-semibold text-slate-600">Loading active employees directory...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredEmps.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="py-10 text-center text-slate-400 italic">
                          <p>{employees.length === 0 ? 'No active employees found.' : 'No active employees match your search or filter criteria.'}</p>
                          {(searchTerm || selectedFilterShop) && (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchTerm('');
                                setSelectedFilterShop('');
                              }}
                              className="mt-2 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline font-bold"
                            >
                              Clear filters
                            </button>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredEmps.map((emp) => {
                        const empName = emp.name_as_per_aadhar || emp.name || 'Employee';
                        const empId = (emp.employee_id || emp.id || '').toString().trim();
                        const empIdNorm = empId.toLowerCase();
                        const empNameNorm = (empName || '').toString().trim().toLowerCase();

                        const empSubs = submissions.filter((s) => {
                          const subEmpId = (s.employee_id || '').toString().trim().toLowerCase();
                          const subEmpName = (s.employee || '').toString().trim().toLowerCase();

                          const matchId = Boolean(empIdNorm && subEmpId && (
                            empIdNorm === subEmpId ||
                            subEmpId.includes(empIdNorm) ||
                            empIdNorm.includes(subEmpId) ||
                            empIdNorm.replace(/^0+/, '') === subEmpId.replace(/^0+/, '') ||
                            parseInt(empIdNorm, 10) === parseInt(subEmpId, 10)
                          ));
                          const matchName = Boolean(empNameNorm && subEmpName && (
                            empNameNorm === subEmpName ||
                            empNameNorm.includes(subEmpName) ||
                            subEmpName.includes(empNameNorm)
                          ));

                          return matchId || matchName;
                        });
                        const doneCount = empSubs.reduce((n, s) => n + (s.tasks || []).filter((t) => t.checked).length, 0);

                        return (
                          <tr key={emp.id || emp.employee_id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-500 font-bold">{empId || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 !rounded-full bg-indigo-50 border border-indigo-200/80 flex items-center justify-center text-xs text-indigo-700 font-bold shrink-0 font-sans shadow-2xs">
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
                              <span className="inline-block font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 !rounded-full text-[11px]">
                                {doneCount} tasks
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                onClick={() => setSelectedModalEmp(empName)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold !rounded-lg border border-indigo-200/80 transition-colors cursor-pointer shadow-2xs font-sans"
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
          </section>
        )}
      </div>

      {/* Employee Modal */}
      {selectedModalEmp && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto"
          onClick={() => setSelectedModalEmp(null)}
        >
          <div
            className="bg-white border border-slate-200 !rounded-2xl max-w-6xl xl:max-w-7xl w-full my-6 overflow-hidden shadow-2xl font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 !rounded-full bg-indigo-900/60 border border-indigo-400/80 flex items-center justify-center text-sm text-indigo-200 font-bold shadow-2xs font-sans">
                  {getInitials(selectedModalEmp)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white font-sans">{selectedModalEmp}</h2>
                  <div className="text-xs text-indigo-300 font-sans font-medium">Staff Learning Profile & Task Progress</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedModalEmp(null)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 !rounded-lg text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 max-h-[85vh] overflow-y-auto space-y-6 text-slate-800 font-sans">
              {(() => {
                const modalEmpObj = employees.find(e =>
                  (e.name_as_per_aadhar && e.name_as_per_aadhar === selectedModalEmp) ||
                  (e.name && e.name === selectedModalEmp) ||
                  (e.employee_name && e.employee_name === selectedModalEmp) ||
                  (e.candidate_name && e.candidate_name === selectedModalEmp)
                );
                const modalEmpId = (modalEmpObj?.employee_id || '').toString().trim().toLowerCase();
                const modalEmpNameNorm = (selectedModalEmp || '').toString().trim().toLowerCase();

                const empSubs = submissions.filter((s) => {
                  const subEmpId = (s.employee_id || '').toString().trim().toLowerCase();
                  const subEmpName = (s.employee || '').toString().trim().toLowerCase();

                  const matchId = Boolean(modalEmpId && subEmpId && (modalEmpId === subEmpId || subEmpId.includes(modalEmpId) || modalEmpId.includes(subEmpId)));
                  const matchName = Boolean(modalEmpNameNorm && subEmpName && (
                    modalEmpNameNorm === subEmpName ||
                    modalEmpNameNorm.includes(subEmpName) ||
                    subEmpName.includes(modalEmpNameNorm)
                  ));

                  return matchId || matchName;
                });
                if (empSubs.length === 0) {
                  return (
                    <div className="bg-slate-50 border border-dashed border-slate-300 p-8 text-center text-slate-400 !rounded-xl text-xs font-medium italic">
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
                    {(() => {
                      const totalTasksCount = TASKS.length;
                      const totalCheckedCount = totalTicked;
                      const totalNotOkCount = TASKS.filter(t => !checkedSet.has(t.id) && t.status === 'Not OK').length;
                      const totalMissingCount = TASKS.filter(t => !checkedSet.has(t.id) && (t.status === 'Missing' || !t.status)).length;
                      const totalIssuesCount = totalNotOkCount;

                      return (
                        <div className="bg-slate-50 border border-slate-200/80 p-4 !rounded-xl flex flex-wrap items-center justify-between gap-4 font-sans">
                          <div>
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider font-sans">Learning Progress Summary</div>
                            <div className="text-lg font-bold text-slate-900 mt-0.5 font-sans">
                              {totalCheckedCount} of {totalTasksCount} Tasks Completed ({Math.round((totalCheckedCount / totalTasksCount) * 100)}%)
                            </div>
                          </div>

                          {/* Quick Metrics Badges */}
                          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-300 !rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                              ✅ {totalCheckedCount}/{totalTasksCount} Checked
                            </span>
                            {totalNotOkCount > 0 && (
                              <span className="bg-red-50 text-red-600 border border-red-300 !rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                                ❌ {totalNotOkCount} Not OK
                              </span>
                            )}
                            {totalMissingCount > 0 && (
                              <span className="bg-amber-50 text-amber-700 border border-amber-300 !rounded-lg px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 shadow-2xs">
                                ⚠️ {totalMissingCount} Missing
                              </span>
                            )}
                            <span className={`text-xs font-extrabold px-3 py-1.5 !rounded-lg border shadow-2xs ${totalIssuesCount === 0
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-red-100 text-red-800 border-red-300'
                              }`}>
                              {totalIssuesCount === 0 ? 'All Clear ✓' : `⚠️ ${totalIssuesCount} Issue(s)`}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Matrix Checklist Report */}
                    <div className="bg-white border border-slate-200/80 shadow-2xs overflow-x-auto !rounded-xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase font-bold tracking-wider border-b border-slate-700">
                            <th className="py-2.5 px-3 w-[110px]">DEPT</th>
                            <th className="py-2.5 px-3 font-bold">LEVEL 1</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-3 font-bold">LEVEL 2</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-3 font-bold">LEVEL 3</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                            <th className="py-2.5 px-3 font-bold">LEVEL 4</th>
                            <th className="py-2.5 px-1 w-8 text-center">✓</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
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
                                <td className="py-2 px-3 text-indigo-700 font-bold text-[11px] whitespace-nowrap align-top">
                                  {rowIdx === 0 ? dept : ''}
                                </td>

                                {[1, 2, 3, 4].map((lvl) => {
                                  const task = tasksByLevel[lvl][rowIdx];
                                  if (!task) {
                                    return (
                                      <React.Fragment key={lvl}>
                                        <td className="py-2 px-3"></td>
                                        <td className="py-2 px-1 text-center"></td>
                                      </React.Fragment>
                                    );
                                  }

                                  const isChecked = checkedSet.has(task.id);
                                  return (
                                    <React.Fragment key={lvl}>
                                      <td className={`py-2 px-3 align-top min-w-[150px] ${isChecked ? 'bg-emerald-50/70 border border-emerald-200/80 !rounded-sm' : ''}`}>
                                        <p className={`text-xs font-semibold leading-tight ${isChecked ? 'text-emerald-950 font-bold' : 'text-slate-800'}`}>
                                          {task.en}
                                        </p>
                                        {task.hi && <p className={`text-[10px] mt-0.5 leading-tight ${isChecked ? 'text-emerald-800' : 'text-slate-500'}`}>{task.hi}</p>}
                                      </td>
                                      <td className="py-2 px-1 text-center align-top">
                                        <div
                                          className={`w-5 h-5 !rounded-md flex items-center justify-center font-bold text-xs mx-auto ${isChecked
                                            ? 'bg-emerald-600 text-white shadow-2xs'
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
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 font-sans">Submission Log & History</h3>
                      <div className="space-y-1.5">
                        {empSubs.map((s, idx) => {
                          const d = (s.tasks || []).filter((t) => t.checked).length;
                          return (
                            <div key={idx} className="text-xs text-slate-700 font-medium bg-slate-50 border border-slate-200/80 p-2.5 !rounded-lg flex justify-between">
                              <span>📅 {s.date} — {s.shop}</span>
                              <span className="font-bold text-emerald-700 font-mono">{d}/{s.tasks?.length || 0} completed</span>
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
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-6 overflow-hidden"
          onClick={() => setShowNewChecklistModal(false)}
        >
          <div
            className="bg-white border border-slate-200 !rounded-2xl max-w-6xl w-full h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-fade-in font-sans"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between shrink-0 font-sans">
              <div>
                <span className="text-indigo-400 text-[10px] font-mono font-bold tracking-widest uppercase block mb-0.5">
                  Staff Task Checklist Entry
                </span>
                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2 font-sans">
                  <span className="text-indigo-400">✓</span>
                  <span>New Staff Checklist</span>
                </h2>
              </div>
              <button
                onClick={() => setShowNewChecklistModal(false)}
                className="text-slate-400 hover:text-white p-1.5 hover:bg-white/10 !rounded-lg text-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Content Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50 font-sans">
              {/* Form Selection Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
                <div className="bg-white border border-slate-200/80 shadow-2xs !rounded-xl p-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                    SHOP NAME *
                  </label>
                  <select
                    value={selectedShop}
                    onChange={handleShopChange}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 !rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer font-medium font-sans"
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

                <div className="bg-white border border-slate-200/80 shadow-2xs !rounded-xl p-4">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-sans">
                    EMPLOYEE *
                  </label>
                  <select
                    disabled={!selectedShop}
                    value={selectedEmployee}
                    onChange={handleEmployeeChange}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 !rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium font-sans"
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
                <div className="bg-white border border-dashed border-slate-300 !rounded-2xl p-12 text-center text-slate-400 text-xs italic font-medium font-sans">
                  Please select a shop and an employee above to load the interactive task checklist matrix.
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 shadow-2xs overflow-hidden !rounded-xl font-sans">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-800 text-slate-200 text-[10px] uppercase font-bold tracking-wider border-b border-slate-700">
                          <th className="py-2.5 px-3 w-[110px]">DEPT</th>
                          <th className="py-2.5 px-3 font-bold">LEVEL 1</th>
                          <th className="py-2.5 px-1 w-8 text-center">✓</th>
                          <th className="py-2.5 px-3 font-bold">LEVEL 2</th>
                          <th className="py-2.5 px-1 w-8 text-center">✓</th>
                          <th className="py-2.5 px-3 font-bold">LEVEL 3</th>
                          <th className="py-2.5 px-1 w-8 text-center">✓</th>
                          <th className="py-2.5 px-3 font-bold">LEVEL 4</th>
                          <th className="py-2.5 px-1 w-8 text-center">✓</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-800 font-medium">
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
                              <td className="py-2 px-3 text-indigo-700 font-bold text-[11px] whitespace-nowrap align-top">
                                {rowIdx === 0 ? dept : ''}
                              </td>

                              {[1, 2, 3, 4].map((lvl) => {
                                const task = tasksByLevel[lvl][rowIdx];
                                if (!task) {
                                  return (
                                    <React.Fragment key={lvl}>
                                      <td className="py-2 px-3"></td>
                                      <td className="py-2 px-1 text-center"></td>
                                    </React.Fragment>
                                  );
                                }

                                const checked = !!checkedTasks[task.id];
                                return (
                                  <React.Fragment key={lvl}>
                                    <td className="py-2 px-3 align-top max-w-[180px]">
                                      <p className="text-slate-900 text-xs font-semibold leading-tight">{task.en}</p>
                                      {task.hi && <p className="text-slate-500 text-[10px] mt-0.5 leading-tight">{task.hi}</p>}
                                      {task.tag && (
                                        <span className="inline-block mt-1 text-[9px] text-slate-500 border border-slate-200 bg-slate-50 !rounded px-1.5 py-0.2 font-medium">
                                          {task.tag}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 px-1 text-center align-top">
                                      <button
                                        type="button"
                                        onClick={() => toggleTask(task.id)}
                                        className={`w-4.5 h-4.5 !rounded-md border flex items-center justify-center transition-all cursor-pointer ${checked
                                          ? 'bg-emerald-600 border-emerald-600 text-white font-bold text-[10px]'
                                          : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'
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
                </div>
              )}
            </div>

            {/* Modal Fixed Footer Submit Bar */}
            <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-lg font-sans">
              <div className="text-xs text-slate-600 flex items-center gap-4 font-medium">
                <span>
                  <b className="text-slate-900 font-bold font-mono">
                    {Object.values(checkedTasks).filter(Boolean).length}
                  </b>{' '}
                  of {TASKS.length} tasks ticked overall
                </span>
                <span className="hidden sm:inline">·</span>
                <span className="hidden sm:inline font-mono">
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
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold uppercase tracking-wider !rounded-lg border border-slate-200 transition-colors cursor-pointer font-sans shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleSubmit();
                    setShowNewChecklistModal(false);
                  }}
                  disabled={submitting || !selectedShop || !selectedEmployee}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 !rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs font-sans"
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
