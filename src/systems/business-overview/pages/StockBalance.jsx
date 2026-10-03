import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { 
  FileSpreadsheet, Upload, RefreshCw, Search, Trash2, Calendar, Store, CheckCircle, 
  AlertCircle, Database, ChevronLeft, ChevronRight, X, Check, FileCheck, Layers, 
  Eye, EyeOff, AlertTriangle, ArrowRight, Info, CheckSquare, Square, BarChart3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';

const PAGE_SIZE = 1000;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COLUMN_KEYS = {
  date: [
    'date', 'stockdate', 'entrydate', 'dt', 'billdate', 'voucherdate', 'invdate',
    'invoicedate', 'transdate', 'transactiondate', 'trndate', 'docdate', 'documentdate',
    'asondate', 'asondt', 'ason', 'reportdate', 'day', 'closingdate', 'balancedate'
  ],
  shop_id: [
    'shopid', 'shopname', 'shop', 'location', 'shoplocation', 'branch', 'branchname',
    'store', 'storename', 'outlet', 'outletname', 'godown', 'godownname', 'site',
    'unit', 'depot', 'warehouse', 'pos', 'center', 'shopno', 'shopcode', 'shopparticulars'
  ],
  item_name: [
    'itemname', 'item', 'itemdescription', 'particulars', 'productname', 'product', 
    'description', 'name', 'itemparticulars', 'items'
  ],
  opening_qty: [
    'openingqty', 'openingquantity', 'openingq', 'opqty', 'opening', 'opbal', 
    'openingbalance', 'opnqty', 'opnbalance', 'opqtycs', 'openqty'
  ],
  quantity_in: [
    'quantityin', 'qtyin', 'quantityinward', 'qtyinward', 'inqty', 'receipt', 
    'purchaseqty', 'purchasedqty', 'inward', 'in', 'purchases', 'purchase'
  ],
  quantity_out: [
    'quantityout', 'qtyout', 'quantityoutward', 'qtyoutward', 'outqty', 'issue', 
    'saleqty', 'salesqty', 'outward', 'out', 'sales', 'sale'
  ],
  closing_qty: [
    'closingqty', 'closingquantity', 'closingq', 'clqty', 'closing', 'clbal', 
    'closingbalance', 'closeqty', 'closebalance', 'balanceqty'
  ],
  purchase_rate: [
    'purchaserate', 'purchaser', 'purrate', 'purchaseprice', 'prate', 'costrate', 
    'costprice', 'rate', 'cost', 'purratecs', 'purprice'
  ],
  mrp_rate: [
    'mrprate', 'mrp', 'mrpprice', 'salesrate', 'salerate', 'mrpr', 'mrpval'
  ],
  subhead: [
    'subhead', 'subheadname', 'subcategory', 'subcat', 'head', 'category', 'group'
  ],
  brand_name: [
    'brandname', 'brand', 'branditem', 'branddesc'
  ],
  liquor_type: [
    'liquortype', 'liquor', 'type'
  ],
  b_cs: [
    'bcs', 'bc', 'casesize', 'bottlespercase', 'bottlescase', 'pack', 'packsize', 'bcase', 'bcas'
  ],
  mls: [
    'mls', 'ml', 'size', 'sizeml', 'volume', 'capacity'
  ],
  type1: ['type1', 'typ1', 'liquortype1'],
  type2: ['type2', 'typ2', 'liquortype2'],
  type3: ['type3', 'typ3', 'liquortype3'],
  type4: ['type4', 'typ4', 'liquortype4', 'country', 'origin'],
  type5: ['type5', 'typ5', 'liquortype5'],
  type6: ['type6', 'typ6', 'liquortype6'],
  company_name: [
    'companyname', 'company', 'manufacturer', 'distributor', 'mfgname', 'mfg', 'suppliercomp'
  ],
  party_name: [
    'partyname', 'party', 'supplier', 'vendor', 'suppliername', 'partyac', 'ledgername'
  ]
};

function normalizeKey(str) {
  return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getFieldValue(normalizedRow, possibleKeys) {
  for (const k of possibleKeys) {
    if (normalizedRow[k] !== undefined && normalizedRow[k] !== null && normalizedRow[k] !== '') {
      return normalizedRow[k];
    }
  }
  return '';
}

function formatDateObj(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseExcelDate(val) {
  if (val === undefined || val === null || val === '') return '';
  if (typeof val === 'number') {
    // Excel base date 1899-12-30
    const utcDays = Math.floor(val - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    const year = dateInfo.getUTCFullYear();
    const month = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateInfo.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const s = String(val).trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }
  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return `${year}-${month}-${day}`;
  }
  // DD/MM/YY or DD-MM-YY
  const dmyShortMatch = s.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{2})$/);
  if (dmyShortMatch) {
    const day = dmyShortMatch[1].padStart(2, '0');
    const month = dmyShortMatch[2].padStart(2, '0');
    let year = parseInt(dmyShortMatch[3], 10);
    year = year < 50 ? 2000 + year : 1900 + year;
    return `${year}-${month}-${day}`;
  }
  const generalDate = new Date(s);
  if (!isNaN(generalDate.getTime())) {
    return formatDateObj(generalDate);
  }
  return '';
}

function parseNum(val) {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').replace(/[^\d.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function matchShopName(shopStr, shopList) {
  if (!shopStr) return null;
  const raw = String(shopStr).trim();
  if (!raw) return null;
  const clean = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!clean) return null;

  // 1. Exact case-insensitive match (trimmed)
  for (const s of shopList) {
    const sName = String(s.name || s.shop_name || s).trim();
    if (sName.toLowerCase() === raw.toLowerCase()) {
      return sName;
    }
  }

  // 2. Alphanumeric exact match (ignoring spaces, dashes, dots, etc.)
  // e.g. "KUNAL KHARGHAR" === "kunalkharghar", "KUNAL ULWE" === "kunalulwe"
  for (const s of shopList) {
    const sName = String(s.name || s.shop_name || s).trim();
    const sClean = sName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sClean === clean) {
      return sName;
    }
  }

  // STRICT RULE: No substring or partial matches allowed.
  // If Excel specifies "Kunal", it will NOT assume "KUNAL ULWE" or "KUNAL KHARGHAR".
  // The user must specify the exact registered shop name.
  return null;
}

const DEFAULT_SHOPS = [
  'BALAJI', 'FRIENDS', 'KUNAL KHARGHAR', 'KUNAL ULWE', 'MADHURA', 'OFFICE', 'TLS'
];

export default function StockBalance() {
  const navigate = useNavigate();
  const [stockRecords, setStockRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shops, setShops] = useState([]);
  
  // Search & Filter States
  const [search, setSearch] = useState('');
  const [shopFilter, setShopFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Bulk Selection States
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  // Import Modal States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Parsed Data & Column Detection
  const [parsedRows, setParsedRows] = useState([]);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [shopColumnName, setShopColumnName] = useState('');
  const [dateColumnName, setDateColumnName] = useState('');
  
  const [selectedFileName, setSelectedFileName] = useState('');
  const [selectedFileSize, setSelectedFileSize] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showPreviewTable, setShowPreviewTable] = useState(true);

  const fileInputRef = useRef(null);

  // Fetch shops for selection and auto-matching
  useEffect(() => {
    async function loadShops() {
      try {
        let { data } = await supabase.from('shop').select('id, shop_name');
        if (!data || data.length === 0) {
          const res = await supabase.from('shops').select('id, name');
          data = res.data;
        }
        if (data && data.length > 0) {
          const formatted = data.map(s => ({
            id: s.id || s.shop_name || s.name,
            name: (s.shop_name || s.name || '').trim()
          })).filter(s => s.name);
          setShops(formatted);
        } else {
          setShops(DEFAULT_SHOPS.map(name => ({ id: name, name })));
        }
      } catch (err) {
        console.error('Error fetching shops:', err);
        setShops(DEFAULT_SHOPS.map(name => ({ id: name, name })));
      }
    }
    loadShops();
  }, []);

  // Fetch Stock Records: strictly limited to top 1,000 records
  const fetchStockRecords = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stock_balance_records')
        .select('*');

      if (shopFilter) {
        query = query.eq('shop_id', shopFilter);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }
      if (endDate) {
        query = query.lte('date', endDate);
      }

      if (search.trim()) {
        const term = search.trim();
        query = query.or(`item_name.ilike.%${term}%,brand_name.ilike.%${term}%,subhead.ilike.%${term}%,party_name.ilike.%${term}%,company_name.ilike.%${term}%`);
      }

      query = query
        .order('date', { ascending: false })
        .limit(PAGE_SIZE);

      const { data, error } = await query;

      if (error) {
        console.warn('Table stock_balance_records query notice:', error.message);
      }
      setStockRecords(data || []);
    } catch (err) {
      console.error('Error fetching stock records:', err);
    } finally {
      setLoading(false);
    }
  }, [shopFilter, startDate, endDate, search]);

  useEffect(() => {
    fetchStockRecords();
    setSelectedIds(new Set());
  }, [fetchStockRecords]);

  // Toggle Select Mode
  const toggleSelectMode = () => {
    if (isSelectMode) {
      setIsSelectMode(false);
      setSelectedIds(new Set());
    } else {
      setIsSelectMode(true);
    }
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    if (uploading) return;
    setIsImportModalOpen(false);
    setParsedRows([]);
    setDetectedColumns([]);
    setShopColumnName('');
    setDateColumnName('');
    setSelectedFileName('');
    setSelectedFileSize('');
    setShowPreviewTable(true);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Parse Excel file from local disk
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setSelectedFileSize((file.size / 1024).toFixed(1) + ' KB');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];

        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (!rawData || rawData.length === 0) {
          toast.error('The uploaded Excel file appears to be empty!');
          return;
        }

        // Detect header row by scanning first 15 rows for key column terms
        let headerRowIndex = -1;
        for (let i = 0; i < Math.min(rawData.length, 15); i++) {
          const rowStrings = (rawData[i] || []).map(cell => normalizeKey(cell));
          let matchCount = 0;
          if (rowStrings.some(c => c.includes('item') || c.includes('product') || c.includes('particular'))) matchCount++;
          if (rowStrings.some(c => c.includes('closing') || c.includes('close'))) matchCount++;
          if (rowStrings.some(c => c.includes('opening') || c.includes('open'))) matchCount++;
          if (rowStrings.some(c => c.includes('date'))) matchCount++;
          if (rowStrings.some(c => c.includes('shop') || c.includes('location') || c.includes('godown'))) matchCount++;
          if (rowStrings.some(c => c.includes('qty') || c.includes('rate') || c.includes('brand') || c.includes('mrp'))) matchCount++;

          if (matchCount >= 2) {
            headerRowIndex = i;
            break;
          }
        }

        let rawRows = [];
        let detectedHeaders = [];

        if (headerRowIndex !== -1) {
          const headers = rawData[headerRowIndex].map(h => (h ? String(h).trim() : ''));
          detectedHeaders = headers.filter(Boolean);
          const dataRows = rawData.slice(headerRowIndex + 1);

          rawRows = dataRows.map(r => {
            const rowObj = {};
            headers.forEach((h, idx) => {
              if (h) rowObj[h] = r[idx] !== undefined ? r[idx] : '';
            });
            return rowObj;
          }).filter(r => Object.values(r).some(v => v !== ''));
        } else {
          rawRows = XLSX.utils.sheet_to_json(ws);
          if (rawRows.length > 0) {
            detectedHeaders = Object.keys(rawRows[0]);
          }
        }

        if (rawRows.length === 0) {
          toast.error('No readable stock data rows found in this sheet.');
          return;
        }

        // Check if Shop and Date columns exist in detectedHeaders
        let foundShopHeader = '';
        let foundDateHeader = '';

        for (const h of detectedHeaders) {
          const normH = normalizeKey(h);
          if (!foundShopHeader && COLUMN_KEYS.shop_id.includes(normH)) {
            foundShopHeader = h;
          }
          if (!foundDateHeader && COLUMN_KEYS.date.includes(normH)) {
            foundDateHeader = h;
          }
        }

        setShopColumnName(foundShopHeader);
        setDateColumnName(foundDateHeader);

        // Map and extract based on matching column names
        const mappedList = [];
        const foundColumnsSet = new Set();
        const availableShops = shops.length > 0 ? shops : DEFAULT_SHOPS.map(name => ({ id: name, name }));

        for (const row of rawRows) {
          const normRow = {};
          for (const [k, v] of Object.entries(row)) {
            const nk = normalizeKey(k);
            if (nk) normRow[nk] = v;
          }

          // Check which columns are present
          Object.entries(COLUMN_KEYS).forEach(([fieldKey, aliases]) => {
            if (aliases.some(alias => normRow[alias] !== undefined && normRow[alias] !== '')) {
              foundColumnsSet.add(fieldKey);
            }
          });

          // 1. ITEM NAME: Must not be empty
          const rawItemName = getFieldValue(normRow, COLUMN_KEYS.item_name);
          const itemName = String(rawItemName || '').trim();
          if (!itemName) continue;

          // 2. SHOP: Auto-extracted from Excel column and matched against actual registered shops
          const rawShop = getFieldValue(normRow, COLUMN_KEYS.shop_id);
          const rawShopStr = String(rawShop !== undefined && rawShop !== null ? rawShop : '').trim();
          const matchedShop = matchShopName(rawShopStr, availableShops);

          // 3. DATE: Auto-extracted from Excel column
          const rawDate = getFieldValue(normRow, COLUMN_KEYS.date);
          const rawDateStr = String(rawDate !== undefined && rawDate !== null ? rawDate : '').trim();
          const parsedDate = parseExcelDate(rawDate);

          mappedList.push({
            rawShop: rawShopStr,
            matchedShop: matchedShop, // matched official shop name or null
            isShopMatched: Boolean(matchedShop),

            rawDate: rawDateStr,
            excelDate: parsedDate,
            isDateValid: Boolean(parsedDate),

            item_name: itemName,
            opening_qty: parseNum(getFieldValue(normRow, COLUMN_KEYS.opening_qty)),
            quantity_in: parseNum(getFieldValue(normRow, COLUMN_KEYS.quantity_in)),
            quantity_out: parseNum(getFieldValue(normRow, COLUMN_KEYS.quantity_out)),
            closing_qty: parseNum(getFieldValue(normRow, COLUMN_KEYS.closing_qty)),
            purchase_rate: parseNum(getFieldValue(normRow, COLUMN_KEYS.purchase_rate)),
            mrp_rate: parseNum(getFieldValue(normRow, COLUMN_KEYS.mrp_rate)),
            subhead: String(getFieldValue(normRow, COLUMN_KEYS.subhead) || '').trim(),
            brand_name: String(getFieldValue(normRow, COLUMN_KEYS.brand_name) || '').trim(),
            liquor_type: String(getFieldValue(normRow, COLUMN_KEYS.liquor_type) || '').trim(),
            b_cs: String(getFieldValue(normRow, COLUMN_KEYS.b_cs) || '').trim(),
            mls: String(getFieldValue(normRow, COLUMN_KEYS.mls) || '').trim(),
            type1: String(getFieldValue(normRow, COLUMN_KEYS.type1) || '').trim(),
            type2: String(getFieldValue(normRow, COLUMN_KEYS.type2) || '').trim(),
            type3: String(getFieldValue(normRow, COLUMN_KEYS.type3) || '').trim(),
            type4: String(getFieldValue(normRow, COLUMN_KEYS.type4) || '').trim(),
            type5: String(getFieldValue(normRow, COLUMN_KEYS.type5) || '').trim(),
            type6: String(getFieldValue(normRow, COLUMN_KEYS.type6) || '').trim(),
            company_name: String(getFieldValue(normRow, COLUMN_KEYS.company_name) || '').trim(),
            party_name: String(getFieldValue(normRow, COLUMN_KEYS.party_name) || '').trim(),
            created_at: new Date().toISOString()
          });
        }

        if (mappedList.length === 0) {
          toast.error('Could not extract any valid items with "Item Name". Please check column headers.');
          return;
        }

        setParsedRows(mappedList);
        setDetectedColumns(Array.from(foundColumnsSet));

        toast.success(`Successfully parsed ${mappedList.length} items from ${file.name}`);
      } catch (err) {
        console.error('Error parsing Excel:', err);
        toast.error('Failed to parse Excel file: ' + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  // Comprehensive validation across all parsed rows
  const importValidation = useMemo(() => {
    if (parsedRows.length === 0) {
      return {
        hasRows: false,
        totalRows: 0,
        allShopsMatched: false,
        allDatesValid: false,
        canImport: false,
        matchedShops: [],
        unmatchedShopNames: [],
        unmatchedRowsCount: 0,
        invalidDateRowsCount: 0,
        sampleDate: ''
      };
    }

    const matchedShopsSet = new Set();
    const unmatchedShopSet = new Set();
    let unmatchedRowsCount = 0;
    let invalidDateRowsCount = 0;
    let sampleDate = '';

    parsedRows.forEach(r => {
      if (r.matchedShop) {
        matchedShopsSet.add(r.matchedShop);
      } else {
        unmatchedRowsCount++;
        unmatchedShopSet.add(r.rawShop ? `"${r.rawShop}"` : '(Blank / Missing)');
      }

      if (r.isDateValid) {
        if (!sampleDate) sampleDate = r.excelDate;
      } else {
        invalidDateRowsCount++;
      }
    });

    const allShopsMatched = unmatchedRowsCount === 0 && matchedShopsSet.size > 0;
    const allDatesValid = invalidDateRowsCount === 0;
    const canImport = allShopsMatched && allDatesValid;

    return {
      hasRows: true,
      totalRows: parsedRows.length,
      allShopsMatched,
      allDatesValid,
      canImport,
      matchedShops: Array.from(matchedShopsSet),
      unmatchedShopNames: Array.from(unmatchedShopSet),
      unmatchedRowsCount,
      invalidDateRowsCount,
      sampleDate
    };
  }, [parsedRows]);

  // Submit and upload parsed rows to Supabase in batches
  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      toast.error('No parsed records to upload!');
      return;
    }

    if (!importValidation.canImport) {
      if (!importValidation.allShopsMatched) {
        toast.error(`Import stopped: ${importValidation.unmatchedRowsCount} row(s) have unverified shop names (${importValidation.unmatchedShopNames.join(', ')}). All shops must match registered shops.`);
      } else if (!importValidation.allDatesValid) {
        toast.error(`Import stopped: ${importValidation.invalidDateRowsCount} row(s) have missing or invalid dates.`);
      }
      return;
    }

    const finalRecords = parsedRows.map(r => ({
      shop_id: r.matchedShop,
      date: r.excelDate,
      item_name: r.item_name,
      opening_qty: r.opening_qty,
      quantity_in: r.quantity_in,
      quantity_out: r.quantity_out,
      closing_qty: r.closing_qty,
      purchase_rate: r.purchase_rate,
      mrp_rate: r.mrp_rate,
      subhead: r.subhead,
      brand_name: r.brand_name,
      liquor_type: r.liquor_type,
      b_cs: r.b_cs,
      mls: r.mls,
      type1: r.type1,
      type2: r.type2,
      type3: r.type3,
      type4: r.type4,
      type5: r.type5,
      type6: r.type6,
      company_name: r.company_name,
      party_name: r.party_name,
      created_at: r.created_at
    }));

    setUploading(true);
    const toastId = toast.loading(`Uploading ${finalRecords.length} records in batches...`);

    try {
      const BATCH_SIZE = 250;
      const totalBatches = Math.ceil(finalRecords.length / BATCH_SIZE);

      for (let i = 0; i < finalRecords.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        const chunk = finalRecords.slice(i, i + BATCH_SIZE);
        
        setUploadProgress(Math.round((batchNum / totalBatches) * 100));
        toast.loading(`Uploading batch ${batchNum} of ${totalBatches}... (${Math.round((i / finalRecords.length) * 100)}%)`, { id: toastId });

        const { error } = await supabase.from('stock_balance_records').insert(chunk);
        if (error) {
          console.error('Batch insert error:', error);
          throw new Error(`Batch ${batchNum} failed: ${error.message}`);
        }
      }

      toast.success(`Successfully imported ${finalRecords.length} stock records across ${importValidation.matchedShops.length} shop(s)!`, { id: toastId });
      handleCloseImportModal();
      fetchStockRecords();
    } catch (err) {
      console.error('Error uploading records:', err);
      toast.error('Upload failed: ' + err.message, { id: toastId });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Single Record Delete
  const handleDelete = async (id) => {
    if (!id) return;
    if (!window.confirm('Are you sure you want to delete this stock record?')) return;
    
    const toastId = toast.loading('Deleting record...');
    try {
      if (UUID_REGEX.test(id)) {
        const { error } = await supabase.from('stock_balance_records').delete().eq('id', id);
        if (error) throw error;
      }
      setStockRecords(prev => prev.filter(r => r.id !== id));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success('Record deleted successfully', { id: toastId });
      fetchStockRecords();
    } catch (err) {
      console.error('Delete error:', err);
      toast.error('Failed to delete: ' + err.message, { id: toastId });
    }
  };

  // Selection handlers - Clean 1-to-1 individual row selection
  const handleToggleSelectRow = (id) => {
    if (!id) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllLoaded = (checked) => {
    if (checked) {
      const allIds = stockRecords.filter(r => r.id).map(r => r.id);
      setSelectedIds(new Set(allIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Bulk Delete implementation with batching and UUID validation
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) {
      toast.error('No records selected for deletion!');
      return;
    }

    const confirmMsg = `Are you sure you want to permanently delete ${selectedIds.size} selected stock records? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setIsDeletingBulk(true);
    const toastId = toast.loading(`Deleting ${selectedIds.size} selected records...`);

    try {
      const dbIdsToDelete = Array.from(selectedIds).filter(id => typeof id === 'string' && UUID_REGEX.test(id));

      if (dbIdsToDelete.length === 0) {
        // Local records only
        setStockRecords(prev => prev.filter(r => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
        toast.success('Selected records removed.', { id: toastId });
        return;
      }

      // Chunk deletions in batches of 100 to avoid HTTP URI length limits
      const CHUNK_SIZE = 100;
      const totalChunks = Math.ceil(dbIdsToDelete.length / CHUNK_SIZE);

      for (let i = 0; i < dbIdsToDelete.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE) + 1;
        const chunk = dbIdsToDelete.slice(i, i + CHUNK_SIZE);

        if (totalChunks > 1) {
          toast.loading(`Deleting chunk ${chunkIndex} of ${totalChunks}...`, { id: toastId });
        }

        const { error } = await supabase
          .from('stock_balance_records')
          .delete()
          .in('id', chunk);

        if (error) {
          console.error('Bulk delete batch error:', error);
          throw new Error(error.message || `Failed to delete batch ${chunkIndex}`);
        }
      }

      // Immediate UI cleanup
      const deletedSet = new Set(dbIdsToDelete);
      setStockRecords(prev => prev.filter(r => !deletedSet.has(r.id)));
      setSelectedIds(new Set());

      toast.success(`Successfully deleted ${dbIdsToDelete.length} records!`, { id: toastId });
      fetchStockRecords();
    } catch (err) {
      console.error('Error deleting records:', err);
      toast.error(`Delete failed: ${err.message}`, { id: toastId });
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const isAllSelected = stockRecords.length > 0 && stockRecords.every(r => selectedIds.has(r.id));
  const isPartiallySelected = selectedIds.size > 0 && !isAllSelected;

  return (
    <div className="w-full max-w-full min-w-0 p-3 sm:p-4 md:p-6 space-y-4 overflow-x-hidden flex flex-col flex-1">
      <Toaster position="top-right" />

      {/* Page Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-3 bg-indigo-50 text-indigo-700 rounded-2xl border border-indigo-100/80 shadow-sm shrink-0">
            <FileSpreadsheet size={24} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate">Stock Balance Management</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Record, import, and monitor Purchase, Sale & Stock Balances across shop locations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">

          {/* Executive Dashboard Button */}
          <button
            onClick={() => navigate('/systems/business-overview/sales-analytics')}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            id="view-executive-dashboard-btn"
          >
            <BarChart3 size={15} />
            <span>Executive Dashboard</span>
          </button>

          {/* Main Import Button */}
          <button
            onClick={handleOpenImportModal}
            className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            id="open-import-excel-btn"
          >
            <Upload size={15} />
            <span>Import Excel</span>
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchStockRecords}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 rounded-xl transition-all cursor-pointer"
            id="refresh-stock-btn"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-indigo-600' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Bulk Action Sticky Bar (Shows when records are selected) */}
      {isSelectMode && selectedIds.size > 0 && (
        <div className="bg-indigo-900 text-white px-4 sm:px-5 py-3 rounded-2xl shadow-lg border border-indigo-800 flex flex-wrap items-center justify-between gap-3 min-w-0 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-indigo-700 text-white font-bold text-xs">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                {selectedIds.size} stock record{selectedIds.size > 1 ? 's' : ''} selected
              </p>
              <p className="text-[11px] text-indigo-200">
                You can delete all selected records in a single bulk operation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isAllSelected && (
              <button
                onClick={() => handleSelectAllLoaded(true)}
                className="px-3 py-1.5 text-xs font-medium bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-xl transition cursor-pointer"
              >
                Select All Loaded ({stockRecords.length})
              </button>
            )}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-800 hover:bg-indigo-700 text-indigo-100 rounded-xl transition cursor-pointer"
            >
              Clear Selection
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isDeletingBulk}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow transition cursor-pointer disabled:opacity-50"
              id="bulk-delete-confirm-btn"
            >
              <Trash2 size={14} />
              {isDeletingBulk ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
            </button>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap min-w-0">
          {/* Search Box */}
          <div className="relative flex-1 sm:flex-none sm:w-64 md:w-72 min-w-50">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, brand, subhead, party, company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              id="stock-search-input"
            />
          </div>

          {/* Date Range Filters */}
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none font-medium"
                id="filter-start-date"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2.5 py-1.5 rounded-xl">
              <Calendar size={13} className="text-slate-400 shrink-0" />
              <span className="text-[11px] font-semibold text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 outline-none font-medium"
                id="filter-end-date"
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
              >
                Clear Dates
              </button>
            )}

            {/* Select Button in Filter Toolbar */}
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl transition cursor-pointer ${
                isSelectMode
                  ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
              }`}
              id="filter-toggle-select-btn"
            >
              <CheckSquare size={14} />
              <span>{isSelectMode ? 'Cancel Selection' : 'Select'}</span>
            </button>

            {/* Delete button opens right beside Select button when Select is pressed */}
            {isSelectMode && (
              <button
                onClick={handleBulkDelete}
                disabled={isDeletingBulk || selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl shadow transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                id="filter-bulk-delete-btn"
              >
                <Trash2 size={13} />
                <span>{isDeletingBulk ? 'Deleting...' : `Delete (${selectedIds.size})`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Shop Dropdown & Total Counter */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-between lg:justify-end shrink-0">
          <div className="flex items-center gap-1.5">
            <Store size={14} className="text-slate-400 shrink-0" />
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 outline-none transition cursor-pointer"
              id="filter-shop-select"
            >
              <option value="">All Shops</option>
              {shops.map(s => (
                <option key={s.id || s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200/60 whitespace-nowrap">
            Loaded: <b className="text-indigo-900">{stockRecords.length.toLocaleString()}</b>
          </span>
        </div>
      </div>

      {/* Data Table Container */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col min-w-0 w-full">
        {/* Table Viewport with 2x height and prominent independent vertical and horizontal scrollbars */}
        <div className="overflow-x-auto overflow-y-auto h-[75vh] min-h-150 max-h-[85vh] w-full table-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead className="bg-slate-800 text-slate-200 uppercase font-bold text-[10px] tracking-wider select-none sticky top-0 z-20 shadow-xs">
              <tr>
                {/* Select All Checkbox Column: ONLY opens when Select button is pressed */}
                {isSelectMode && (
                  <th className="px-3.5 py-3 text-center w-10 animate-in fade-in">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={el => {
                        if (el) el.indeterminate = isPartiallySelected;
                      }}
                      onChange={(e) => handleSelectAllLoaded(e.target.checked)}
                      className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                      title={isAllSelected ? 'Deselect all' : 'Select all loaded records'}
                    />
                  </th>
                )}
                <th className="px-2 py-3 text-center w-10">Action</th>
                <th className="px-3 py-3">Shop</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Item Name</th>
                <th className="px-3 py-3 text-right">Opening Qty</th>
                <th className="px-3 py-3 text-right">Qty In</th>
                <th className="px-3 py-3 text-right">Qty Out</th>
                <th className="px-3 py-3 text-right">Closing Qty</th>
                <th className="px-3 py-3 text-right">Purchase Rate</th>
                <th className="px-3 py-3 text-right">MRP Rate</th>
                <th className="px-3 py-3">Subhead</th>
                <th className="px-3 py-3">Brand Name</th>
                <th className="px-3 py-3">Liquor Type</th>
                <th className="px-3 py-3">B/Cs</th>
                <th className="px-3 py-3">Mls</th>
                <th className="px-3 py-3">Type 1..6</th>
                <th className="px-3 py-3">Company Name</th>
                <th className="px-3 py-3">Party Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={isSelectMode ? 20 : 19} className="text-center py-12 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-indigo-600" />
                      <span className="text-xs font-semibold text-slate-600">Loading stock records from database...</span>
                    </div>
                  </td>
                </tr>
              ) : stockRecords.length === 0 ? (
                <tr>
                  <td colSpan={isSelectMode ? 20 : 19} className="text-center py-14 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={32} className="text-slate-300" />
                      <span className="text-sm font-semibold text-slate-600">No stock balance records found</span>
                      <p className="text-xs text-slate-400">Click "Import Excel" above to upload your stock sheet, or adjust your search/filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stockRecords.map((r, idx) => {
                  const recordKey = r.id || `row-${idx}`;
                  const isChecked = Boolean(r.id && selectedIds.has(r.id));

                  return (
                    <tr 
                      key={recordKey} 
                      className={`hover:bg-slate-50/80 transition-colors ${isChecked ? 'bg-indigo-50/70' : ''}`}
                    >
                      {/* Checkbox: ONLY open for each entry when Select button is pressed */}
                      {isSelectMode && (
                        <td className="px-3.5 py-2.5 text-center animate-in fade-in">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleSelectRow(r.id)}
                            className="h-4 w-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>
                      )}

                      {/* Single Action: Delete */}
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Record"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>

                      {/* Data Columns */}
                      <td className="px-3 py-2.5 font-bold text-indigo-900">{r.shop_id || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600 font-mono text-[11px]">{r.date || '—'}</td>
                      <td className="px-3 py-2.5 font-bold text-slate-900">{r.item_name}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">{r.opening_qty}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-emerald-600 font-semibold">+{r.quantity_in}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-600 font-semibold">-{r.quantity_out}</td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-indigo-700 bg-indigo-50/40 rounded">
                        {r.closing_qty}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700">₹{r.purchase_rate}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-slate-700 font-semibold">₹{r.mrp_rate}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.subhead || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-800 font-semibold">{r.brand_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.liquor_type || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.b_cs || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.mls || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {[r.type1, r.type2, r.type3, r.type4, r.type5, r.type6].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{r.company_name || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-600">{r.party_name || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500 font-medium">
          <div>
            Showing <span className="font-bold text-slate-800">{stockRecords.length.toLocaleString()}</span> records
            {stockRecords.length >= PAGE_SIZE && (
              <span className="ml-2 text-indigo-600 font-semibold">(Limited to 1,000 to keep the system lightning fast)</span>
            )}
          </div>
          <div className="text-[11px] text-slate-400">
            Use Search, Shop or Date filters to find and manage specific entries.
          </div>
        </div>
      </div>

      {/* IMPORT EXCEL MODAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
                  <FileSpreadsheet size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Import Stock Balance Excel</h3>
                  <p className="text-xs text-indigo-200">Extracts Shop, Date, and Stock Data directly from your Excel sheet columns</p>
                </div>
              </div>
              <button
                onClick={handleCloseImportModal}
                disabled={uploading}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto space-y-5">

              {/* Extraction & Verification Rules Note */}
              <div className="bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-950">
                <Info size={18} className="text-indigo-600 mt-0.5 shrink-0" />
                <div className="space-y-1.5">
                  <p className="font-bold text-indigo-900 text-sm">Automatic Shop & Date Extraction & Strict Verification:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs text-indigo-800 font-medium">
                    <li>
                      <b>Shop Name:</b> Auto-extracted per row from Excel column (<span className="font-mono text-indigo-900 font-bold">Shop, Location, Branch, Store, Godown</span>). Every row's shop is verified against actual registered shops (<span className="font-mono font-semibold">{(shops.length > 0 ? shops.map(s => s.name) : DEFAULT_SHOPS).join(', ')}</span>). <b>If ANY row does not match a valid shop, import is stopped.</b>
                    </li>
                    <li>
                      <b>Date:</b> Auto-extracted per row from Excel column (<span className="font-mono text-indigo-900 font-bold">Date, Stock Date, Entry Date, Bill Date, As On</span>). All rows must contain valid dates.
                    </li>
                    <li>
                      <b>Stock Fields:</b> Item Name, Opening Qty, Qty In, Qty Out, Closing Qty, Rates, Subhead, Brand, Type, etc. are extracted automatically.
                    </li>
                  </ul>
                </div>
              </div>

              {/* File Upload Dropzone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Choose Excel Sheet (.xlsx, .xls, .csv)
                </label>
                
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="hidden"
                  id="excel-file-hidden-input"
                />

                {!selectedFileName ? (
                  <div
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    className="border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/80 rounded-2xl p-7 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2.5"
                  >
                    <div className="p-3 bg-indigo-100 text-indigo-700 rounded-2xl">
                      <Upload size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-indigo-950">Click to upload or drag & drop Excel file</p>
                      <p className="text-[11px] text-slate-500 font-medium">Accepts Microsoft Excel (.xlsx, .xls) and CSV sheets</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-600 text-white rounded-xl">
                          <FileCheck size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-emerald-950">{selectedFileName}</p>
                          <p className="text-[11px] text-emerald-700 font-medium">
                            {selectedFileSize} • <b className="text-emerald-900">{parsedRows.length.toLocaleString()}</b> total stock items extracted
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedFileName('');
                          setParsedRows([]);
                          setDetectedColumns([]);
                          setShopColumnName('');
                          setDateColumnName('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        disabled={uploading}
                        className="text-xs font-semibold text-emerald-800 hover:text-red-600 hover:underline px-2 py-1 rounded cursor-pointer"
                      >
                        Change file
                      </button>
                    </div>

                    {/* Column Detection Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs">
                      {/* Shop Column Status */}
                      <div className="flex items-start gap-2">
                        {shopColumnName ? (
                          <>
                            <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800">Shop Column Detected:</span>
                              <p className="text-emerald-700 font-semibold text-[11px]">
                                "{shopColumnName}" (extracted per row)
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-rose-800">Shop Column Missing:</span>
                              <p className="text-rose-600 text-[11px]">
                                No Shop column found. Sheet must contain a Shop/Location column.
                              </p>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Date Column Status */}
                      <div className="flex items-start gap-2">
                        {dateColumnName ? (
                          <>
                            <CheckCircle size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-slate-800">Date Column Detected:</span>
                              <p className="text-emerald-700 font-semibold text-[11px]">
                                "{dateColumnName}" (extracted per row)
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} className="text-rose-600 mt-0.5 shrink-0" />
                            <div>
                              <span className="font-bold text-rose-800">Date Column Missing:</span>
                              <p className="text-rose-600 text-[11px]">
                                No Date column found. Sheet must contain a Date column.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Strict Shop Matching & Date Validation Alerts */}
                    {!importValidation.allShopsMatched && (
                      <div className="bg-rose-50 border border-rose-300 rounded-2xl p-4 text-xs text-rose-900 space-y-2">
                        <div className="flex items-center gap-2 font-bold text-rose-700 text-sm">
                          <AlertTriangle size={18} className="shrink-0" />
                          <span>Import Stopped: Unmatched Shop Names Detected ({importValidation.unmatchedRowsCount} row{importValidation.unmatchedRowsCount > 1 ? 's' : ''})</span>
                        </div>
                        <p className="text-[12px] text-rose-800 font-medium">
                          All rows in the Excel file must match actual registered shop names. Import cannot proceed until all shops match.
                        </p>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-rose-200 text-[11px] space-y-1">
                          <p>
                            <span className="font-bold text-rose-900">Unrecognized Shop Names in Excel: </span>
                            <span className="font-mono font-bold text-rose-700">
                              {importValidation.unmatchedShopNames.join(', ') || '(Blank or Empty)'}
                            </span>
                          </p>
                          <p>
                            <span className="font-bold text-slate-700">Actual Registered Shops: </span>
                            <span className="font-semibold text-emerald-800">
                              {(shops.length > 0 ? shops.map(s => s.name) : DEFAULT_SHOPS).join(', ')}
                            </span>
                          </p>
                        </div>
                        <p className="text-[11px] text-rose-600 font-medium">
                          💡 Please rename the shops in your Excel sheet to match one of the registered shops above, then re-upload.
                        </p>
                      </div>
                    )}

                    {importValidation.allShopsMatched && !importValidation.allDatesValid && (
                      <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 text-xs text-amber-900 space-y-1.5">
                        <div className="flex items-center gap-2 font-bold text-amber-800 text-sm">
                          <AlertTriangle size={18} className="shrink-0" />
                          <span>Import Stopped: Missing or Invalid Dates ({importValidation.invalidDateRowsCount} row{importValidation.invalidDateRowsCount > 1 ? 's' : ''})</span>
                        </div>
                        <p className="text-[12px] text-amber-800 font-medium">
                          Some rows have empty or unparseable dates. Every row must have a valid date (YYYY-MM-DD or DD/MM/YYYY).
                        </p>
                      </div>
                    )}

                    {importValidation.canImport && (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-3.5 text-xs text-emerald-950 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
                            <Check size={16} />
                          </div>
                          <div>
                            <span className="font-bold text-emerald-900">All Shops & Dates Matched & Verified!</span>
                            <p className="text-[11px] text-emerald-700">
                              Verified {parsedRows.length.toLocaleString()} rows across {importValidation.matchedShops.length} shop(s): <span className="font-bold">{importValidation.matchedShops.join(', ')}</span>
                            </p>
                          </div>
                        </div>
                        <span className="px-2.5 py-1 bg-emerald-200/70 text-emerald-900 font-bold rounded-lg text-[11px]">
                          Ready to Import
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Detected Columns & Data Preview */}
              {parsedRows.length > 0 && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      All Matched Columns ({detectedColumns.length}):
                    </span>
                    <button
                      onClick={() => setShowPreviewTable(!showPreviewTable)}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                    >
                      {showPreviewTable ? <EyeOff size={13} /> : <Eye size={13} />}
                      {showPreviewTable ? 'Hide Data Preview' : 'Show Data Preview'}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(COLUMN_KEYS).map(colKey => {
                      const isFound = detectedColumns.includes(colKey);
                      const displayName = colKey
                        .replace(/_/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());

                      return (
                        <span
                          key={colKey}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isFound 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-400 border border-slate-200/60'
                          }`}
                        >
                          {isFound ? <Check size={10} className="text-emerald-700" /> : null}
                          {displayName}
                        </span>
                      );
                    })}
                  </div>

                  {/* Expandable Preview Table with Extracted Shop & Date */}
                  {showPreviewTable && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-x-auto text-[11px] shadow-2xs">
                      <table className="w-full text-left">
                        <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                          <tr>
                            <th className="px-2.5 py-1.5">Extracted Shop</th>
                            <th className="px-2.5 py-1.5">Extracted Date</th>
                            <th className="px-2.5 py-1.5">Item Name</th>
                            <th className="px-2.5 py-1.5 text-right">Closing</th>
                            <th className="px-2.5 py-1.5 text-right">Purchase Rate</th>
                            <th className="px-2.5 py-1.5 text-right">MRP</th>
                            <th className="px-2.5 py-1.5">Brand</th>
                            <th className="px-2.5 py-1.5">Subhead</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {parsedRows.slice(0, 5).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50 font-medium">
                              <td className="px-2.5 py-1.5 font-bold">
                                {r.isShopMatched ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-emerald-900">{r.matchedShop}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-100 text-emerald-800">
                                      ✓ Matched
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-rose-700 line-through">{r.rawShop || '(Blank)'}</span>
                                    <span className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-rose-100 text-rose-800">
                                      ✕ Unmatched
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td className="px-2.5 py-1.5 font-mono">
                                {r.isDateValid ? (
                                  <span className="text-slate-700">{r.excelDate}</span>
                                ) : (
                                  <span className="text-rose-600 font-bold">{r.rawDate || 'Missing'} (Invalid)</span>
                                )}
                              </td>
                              <td className="px-2.5 py-1.5 font-bold text-slate-900">{r.item_name}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-bold text-indigo-600">{r.closing_qty}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono">₹{r.purchase_rate}</td>
                              <td className="px-2.5 py-1.5 text-right font-mono font-semibold">₹{r.mrp_rate}</td>
                              <td className="px-2.5 py-1.5 text-slate-700">{r.brand_name || '—'}</td>
                              <td className="px-2.5 py-1.5 text-slate-600">{r.subhead || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Progress Bar when uploading */}
              {uploading && (
                <div className="space-y-1.5 bg-indigo-50/80 p-3.5 rounded-2xl border border-indigo-100">
                  <div className="flex justify-between text-xs font-bold text-indigo-900">
                    <span>Uploading stock records to database...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-indigo-200/80 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Expected Columns Guide */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-[11px] text-slate-600 flex items-start gap-2.5">
                <Database size={15} className="text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">Expected Excel columns: </span>
                  <span className="text-slate-600">
                    Shop / Location, Date, Item Name, Opening Qty, Quantity In, Quantity Out, Closing Qty, Purchase Rate, MRP Rate, Subhead, Brand Name, Liquor Type, B/Cs, Mls, Type1..6, Company Name, Party Name
                  </span>
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="bg-slate-50 border-t border-slate-200 p-4 px-6 flex items-center justify-between gap-3">
              <div className="text-xs">
                {parsedRows.length > 0 && (
                  !importValidation.canImport ? (
                    <span className="text-rose-600 font-bold flex items-center gap-1.5">
                      <AlertTriangle size={15} />
                      Import blocked: {!importValidation.allShopsMatched ? `${importValidation.unmatchedRowsCount} unmatched shop row(s)` : `${importValidation.invalidDateRowsCount} invalid date row(s)`}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                      <CheckCircle size={15} />
                      All {parsedRows.length.toLocaleString()} rows verified
                    </span>
                  )
                )}
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleCloseImportModal}
                  disabled={uploading}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  onClick={handleConfirmImport}
                  disabled={uploading || parsedRows.length === 0 || !importValidation.canImport}
                  className={`flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-sm transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    !importValidation.canImport && parsedRows.length > 0
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                  }`}
                  id="submit-excel-import-btn"
                >
                  <Upload size={14} className={uploading ? 'animate-bounce' : ''} />
                  {uploading 
                    ? 'Importing Records...' 
                    : parsedRows.length === 0 
                      ? 'Choose File to Import'
                      : !importValidation.allShopsMatched
                        ? 'Import Blocked (Unmatched Shops)'
                        : !importValidation.allDatesValid
                          ? 'Import Blocked (Invalid Dates)'
                          : `Import ${parsedRows.length.toLocaleString()} Verified Records`
                  }
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
