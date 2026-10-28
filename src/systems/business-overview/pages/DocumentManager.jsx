import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getPagePermission, ViewOnlyBanner } from '../../../utils/permissionUtils';
import * as dbService from '../services/documentManagerDb';
import toast, { Toaster } from 'react-hot-toast';
import {
  LayoutDashboard,
  Files,
  FilePlus,
  CalendarClock,
  Share2,
  Settings,
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit3,
  Eye,
  Download,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  FileText,
  FileImage,
  FileVideo,
  FileSpreadsheet,
  File,
  X,
  ExternalLink,
  Copy,
  Database,
  Calendar,
  Building,
  User,
  ShieldCheck,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';

// ============================================================================
// Helper Utilities
// ============================================================================
const formatBytes = (bytes = 0) => {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

const addDaysToDateStr = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const parts = dateStr.slice(0, 10).split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getRenewalStatus = (doc) => {
  if (!doc.needs_renewal || !doc.renewal_date) return null;
  const today = getTodayDateStr();
  const rDate = doc.renewal_date.slice(0, 10);
  if (rDate < today) return 'overdue';
  if (rDate === today) return 'today';
  return 'upcoming';
};

const getRenewalRemainingText = (renewalDate) => {
  if (!renewalDate) return '';
  const today = new Date(getTodayDateStr() + 'T00:00:00');
  const target = new Date(renewalDate.slice(0, 10) + 'T00:00:00');
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Due today';
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? '' : 's'}`;
  if (diffDays < 60) return `In ${diffDays} day${diffDays === 1 ? '' : 's'}`;
  if (diffDays < 730) return `In ${Math.round(diffDays / 30)} months`;
  return `In ${Math.round(diffDays / 365)} years`;
};

const getFileKind = (file) => {
  const mime = (file.mime || file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (name.endsWith('.csv') || mime === 'text/csv') return 'csv';
  if (/\.(xlsx?|xlsm)$/.test(name) || mime.includes('spreadsheet') || mime.includes('excel')) return 'excel';
  return 'other';
};

const FileKindIcon = ({ file, size = 16, className = '' }) => {
  const kind = getFileKind(file);
  switch (kind) {
    case 'image':
      return <FileImage size={size} className={`text-pink-600 ${className}`} />;
    case 'video':
      return <FileVideo size={size} className={`text-purple-600 ${className}`} />;
    case 'pdf':
      return <FileText size={size} className={`text-rose-600 ${className}`} />;
    case 'excel':
    case 'csv':
      return <FileSpreadsheet size={size} className={`text-emerald-600 ${className}`} />;
    default:
      return <File size={size} className={`text-slate-500 ${className}`} />;
  }
};

const makeBlankEntry = () => ({
  tempId: 'entry_' + Math.random().toString(36).slice(2, 9),
  name: '',
  typeId: '',
  typeName: '',
  categoryId: '',
  categoryName: '',
  personName: '',
  needsRenewal: false,
  renewalDate: addDaysToDateStr(365),
  newFiles: [],
  existingFiles: [],
  removedFileIds: []
});

// ============================================================================
// Main Document Manager Component
// ============================================================================
export default function DocumentManager() {
  const { user } = useAuth();
  const { canView, canModify } = getPagePermission(user, 'business-overview', 'Document Manager');

  // Active Tab state
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'documents' | 'add' | 'renewal' | 'shared' | 'masters'

  // Data States
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCloudSync, setIsCloudSync] = useState(false);

  // Filters State for All Documents
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterRenewal, setFilterRenewal] = useState(''); // '' | 'needs' | 'overdue' | 'today' | 'upcoming'

  // Multi-selection state
  const [selectedDocIds, setSelectedDocIds] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // Modals state
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewActiveFileId, setPreviewActiveFileId] = useState(null);
  const [previewFileBlobUrl, setPreviewFileBlobUrl] = useState(null);

  const [shareModalState, setShareModalState] = useState(null); // { docs: [], channel: 'email'|'whatsapp' }
  const [renewalModalDoc, setRenewalModalDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);

  // Masters Management state
  const [masterTab, setMasterTab] = useState('categories'); // 'categories' | 'types'
  const [masterSearch, setMasterSearch] = useState('');
  const [masterModalState, setMasterModalState] = useState(null); // { type: 'category'|'type', item: null }

  // Form State (Single / Batch Add)
  const [formEntries, setFormEntries] = useState([makeBlankEntry()]);
  const [formErrors, setFormErrors] = useState({});
  const [savingForm, setSavingForm] = useState(false);

  // --------------------------------------------------------------------------
  // Data Loading
  // --------------------------------------------------------------------------
  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [catsRes, typesRes, docsRes, sharesRes] = await Promise.all([
        dbService.fetchCategories(),
        dbService.fetchDocumentTypes(),
        dbService.fetchDocuments(),
        dbService.fetchShares()
      ]);

      setCategories(catsRes.data || []);
      setDocumentTypes(typesRes.data || []);
      setDocuments(docsRes.data || []);
      setShares(sharesRes.data || []);

      if (docsRes.fromCloud && catsRes.fromCloud) {
        setIsCloudSync(true);
      } else {
        setIsCloudSync(false);
      }
    } catch (err) {
      console.error('Error loading Document Manager data:', err);
      toast.error('Could not load documents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Clean object blob URL on modal close
  useEffect(() => {
    if (!previewActiveFileId) {
      if (previewFileBlobUrl) {
        URL.revokeObjectURL(previewFileBlobUrl);
        setPreviewFileBlobUrl(null);
      }
      return;
    }

    let isMounted = true;
    dbService.getLocalFile(previewActiveFileId).then((blob) => {
      if (!isMounted) return;
      if (blob) {
        const url = URL.createObjectURL(blob);
        setPreviewFileBlobUrl(url);
      } else {
        setPreviewFileBlobUrl(null);
      }
    });

    return () => {
      isMounted = false;
      if (previewFileBlobUrl) {
        URL.revokeObjectURL(previewFileBlobUrl);
      }
    };
  }, [previewActiveFileId]);

  // --------------------------------------------------------------------------
  // Derived Statistics
  // --------------------------------------------------------------------------
  const stats = useMemo(() => {
    const totalDocs = documents.length;
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const recentUploads = documents.filter((d) => new Date(d.created_at || now).getTime() >= sevenDaysAgo).length;

    let overdueCount = 0;
    let todayCount = 0;
    let upcomingCount = 0;
    let needsRenewalCount = 0;

    documents.forEach((d) => {
      const status = getRenewalStatus(d);
      if (d.needs_renewal) needsRenewalCount++;
      if (status === 'overdue') overdueCount++;
      else if (status === 'today') todayCount++;
      else if (status === 'upcoming') upcomingCount++;
    });

    const uniqueSharedDocs = new Set(shares.map((s) => s.doc_id).filter(Boolean)).size;

    return {
      totalDocs,
      recentUploads,
      needsRenewalCount,
      overdueCount,
      todayCount,
      upcomingCount,
      uniqueSharedDocs,
      totalShares: shares.length,
      emailShares: shares.filter((s) => s.channel === 'email').length,
      waShares: shares.filter((s) => s.channel === 'whatsapp').length
    };
  }, [documents, shares]);

  // Category distribution
  const categoryStats = useMemo(() => {
    if (documents.length === 0) return [];
    const counts = {};
    documents.forEach((d) => {
      const catId = d.category_id || 'unknown';
      counts[catId] = (counts[catId] || 0) + 1;
    });

    return categories
      .map((c) => ({
        category: c,
        count: counts[c.id] || 0,
        pct: Math.round(((counts[c.id] || 0) / documents.length) * 100)
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [documents, categories]);

  // Filtered documents list
  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return documents.filter((doc) => {
      if (filterCategory && doc.category_id !== filterCategory) return false;
      if (filterType && doc.type_id !== filterType) return false;

      if (filterRenewal) {
        const rStatus = getRenewalStatus(doc);
        if (filterRenewal === 'needs' && !doc.needs_renewal) return false;
        if (filterRenewal === 'overdue' && rStatus !== 'overdue') return false;
        if (filterRenewal === 'today' && rStatus !== 'today') return false;
        if (filterRenewal === 'upcoming' && rStatus !== 'upcoming') return false;
      }

      if (!query) return true;

      const searchableStrings = [
        doc.name,
        doc.serial,
        doc.type_name,
        doc.category_name,
        doc.person_name,
        ...(Array.isArray(doc.files) ? doc.files.map((f) => f.name) : [])
      ]
        .filter(Boolean)
        .map((s) => s.toLowerCase());

      return searchableStrings.some((s) => s.includes(query));
    });
  }, [documents, searchQuery, filterCategory, filterType, filterRenewal]);

  // Paginated documents
  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const paginatedDocs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredDocuments.slice(start, start + pageSize);
  }, [filteredDocuments, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterCategory, filterType, filterRenewal]);

  // --------------------------------------------------------------------------
  // Document Operations Handlers
  // --------------------------------------------------------------------------
  const handleToggleSelectAll = () => {
    if (selectedDocIds.length === paginatedDocs.length && paginatedDocs.length > 0) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(paginatedDocs.map((d) => d.id));
    }
  };

  const handleToggleSelectDoc = (id) => {
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handlePromptDeleteSingle = (doc) => {
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    setConfirmDialog({
      title: 'Delete Document?',
      message: `Are you sure you want to delete "${doc.name}" (${doc.serial || 'No serial'})? Attached files will also be removed.`,
      confirmLabel: 'Delete',
      isDanger: true,
      onConfirm: async () => {
        try {
          await dbService.deleteDocuments([doc.id]);
          setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
          toast.success('Document deleted successfully');
        } catch {
          toast.error('Failed to delete document');
        }
      }
    });
  };

  const handlePromptDeleteBatch = () => {
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    if (selectedDocIds.length === 0) return;
    setConfirmDialog({
      title: `Delete ${selectedDocIds.length} Selected Documents?`,
      message: 'These documents and all their attached files will be permanently deleted.',
      confirmLabel: `Delete ${selectedDocIds.length} Documents`,
      isDanger: true,
      onConfirm: async () => {
        try {
          await dbService.deleteDocuments(selectedDocIds);
          setDocuments((prev) => prev.filter((d) => !selectedDocIds.includes(d.id)));
          setSelectedDocIds([]);
          toast.success('Selected documents deleted');
        } catch {
          toast.error('Failed to delete documents');
        }
      }
    });
  };

  const handleSaveRenewal = async (docId, newDate) => {
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    try {
      const res = await dbService.renewDocument(docId, newDate);
      if (res.data) {
        setDocuments((prev) => prev.map((d) => (d.id === docId ? { ...d, ...res.data } : d)));
        toast.success(`Document renewal date updated to ${formatDateDisplay(newDate)}`);
        setRenewalModalDoc(null);
      }
    } catch {
      toast.error('Could not save renewal date');
    }
  };

  // --------------------------------------------------------------------------
  // Add / Edit Form Actions
  // --------------------------------------------------------------------------
  const handleStartEdit = (doc) => {
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    setEditingDoc(doc);
    setFormEntries([
      {
        tempId: doc.id,
        name: doc.name || '',
        typeId: doc.type_id || '',
        typeName: doc.type_name || '',
        categoryId: doc.category_id || '',
        categoryName: doc.category_name || '',
        personName: doc.person_name || '',
        needsRenewal: !!doc.needs_renewal,
        renewalDate: doc.renewal_date ? doc.renewal_date.slice(0, 10) : addDaysToDateStr(365),
        newFiles: [],
        existingFiles: doc.files || [],
        removedFileIds: []
      }
    ]);
    setActiveTab('add');
  };

  const handleCancelForm = () => {
    setEditingDoc(null);
    setFormEntries([makeBlankEntry()]);
    setFormErrors({});
    setActiveTab('documents');
  };

  const handleAddAnotherEntry = () => {
    setFormEntries((prev) => [...prev, makeBlankEntry()]);
  };

  const handleRemoveEntry = (tempId) => {
    if (formEntries.length === 1) return;
    setFormEntries((prev) => prev.filter((e) => e.tempId !== tempId));
  };

  const handleUpdateEntryField = (tempId, updates) => {
    setFormEntries((prev) =>
      prev.map((e) => {
        if (e.tempId !== tempId) return e;
        const next = { ...e, ...updates };

        if (updates.categoryId) {
          const matchedCat = categories.find((c) => c.id === updates.categoryId);
          next.categoryName = matchedCat ? matchedCat.name : '';
        }
        if (updates.typeId) {
          const matchedType = documentTypes.find((t) => t.id === updates.typeId);
          next.typeName = matchedType ? matchedType.name : '';
        }
        return next;
      })
    );
  };

  const handleEntryAddFiles = (tempId, filesList) => {
    const fileArray = Array.from(filesList || []);
    if (!fileArray.length) return;
    setFormEntries((prev) =>
      prev.map((e) => {
        if (e.tempId !== tempId) return e;
        return {
          ...e,
          newFiles: [...e.newFiles, ...fileArray]
        };
      })
    );
  };

  const handleEntryRemoveNewFile = (tempId, fileIndex) => {
    setFormEntries((prev) =>
      prev.map((e) => {
        if (e.tempId !== tempId) return e;
        return {
          ...e,
          newFiles: e.newFiles.filter((_, idx) => idx !== fileIndex)
        };
      })
    );
  };

  const handleEntryRemoveExistingFile = (tempId, fileId) => {
    setFormEntries((prev) =>
      prev.map((e) => {
        if (e.tempId !== tempId) return e;
        return {
          ...e,
          existingFiles: e.existingFiles.filter((f) => f.id !== fileId),
          removedFileIds: [...e.removedFileIds, fileId]
        };
      })
    );
  };

  const validateForm = () => {
    const errors = {};
    let isValid = true;

    formEntries.forEach((entry, idx) => {
      const eErr = {};
      if (!entry.name.trim()) eErr.name = 'Document Name is required';
      if (!entry.typeId) eErr.typeId = 'Please select Document Type';
      if (!entry.categoryId) eErr.categoryId = 'Please select Category';
      if (!editingDoc && entry.newFiles.length === 0 && entry.existingFiles.length === 0) {
        eErr.files = 'Please attach at least one file';
      }
      if (entry.needsRenewal && !entry.renewalDate) {
        eErr.renewalDate = 'Please select renewal date';
      }

      if (Object.keys(eErr).length > 0) {
        errors[entry.tempId] = eErr;
        isValid = false;
      }
    });

    setFormErrors(errors);
    return isValid;
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    if (!validateForm()) {
      toast.error('Please complete all required fields highlighted in red');
      return;
    }

    setSavingForm(true);
    try {
      if (editingDoc) {
        // Edit mode
        const entry = formEntries[0];
        const res = await dbService.updateDocument(
          editingDoc.id,
          entry,
          entry.newFiles,
          entry.removedFileIds,
          user
        );
        if (res.data) {
          setDocuments((prev) => prev.map((d) => (d.id === editingDoc.id ? res.data : d)));
          toast.success('Document updated successfully');
          handleCancelForm();
        }
      } else {
        // Insert mode (can be multiple)
        // Generate serial numbers for each entry based on existing category count
        const docsToInsert = formEntries.map((entry) => {
          const cat = categories.find((c) => c.id === entry.categoryId);
          const prefix = (cat?.prefix || 'DOC').toUpperCase();

          // Calculate next serial
          const existingMax = documents
            .filter((d) => d.category_id === entry.categoryId)
            .reduce((max, d) => {
              const numPart = parseInt((d.serial || '').split('-')[1] || '0', 10);
              return Math.max(max, isNaN(numPart) ? 0 : numPart);
            }, 0);

          const serial = `${prefix}-${String(existingMax + 1).padStart(3, '0')}`;

          return {
            ...entry,
            serial
          };
        });

        const res = await dbService.insertDocuments(docsToInsert, user);
        if (res.data) {
          setDocuments((prev) => [...res.data, ...prev]);
          toast.success(`${res.data.length} document${res.data.length > 1 ? 's' : ''} added successfully`);
          handleCancelForm();
        }
      }
    } catch (err) {
      console.error('Error saving document:', err);
      toast.error('Failed to save document');
    } finally {
      setSavingForm(false);
    }
  };

  // --------------------------------------------------------------------------
  // Share Handler
  // --------------------------------------------------------------------------
  const handleExecuteShare = async (shareConfig) => {
    const { docs, channel, recipient, message } = shareConfig;
    if (!recipient.trim()) {
      toast.error(`Please enter recipient ${channel === 'email' ? 'email' : 'mobile number'}`);
      return;
    }

    const docTitles = docs.map((d, i) => `${docs.length > 1 ? `${i + 1}. ` : ''}${d.name} (${d.serial || 'No serial'})`).join('\n');
    const fullText = [
      message.trim() ? message.trim() : null,
      message.trim() ? '' : null,
      'Shared Documents from Drinqkart Portal:',
      docTitles
    ]
      .filter((line) => line !== null)
      .join('\n');

    if (channel === 'email') {
      const subject = docs.length === 1 ? `Drinqkart Document: ${docs[0].name}` : `${docs.length} Drinqkart Documents Shared`;
      const mailtoUrl = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullText)}`;
      window.open(mailtoUrl, '_self');
    } else {
      const cleanPhone = recipient.replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
      const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(fullText)}`;
      window.open(waUrl, '_blank', 'noopener');
    }

    // Log in database
    const shareRecords = docs.map((d) => ({
      docId: d.id,
      docName: d.name,
      serial: d.serial,
      categoryName: d.category_name,
      personName: d.person_name,
      channel,
      recipient: recipient.trim(),
      message: message.trim()
    }));

    try {
      const res = await dbService.logShares(shareRecords, user);
      if (res.data) {
        setShares((prev) => [...res.data, ...prev]);
      }
      toast.success('Document shared & logged in history');
      setShareModalState(null);
    } catch {
      toast.error('Shared via app, but failed to record history');
    }
  };

  // --------------------------------------------------------------------------
  // Load Sample Data (When empty)
  // --------------------------------------------------------------------------
  const handleLoadSampleData = async () => {
    if (!canModify) {
      toast.error('View-only access. Modification restricted.');
      return;
    }
    const sampleItems = [
      {
        name: 'Indian Visa 2',
        typeName: 'Passport',
        categoryName: 'Personal Document – ID List',
        personName: 'Roshan Kondle',
        needsRenewal: true,
        renewalDate: addDaysToDateStr(-15),
        serial: 'PN-003'
      },
      {
        name: 'Aadhaar Card',
        typeName: 'Aadhaar Card',
        categoryName: 'Personal Document – ID List',
        personName: 'Raghav Chhadda',
        needsRenewal: false,
        renewalDate: null,
        serial: 'PN-002'
      },
      {
        name: 'MML License Paid Challan',
        typeName: 'TDS Challan & Certificate',
        categoryName: 'Company',
        personName: 'Licence Challan',
        needsRenewal: true,
        renewalDate: getTodayDateStr(),
        serial: 'CN-010'
      },
      {
        name: 'Madhura Wines Shop Act',
        typeName: 'Shop Act',
        categoryName: 'Madhura Wines Bavdhan',
        personName: 'Shop Act',
        needsRenewal: true,
        renewalDate: addDaysToDateStr(45),
        serial: 'MN-004'
      },
      {
        name: 'Vishal Wine & Dine FSSI License',
        typeName: 'Food License',
        categoryName: 'The Liquor Story (Vishal Wines) Hinjewadi',
        personName: 'Vishal Wine and Dine',
        needsRenewal: true,
        renewalDate: addDaysToDateStr(520),
        serial: 'TN-005'
      },
      {
        name: 'Own Property Sale Deed',
        typeName: 'Sale Deed / Conveyance Deed (बिक्री विलेख)',
        categoryName: 'Own Property Document List',
        personName: 'Property Office',
        needsRenewal: false,
        renewalDate: null,
        serial: 'OP-001'
      }
    ];

    const prepared = sampleItems.map((s) => {
      const cat = categories.find((c) => c.name === s.categoryName) || categories[0];
      const typ = documentTypes.find((t) => t.name === s.typeName) || documentTypes[0];
      return {
        ...makeBlankEntry(),
        name: s.name,
        typeId: typ?.id || '',
        typeName: s.typeName,
        categoryId: cat?.id || '',
        categoryName: s.categoryName,
        personName: s.personName,
        needsRenewal: s.needsRenewal,
        renewalDate: s.renewalDate,
        serial: s.serial
      };
    });

    try {
      const res = await dbService.insertDocuments(prepared, user);
      if (res.data) {
        setDocuments((prev) => [...res.data, ...prev]);
        toast.success('Sample documents loaded');
      }
    } catch {
      toast.error('Could not load sample data');
    }
  };

  // --------------------------------------------------------------------------
  // SQL Schema Script for Modal
  // --------------------------------------------------------------------------
  const SQL_SCHEMA = `-- ============================================================================
-- DRINQKART DOCUMENT MANAGER DATABASE SCHEMA FOR SUPABASE
-- Execute this entire script in Supabase Dashboard -> SQL Editor -> Run
-- ============================================================================

-- 1. Document Categories Master Table
CREATE TABLE IF NOT EXISTS public.bis_doc_manager_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Document Types Master Table
CREATE TABLE IF NOT EXISTS public.bis_doc_manager_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Main Document Manager Repository Table (bis_doc_manager)
CREATE TABLE IF NOT EXISTS public.bis_doc_manager (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  serial TEXT,
  type_id UUID REFERENCES public.bis_doc_manager_types(id) ON DELETE SET NULL,
  type_name TEXT,
  category_id UUID REFERENCES public.bis_doc_manager_categories(id) ON DELETE SET NULL,
  category_name TEXT,
  person_name TEXT,
  needs_renewal BOOLEAN DEFAULT FALSE,
  renewal_date DATE,
  files JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Shared Documents Log Table
CREATE TABLE IF NOT EXISTS public.bis_doc_manager_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id UUID REFERENCES public.bis_doc_manager(id) ON DELETE CASCADE,
  doc_name TEXT,
  serial TEXT,
  category_name TEXT,
  person_name TEXT,
  channel TEXT NOT NULL, -- 'email' or 'whatsapp'
  recipient TEXT NOT NULL,
  message TEXT,
  shared_by TEXT,
  shared_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_bis_doc_mgr_category ON public.bis_doc_manager(category_id);
CREATE INDEX IF NOT EXISTS idx_bis_doc_mgr_renewal_date ON public.bis_doc_manager(renewal_date);
CREATE INDEX IF NOT EXISTS idx_bis_doc_mgr_created_at ON public.bis_doc_manager(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bis_doc_mgr_shares_created_at ON public.bis_doc_manager_shares(shared_at DESC);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.bis_doc_manager_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bis_doc_manager_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bis_doc_manager ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bis_doc_manager_shares ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies (Allows Authenticated and Anon users full access to view and manage)
CREATE POLICY "Allow all access to bis_doc_manager_categories" ON public.bis_doc_manager_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bis_doc_manager_types" ON public.bis_doc_manager_types FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bis_doc_manager" ON public.bis_doc_manager FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to bis_doc_manager_shares" ON public.bis_doc_manager_shares FOR ALL USING (true) WITH CHECK (true);

-- 8. Seed Default Categories
INSERT INTO public.bis_doc_manager_categories (name, prefix) VALUES
('Personal Document – ID List', 'PN'),
('Company', 'CN'),
('Director', 'DN'),
('Employee', 'EN'),
('Madhura Wines Bavdhan', 'MN'),
('Friends Wines Wagholi', 'FN'),
('MML Spirits Pvt Ltd (Office)', 'ML'),
('Balaji Wines Akole', 'BW'),
('The Liquor Story (Vishal Wines) Hinjewadi', 'TN'),
('Kunal Fine Wine (Amber Dist)', 'KA'),
('Kunal Fine Wine (South Seas Dist)', 'KS'),
('Own Property Document List', 'OP'),
('Shop Rent Document List', 'SR'),
('Excise License Document List', 'EL')
ON CONFLICT (name) DO NOTHING;

-- 9. Seed Default Document Types
INSERT INTO public.bis_doc_manager_types (name) VALUES
('Invoice'), ('Contract'), ('Report'), ('Presentation'), ('Proposal'),
('Minutes'), ('Plan'), ('Tax Document'), ('Resume'), ('Other'),
('PAN Card'), ('Aadhaar Card'), ('Food License'), ('Liquors License'),
('Shop Act'), ('Expenses Bill'), ('ITR & Balance Sheet'), ('Property Document'),
('TDS Challan & Certificate'), ('VAT'), ('VAT Certificate'), ('Fire Extinguisher'),
('Shop Insurance'), ('Vehicle Document'), ('Sale Deed / Conveyance Deed (बिक्री विलेख)'),
('Possession Letter (कब्ज़ा पत्र)'), ('Police Verification Receipt / Acknowledgement'),
('Electricity Bill'), ('Water Bill'), ('Maintenance Bill / Receipt'),
('Rent Escalation Clause Copy'), ('Monthly Rent Receipts'), ('Lock-in Period Details'),
('Signature Specimen'), ('Affidavit / Self Declaration'), ('Email ID & Mobile Number Proof'),
('Birth Certificate'), ('School Leaving Certificate'), ('Passport'),
('Passport Size Photo (White Background)'), ('Stamp Size Photo (If Required)'),
('Cancelled Cheque'), ('Bank Passbook Copy'), ('Bank Statement (Latest)'),
('Income Tax Return (ITR)'), ('Form 16 (If Applicable)'), ('GST Registration')
ON CONFLICT (name) DO NOTHING;
`;

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 bg-[#FAFAFA] min-h-screen text-[#1A1A1A] font-sans flex flex-col gap-5">
      {/* View-only banner when modify is denied */}
      {!canModify && canView && <ViewOnlyBanner />}

      {/* 1. Header Card with Module Actions */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1c120c]">
              Document Manager
            </h1>
            <span className="bg-[#C9A84C]/15 text-[#8C6D23] font-semibold text-xs px-2.5 py-0.5 rounded-full border border-[#C9A84C]/30 flex items-center gap-1">
              <ShieldCheck size={13} />
              Centralized Vault
            </span>
            {isCloudSync ? (
              <span className="bg-emerald-50 text-emerald-700 font-medium text-xs px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 size={12} />
                Cloud Database Connected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(true)}
                className="bg-amber-50 text-amber-800 hover:bg-amber-100 font-medium text-xs px-2.5 py-0.5 rounded-full border border-amber-300 flex items-center gap-1 cursor-pointer transition"
                title="Click to view database SQL setup instructions"
              >
                <Database size={12} />
                Local Storage Mode · View Supabase Schema
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Secure digital repository for personal, corporate, license, property, and compliance documents with automated renewal tracking.
          </p>
        </div>

        {/* Top Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            title="Refresh documents from database"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setIsSqlModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            title="View PostgreSQL / Supabase Table Schema"
          >
            <Database size={13} className="text-[#C9A84C]" />
            <span>SQL Schema</span>
          </button>

          {canModify && documents.length === 0 && (
            <button
              type="button"
              onClick={handleLoadSampleData}
              className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              <Sparkles size={13} />
              <span>Load Sample</span>
            </button>
          )}

          {canModify && (
            <button
              type="button"
              onClick={() => {
                setEditingDoc(null);
                setFormEntries([makeBlankEntry()]);
                setActiveTab('add');
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] hover:bg-[#b8953d] text-[#1c120c] text-xs font-bold rounded-lg shadow-xs transition cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Document</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. System Tab Navigation Bar */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-slate-200/80 shadow-xs overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'dashboard'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard size={14} />
          <span>Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'documents'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Files size={14} />
          <span>All Documents</span>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
            {documents.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!editingDoc) setFormEntries([makeBlankEntry()]);
            setActiveTab('add');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'add'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FilePlus size={14} />
          <span>{editingDoc ? 'Edit Document' : 'Add Document'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterRenewal('needs');
            setActiveTab('renewal');
          }}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'renewal'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CalendarClock size={14} />
          <span>Renewal Tracker</span>
          {stats.overdueCount > 0 && (
            <span className="bg-rose-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {stats.overdueCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'shared'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Share2 size={14} />
          <span>Shared History</span>
          <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-slate-200">
            {shares.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('masters')}
          className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition shrink-0 cursor-pointer ${
            activeTab === 'masters'
              ? 'bg-[#2C1D11] text-[#C9A84C] font-bold shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Settings size={14} />
          <span>Masters & Setup</span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      {/* ==================================================================== */}
      {/* TAB A: DASHBOARD */}
      {/* ==================================================================== */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5">
          {/* 4 Metric KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Total Documents */}
            <div
              onClick={() => {
                setFilterRenewal('');
                setActiveTab('documents');
              }}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-[#C9A84C]/50 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">Total Documents</p>
                <h3 className="text-2xl font-bold text-[#1c120c] mt-1">{stats.totalDocs}</h3>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  View complete vault <ChevronRight size={12} />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Files size={22} />
              </div>
            </div>

            {/* 2. Recent Uploads */}
            <div
              onClick={() => {
                setFilterRenewal('');
                setActiveTab('documents');
              }}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-[#C9A84C]/50 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">Recent Uploads</p>
                <h3 className="text-2xl font-bold text-[#1c120c] mt-1">{stats.recentUploads}</h3>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  In last 7 days <ChevronRight size={12} />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                <UploadCloud size={22} />
              </div>
            </div>

            {/* 3. Shared Documents */}
            <div
              onClick={() => setActiveTab('shared')}
              className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-xs hover:border-[#C9A84C]/50 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-slate-500">Shared Documents</p>
                <h3 className="text-2xl font-bold text-[#1c120c] mt-1">{stats.uniqueSharedDocs}</h3>
                <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                  {stats.totalShares} total transmissions <ChevronRight size={12} />
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Share2 size={22} />
              </div>
            </div>

            {/* 4. Need Renewal */}
            <div
              onClick={() => {
                setFilterRenewal('needs');
                setActiveTab('renewal');
              }}
              className="bg-white p-4 rounded-xl border border-rose-200/80 shadow-xs hover:border-rose-300 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-medium text-rose-700">Need Renewal</p>
                <h3 className="text-2xl font-bold text-rose-700 mt-1">{stats.needsRenewalCount}</h3>
                <div className="flex items-center gap-2 mt-1 text-[11px]">
                  <span className="text-rose-600 font-semibold">{stats.overdueCount} Overdue</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-amber-600 font-semibold">{stats.todayCount} Today</span>
                </div>
              </div>
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <CalendarClock size={22} />
              </div>
            </div>
          </div>

          {/* Quick Alert Bar for Renewal Items */}
          {stats.needsRenewalCount > 0 && (
            <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle size={18} className="text-amber-600 shrink-0" />
                <span className="text-xs font-semibold text-amber-900">
                  Renewal Notice: {stats.overdueCount} document(s) expired, {stats.todayCount} due today, and {stats.upcomingCount} coming up soon.
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFilterRenewal('overdue');
                  setActiveTab('renewal');
                }}
                className="text-xs font-bold text-amber-800 hover:text-amber-950 underline flex items-center gap-1 cursor-pointer"
              >
                Review renewals <ArrowRight size={13} />
              </button>
            </div>
          )}

          {/* 2-Column Dashboard Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left Box: Distribution by Category */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#1c120c] flex items-center gap-2">
                    <Building size={16} className="text-[#C9A84C]" />
                    Document Distribution by Category
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">Top categories</span>
                </div>

                {categoryStats.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No categorized documents found</p>
                ) : (
                  <div className="space-y-3.5">
                    {categoryStats.map(({ category, count, pct }) => (
                      <div key={category.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-700 truncate max-w-[240px]">
                            {category.name}
                          </span>
                          <span className="font-semibold text-slate-900">
                            {count} doc{count === 1 ? '' : 's'} ({pct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-[#C9A84C] to-[#8C6D23] rounded-full"
                            style={{ width: `${Math.max(pct, 4)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500">Total Categories: {categories.length}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('masters')}
                  className="text-[#8C6D23] font-semibold hover:underline flex items-center gap-1"
                >
                  Manage Categories <ChevronRight size={13} />
                </button>
              </div>
            </div>

            {/* Right Box: Critical Renewals */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#1c120c] flex items-center gap-2">
                    <CalendarClock size={16} className="text-rose-600" />
                    Critical Renewals Attention
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterRenewal('needs');
                      setActiveTab('renewal');
                    }}
                    className="text-xs text-[#8C6D23] font-semibold hover:underline"
                  >
                    View all
                  </button>
                </div>

                {documents.filter((d) => d.needs_renewal).length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No documents have renewal tracking enabled</p>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {documents
                      .filter((d) => d.needs_renewal && d.renewal_date)
                      .sort((a, b) => (a.renewal_date || '').localeCompare(b.renewal_date || ''))
                      .slice(0, 5)
                      .map((doc) => {
                        const status = getRenewalStatus(doc);
                        return (
                          <div key={doc.id} className="py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-900 truncate">{doc.name}</p>
                              <p className="text-[11px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                  {doc.serial || '—'}
                                </span>
                                <span>{doc.category_name}</span>
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  status === 'overdue'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : status === 'today'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {getRenewalRemainingText(doc.renewal_date)}
                              </span>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatDateDisplay(doc.renewal_date)}
                              </p>
                            </div>

                            {canModify && (
                              <button
                                type="button"
                                onClick={() => setRenewalModalDoc(doc)}
                                className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition shrink-0 cursor-pointer"
                              >
                                Renew
                              </button>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span>Renewals are auto-calculated daily based on system time</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB B: ALL DOCUMENTS */}
      {/* ==================================================================== */}
      {(activeTab === 'documents' || activeTab === 'renewal') && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Filter & Search Bar */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, serial, category, person..."
                  className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#C9A84C] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Category Filter */}
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-[#C9A84C] cursor-pointer"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Document Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-[#C9A84C] cursor-pointer"
              >
                <option value="">All Document Types</option>
                {documentTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>

              {/* Renewal Status Filter */}
              <select
                value={filterRenewal}
                onChange={(e) => setFilterRenewal(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg text-xs px-3 py-2 text-slate-700 focus:outline-none focus:border-[#C9A84C] cursor-pointer"
              >
                <option value="">All Renewal States</option>
                <option value="needs">Needs Renewal (Any)</option>
                <option value="overdue">Overdue Expiries</option>
                <option value="today">Expiring Today</option>
                <option value="upcoming">Upcoming Expiries</option>
              </select>

              {(searchQuery || filterCategory || filterType || filterRenewal) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCategory('');
                    setFilterType('');
                    setFilterRenewal('');
                  }}
                  className="text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <span className="text-xs text-slate-500 font-medium">
              Showing {filteredDocuments.length} document{filteredDocuments.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Batch Actions Bar (when rows are selected) */}
          {selectedDocIds.length > 0 && (
            <div className="px-4 py-2.5 bg-[#C9A84C]/10 border-b border-[#C9A84C]/25 flex items-center justify-between gap-3 text-xs">
              <span className="font-bold text-[#8C6D23]">
                {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''} selected
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));
                    setShareModalState({ docs: selectedDocs, channel: 'email' });
                  }}
                  className="px-3 py-1.5 bg-white border border-[#C9A84C]/40 text-[#8C6D23] hover:bg-[#C9A84C]/10 font-semibold rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Mail size={13} />
                  <span>Share via Email</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const selectedDocs = documents.filter((d) => selectedDocIds.includes(d.id));
                    setShareModalState({ docs: selectedDocs, channel: 'whatsapp' });
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  <MessageSquare size={13} />
                  <span>Share via WhatsApp</span>
                </button>

                {canModify && (
                  <button
                    type="button"
                    onClick={handlePromptDeleteBatch}
                    className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold rounded-md flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete Selected</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSelectedDocIds([])}
                  className="text-xs text-slate-500 hover:text-slate-800 underline px-1"
                >
                  Deselect all
                </button>
              </div>
            </div>
          )}

          {/* Documents Table */}
          {filteredDocuments.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Files size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No documents found</p>
              <p className="text-xs text-slate-400 mt-1">
                {documents.length === 0
                  ? 'Add your first document to get started'
                  : 'Try adjusting your search query or filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={selectedDocIds.length === paginatedDocs.length && paginatedDocs.length > 0}
                        onChange={handleToggleSelectAll}
                        className="rounded border-slate-300 text-[#C9A84C] focus:ring-[#C9A84C] cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-3">Serial No</th>
                    <th className="py-3 px-4">Document Details</th>
                    <th className="py-3 px-3">Type</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Person / Entity</th>
                    <th className="py-3 px-3">Renewal Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedDocs.map((doc) => {
                    const status = getRenewalStatus(doc);
                    const isSelected = selectedDocIds.includes(doc.id);
                    const files = Array.isArray(doc.files) ? doc.files : [];

                    return (
                      <tr
                        key={doc.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          isSelected ? 'bg-[#C9A84C]/5' : ''
                        }`}
                      >
                        <td className="py-3 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectDoc(doc.id)}
                            className="rounded border-slate-300 text-[#C9A84C] focus:ring-[#C9A84C] cursor-pointer"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {doc.serial || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div
                            onClick={() => {
                              setPreviewDoc(doc);
                              setPreviewActiveFileId(files[0]?.id || null);
                            }}
                            className="group cursor-pointer"
                          >
                            <p className="font-semibold text-slate-900 group-hover:text-[#8C6D23] transition flex items-center gap-1.5">
                              {doc.name}
                            </p>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                              <span className="flex items-center gap-1">
                                <FileText size={11} />
                                {files.length} file{files.length === 1 ? '' : 's'}
                              </span>
                              <span>•</span>
                              <span>Added {formatDateDisplay(doc.created_at)}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-700">{doc.type_name || '—'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200/60 max-w-[160px] truncate">
                            {doc.category_name || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-700">{doc.person_name || '—'}</span>
                        </td>
                        <td className="py-3 px-3">
                          {doc.needs_renewal && doc.renewal_date ? (
                            <div>
                              <span
                                className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  status === 'overdue'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : status === 'today'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {status === 'overdue' ? 'Overdue' : status === 'today' ? 'Due Today' : 'Upcoming'}
                              </span>
                              <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                {formatDateDisplay(doc.renewal_date)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewDoc(doc);
                                setPreviewActiveFileId(files[0]?.id || null);
                              }}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                              title="View Document & Attachments"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => setShareModalState({ docs: [doc], channel: 'email' })}
                              className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition"
                              title="Share Document"
                            >
                              <Share2 size={15} />
                            </button>

                            {canModify && doc.needs_renewal && (
                              <button
                                type="button"
                                onClick={() => setRenewalModalDoc(doc)}
                                className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-md transition"
                                title="Update Renewal Date"
                              >
                                <CalendarClock size={15} />
                              </button>
                            )}

                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handleStartEdit(doc)}
                                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                                title="Edit Document"
                              >
                                <Edit3 size={15} />
                              </button>
                            )}

                            {canModify && (
                              <button
                                type="button"
                                onClick={() => handlePromptDeleteSingle(doc)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition"
                                title="Delete Document"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {filteredDocuments.length > pageSize && (
            <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs text-slate-600">
              <span>
                Page {currentPage} of {totalPages} ({filteredDocuments.length} items)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .map((p, idx, arr) => (
                    <React.Fragment key={p}>
                      {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-slate-400">…</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1 rounded-md font-semibold ${
                          p === currentPage
                            ? 'bg-[#2C1D11] text-[#C9A84C]'
                            : 'border border-slate-300 hover:bg-white text-slate-700'
                        }`}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  ))}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB C: ADD / EDIT DOCUMENT FORM */}
      {/* ==================================================================== */}
      {activeTab === 'add' && (
        <form onSubmit={handleSaveForm} className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-[#1c120c] flex items-center gap-2">
                <FilePlus size={18} className="text-[#C9A84C]" />
                {editingDoc ? `Edit Document: ${editingDoc.name}` : 'Add New Document(s)'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Fill in document details, attach digital files, and configure renewal tracker.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              {canModify && (
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-5 py-2 bg-[#C9A84C] hover:bg-[#b8953d] text-[#1c120c] text-xs font-bold rounded-lg shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingForm ? <RefreshCw size={14} className="animate-spin" /> : <Check size={15} />}
                  <span>{editingDoc ? 'Save Changes' : `Submit (${formEntries.length})`}</span>
                </button>
              )}
            </div>
          </div>

          {/* Form Entries List */}
          <div className="space-y-4">
            {formEntries.map((entry, index) => {
              const err = formErrors[entry.tempId] || {};
              return (
                <div
                  key={entry.tempId}
                  className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      {editingDoc ? 'Document Parameters' : `Document #${index + 1}`}
                    </span>
                    {!editingDoc && formEntries.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveEntry(entry.tempId)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-800 flex items-center gap-1"
                      >
                        <Trash2 size={13} />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Document Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Document Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={entry.name}
                        onChange={(e) => handleUpdateEntryField(entry.tempId, { name: e.target.value })}
                        placeholder="e.g. FSSAI Food License 2025"
                        className={`w-full px-3 py-2 bg-white border ${
                          err.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                        } rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]`}
                      />
                      {err.name && <p className="text-[11px] text-rose-600 mt-1">{err.name}</p>}
                    </div>

                    {/* Document Type */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Document Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.typeId}
                        onChange={(e) => handleUpdateEntryField(entry.tempId, { typeId: e.target.value })}
                        className={`w-full px-3 py-2 bg-white border ${
                          err.typeId ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                        } rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C] cursor-pointer`}
                      >
                        <option value="">Select Document Type</option>
                        {documentTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                      {err.typeId && <p className="text-[11px] text-rose-600 mt-1">{err.typeId}</p>}
                    </div>

                    {/* Category */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Category <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={entry.categoryId}
                        onChange={(e) => handleUpdateEntryField(entry.tempId, { categoryId: e.target.value })}
                        className={`w-full px-3 py-2 bg-white border ${
                          err.categoryId ? 'border-rose-400 bg-rose-50/20' : 'border-slate-300'
                        } rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C] cursor-pointer`}
                      >
                        <option value="">Select Category</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.prefix})
                          </option>
                        ))}
                      </select>
                      {err.categoryId && <p className="text-[11px] text-rose-600 mt-1">{err.categoryId}</p>}
                    </div>
                  </div>

                  {/* Person / Entity Name */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Person / Entity Name
                      </label>
                      <input
                        type="text"
                        value={entry.personName}
                        onChange={(e) => handleUpdateEntryField(entry.tempId, { personName: e.target.value })}
                        placeholder="e.g. Ramesh Patil / Balaji Wines"
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
                      />
                    </div>

                    {/* Renewal Toggle & Expiry Date */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={entry.needsRenewal}
                            onChange={(e) =>
                              handleUpdateEntryField(entry.tempId, { needsRenewal: e.target.checked })
                            }
                            className="rounded border-slate-300 text-[#C9A84C] focus:ring-[#C9A84C]"
                          />
                          <span>Document requires renewal tracking</span>
                        </label>
                      </div>

                      {entry.needsRenewal && (
                        <div className="space-y-2 pt-1">
                          <input
                            type="date"
                            value={entry.renewalDate}
                            onChange={(e) => handleUpdateEntryField(entry.tempId, { renewalDate: e.target.value })}
                            className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
                          />
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400">Quick set:</span>
                            {[
                              { label: '+3 mo', days: 90 },
                              { label: '+1 yr', days: 365 },
                              { label: '+3 yr', days: 1095 },
                              { label: '+5 yr', days: 1825 }
                            ].map((q) => (
                              <button
                                key={q.label}
                                type="button"
                                onClick={() =>
                                  handleUpdateEntryField(entry.tempId, { renewalDate: addDaysToDateStr(q.days) })
                                }
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Upload Dropzone */}
                  <div className="pt-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Attached Files {!editingDoc && <span className="text-rose-500">*</span>}
                    </label>

                    <div className="border-2 border-dashed border-slate-200 hover:border-[#C9A84C] rounded-xl p-5 text-center bg-slate-50/50 hover:bg-slate-50 transition cursor-pointer relative">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => handleEntryAddFiles(entry.tempId, e.target.files)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <UploadCloud size={28} className="mx-auto text-slate-400 mb-1.5" />
                      <p className="text-xs font-semibold text-slate-700">
                        Click to upload or drag & drop files here
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        PDF, Images (PNG, JPG), Excel, CSV, Word, Video files supported
                      </p>
                    </div>
                    {err.files && <p className="text-[11px] text-rose-600 mt-1">{err.files}</p>}

                    {/* Files Preview list */}
                    {(entry.existingFiles.length > 0 || entry.newFiles.length > 0) && (
                      <div className="mt-3 space-y-1.5">
                        {entry.existingFiles.map((f) => (
                          <div
                            key={f.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-slate-100/70 border border-slate-200 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileKindIcon file={f} />
                              <span className="font-medium text-slate-800 truncate">{f.name}</span>
                              <span className="text-[10px] text-slate-400">({formatBytes(f.size)})</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEntryRemoveExistingFile(entry.tempId, f.id)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove File"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}

                        {entry.newFiles.map((f, fIdx) => (
                          <div
                            key={fIdx}
                            className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200 text-xs"
                          >
                            <div className="flex items-center gap-2 truncate">
                              <FileKindIcon file={f} />
                              <span className="font-medium text-amber-900 truncate">{f.name}</span>
                              <span className="text-[10px] text-amber-700">({formatBytes(f.size)})</span>
                              <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.2 rounded">
                                New
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleEntryRemoveNewFile(entry.tempId, fIdx)}
                              className="text-rose-500 hover:text-rose-700 p-1"
                              title="Remove File"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!editingDoc && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={handleAddAnotherEntry}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5 transition cursor-pointer"
              >
                <Plus size={14} />
                <span>Add Another Document in this Batch</span>
              </button>
            </div>
          )}
        </form>
      )}

      {/* ==================================================================== */}
      {/* TAB D: SHARED HISTORY */}
      {/* ==================================================================== */}
      {activeTab === 'shared' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Top Summary Bar */}
          <div className="p-4 border-b border-slate-200/80 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-slate-500">Total Transmissions:</span>{' '}
                <span className="font-bold text-slate-800">{shares.length}</span>
              </div>
              <div>
                <span className="text-slate-500">By Email:</span>{' '}
                <span className="font-bold text-indigo-700">{stats.emailShares}</span>
              </div>
              <div>
                <span className="text-slate-500">By WhatsApp:</span>{' '}
                <span className="font-bold text-emerald-700">{stats.waShares}</span>
              </div>
            </div>

            <span className="text-slate-400 text-[11px]">
              Every email and WhatsApp dispatch is logged with timestamps
            </span>
          </div>

          {shares.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Share2 size={36} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">No share records yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Use the Share button on any document to send it via Email or WhatsApp
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto min-w-full">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Document</th>
                    <th className="py-3 px-3">Serial</th>
                    <th className="py-3 px-3">Channel</th>
                    <th className="py-3 px-4">Recipient</th>
                    <th className="py-3 px-3">Shared By</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {shares.map((record) => {
                    const matchedDoc = documents.find((d) => d.id === record.doc_id);
                    return (
                      <tr key={record.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{record.doc_name || 'Document'}</p>
                          {record.category_name && (
                            <p className="text-[11px] text-slate-400 mt-0.5">{record.category_name}</p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {record.serial || '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {record.channel === 'whatsapp' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <MessageSquare size={11} /> WhatsApp
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              <Mail size={11} /> Email
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-xs text-slate-800">{record.recipient}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-600">{record.shared_by || 'User'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-slate-600">{formatDateDisplay(record.shared_at)}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {matchedDoc && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShareModalState({
                                    docs: [matchedDoc],
                                    channel: record.channel,
                                    initialRecipient: record.recipient
                                  })
                                }
                                className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition cursor-pointer"
                              >
                                Share Again
                              </button>
                            )}
                            {canModify && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await dbService.deleteShareRecord(record.id);
                                  setShares((prev) => prev.filter((s) => s.id !== record.id));
                                  toast.success('Log record removed');
                                }}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                                title="Remove log"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB E: MASTERS & SETUP */}
      {/* ==================================================================== */}
      {activeTab === 'masters' && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
          {/* Masters Subtabs Bar */}
          <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMasterTab('categories')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterTab === 'categories'
                    ? 'bg-[#2C1D11] text-[#C9A84C]'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Categories ({categories.length})
              </button>
              <button
                type="button"
                onClick={() => setMasterTab('types')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  masterTab === 'types'
                    ? 'bg-[#2C1D11] text-[#C9A84C]'
                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Document Types ({documentTypes.length})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={masterSearch}
                  onChange={(e) => setMasterSearch(e.target.value)}
                  placeholder={`Search ${masterTab}...`}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
                />
              </div>

              {canModify && (
                <button
                  type="button"
                  onClick={() =>
                    setMasterModalState({
                      type: masterTab === 'categories' ? 'category' : 'type',
                      item: null
                    })
                  }
                  className="px-3 py-1.5 bg-[#C9A84C] hover:bg-[#b8953d] text-[#1c120c] font-bold text-xs rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Add {masterTab === 'categories' ? 'Category' : 'Document Type'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Master Table */}
          <div className="overflow-x-auto min-w-full">
            <table className="w-full text-left text-xs text-slate-700 border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4 w-12 text-slate-400">#</th>
                  <th className="py-3 px-4">Name</th>
                  {masterTab === 'categories' && <th className="py-3 px-4">Serial Prefix</th>}
                  <th className="py-3 px-4">Documents Using This</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(masterTab === 'categories' ? categories : documentTypes)
                  .filter((item) =>
                    masterSearch ? item.name.toLowerCase().includes(masterSearch.toLowerCase()) : true
                  )
                  .map((item, idx) => {
                    const usageCount =
                      masterTab === 'categories'
                        ? documents.filter((d) => d.category_id === item.id).length
                        : documents.filter((d) => d.type_id === item.id).length;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{item.name}</td>
                        {masterTab === 'categories' && (
                          <td className="py-3 px-4 font-mono font-bold text-[#8C6D23]">
                            {item.prefix || '—'}
                          </td>
                        )}
                        <td className="py-3 px-4">
                          <span className="text-slate-600">
                            {usageCount} document{usageCount === 1 ? '' : 's'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {canModify && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMasterModalState({
                                    type: masterTab === 'categories' ? 'category' : 'type',
                                    item
                                  })
                                }
                                className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition"
                                title="Edit"
                              >
                                <Edit3 size={14} />
                              </button>
                            )}

                            {canModify && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (usageCount > 0) {
                                    toast.error(
                                      `Cannot delete: ${usageCount} document(s) are using this master item.`
                                    );
                                    return;
                                  }
                                  setConfirmDialog({
                                    title: `Delete ${item.name}?`,
                                    message: 'This master item will be removed from future selection options.',
                                    confirmLabel: 'Delete',
                                    isDanger: true,
                                    onConfirm: async () => {
                                      if (masterTab === 'categories') {
                                        await dbService.deleteCategory(item.id);
                                        setCategories((prev) => prev.filter((c) => c.id !== item.id));
                                      } else {
                                        await dbService.deleteDocumentType(item.id);
                                        setDocumentTypes((prev) => prev.filter((t) => t.id !== item.id));
                                      }
                                      toast.success('Master item deleted');
                                    }
                                  });
                                }}
                                className="p-1.5 text-rose-500 hover:text-rose-700 rounded transition"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: PREVIEW & ATTACHMENT VIEWER */}
      {/* ==================================================================== */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {previewDoc.name}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="font-mono font-semibold bg-slate-200/60 px-1.5 py-0.2 rounded text-[11px]">
                      {previewDoc.serial || '—'}
                    </span>
                    <span>•</span>
                    <span>{previewDoc.category_name}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const docToShare = previewDoc;
                    setPreviewDoc(null);
                    setShareModalState({ docs: [docToShare], channel: 'email' });
                  }}
                  className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-lg flex items-center gap-1.5"
                >
                  <Share2 size={13} />
                  <span>Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">Document Type</span>
                  <span className="font-semibold text-slate-800">{previewDoc.type_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Category</span>
                  <span className="font-semibold text-slate-800">{previewDoc.category_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Person / Entity</span>
                  <span className="font-semibold text-slate-800">{previewDoc.person_name || '—'}</span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Renewal</span>
                  <span className="font-semibold text-slate-800">
                    {previewDoc.needs_renewal && previewDoc.renewal_date
                      ? `${formatDateDisplay(previewDoc.renewal_date)} (${getRenewalRemainingText(previewDoc.renewal_date)})`
                      : 'Not Required'}
                  </span>
                </div>
              </div>

              {/* Attachments Tabs */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2.5">
                  Attached Files ({Array.isArray(previewDoc.files) ? previewDoc.files.length : 0})
                </h4>

                {(!previewDoc.files || previewDoc.files.length === 0) ? (
                  <p className="text-xs text-slate-400 italic py-4">No file attachments on this record</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {previewDoc.files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => setPreviewActiveFileId(file.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                            previewActiveFileId === file.id
                              ? 'bg-[#2C1D11] text-[#C9A84C]'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          <FileKindIcon file={file} size={14} />
                          <span className="truncate max-w-[140px]">{file.name}</span>
                          <span className="text-[10px] text-slate-400">({formatBytes(file.size)})</span>
                        </button>
                      ))}
                    </div>

                    {/* Preview Box */}
                    {previewActiveFileId && (
                      <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden min-h-[300px] flex items-center justify-center p-4">
                        {previewFileBlobUrl ? (
                          (() => {
                            const activeFile = previewDoc.files.find((f) => f.id === previewActiveFileId);
                            const kind = activeFile ? getFileKind(activeFile) : 'other';

                            if (kind === 'image') {
                              return (
                                <img
                                  src={previewFileBlobUrl}
                                  alt={activeFile?.name}
                                  className="max-h-[500px] object-contain rounded shadow-xs"
                                />
                              );
                            }
                            if (kind === 'video') {
                              return (
                                <video
                                  src={previewFileBlobUrl}
                                  controls
                                  className="max-h-[500px] max-w-full rounded"
                                />
                              );
                            }
                            if (kind === 'pdf') {
                              return (
                                <iframe
                                  src={previewFileBlobUrl}
                                  title={activeFile?.name}
                                  className="w-full h-[520px] rounded border border-slate-200 bg-white"
                                />
                              );
                            }

                            return (
                              <div className="text-center py-10 space-y-3">
                                <FileKindIcon file={activeFile} size={48} className="mx-auto" />
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">{activeFile?.name}</p>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Direct inline preview is not available for this format.
                                  </p>
                                </div>
                                <a
                                  href={previewFileBlobUrl}
                                  download={activeFile?.name || 'document'}
                                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#C9A84C] text-[#1c120c] font-bold text-xs rounded-lg hover:bg-[#b8953d] transition"
                                >
                                  <Download size={14} />
                                  <span>Download {activeFile?.name}</span>
                                </a>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-center py-12 text-slate-400 text-xs">
                            Loading file data from storage...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs">
              <span className="text-slate-400">Created: {formatDateDisplay(previewDoc.created_at)}</span>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: SHARE MODAL (EMAIL & WHATSAPP) */}
      {/* ==================================================================== */}
      {shareModalState && (
        <ShareDialog
          shareConfig={shareModalState}
          onClose={() => setShareModalState(null)}
          onShare={handleExecuteShare}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: RENEWAL DATE MODAL */}
      {/* ==================================================================== */}
      {renewalModalDoc && (
        <RenewalDialog
          doc={renewalModalDoc}
          onClose={() => setRenewalModalDoc(null)}
          onSave={handleSaveRenewal}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: CONFIRM DIALOG */}
      {/* ==================================================================== */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  confirmDialog.isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                }`}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-500 mt-1">{confirmDialog.message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const cb = confirmDialog.onConfirm;
                  setConfirmDialog(null);
                  if (cb) cb();
                }}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition text-white ${
                  confirmDialog.isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#C9A84C] text-[#1c120c]'
                }`}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: MASTER ADD / EDIT MODAL */}
      {/* ==================================================================== */}
      {masterModalState && (
        <MasterItemDialog
          config={masterModalState}
          onClose={() => setMasterModalState(null)}
          onSave={async (itemData) => {
            if (masterModalState.type === 'category') {
              const res = await dbService.saveCategory(itemData);
              if (res) {
                setCategories((prev) => {
                  const idx = prev.findIndex((c) => c.id === res.id);
                  return idx >= 0 ? prev.map((c) => (c.id === res.id ? res : c)) : [...prev, res];
                });
                toast.success('Category saved successfully');
              }
            } else {
              const res = await dbService.saveDocumentType(itemData);
              if (res) {
                setDocumentTypes((prev) => {
                  const idx = prev.findIndex((t) => t.id === res.id);
                  return idx >= 0 ? prev.map((t) => (t.id === res.id ? res : t)) : [...prev, res];
                });
                toast.success('Document Type saved successfully');
              }
            }
            setMasterModalState(null);
          }}
        />
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: SUPABASE SQL SCHEMA MODAL */}
      {/* ==================================================================== */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Database size={18} className="text-[#C9A84C]" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Supabase Database Tables Schema</h3>
                  <p className="text-xs text-slate-500">
                    Run this SQL script in Supabase to enable cloud persistence & multi-user syncing
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-900 flex items-start gap-2.5">
                <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">How to activate in 30 seconds:</p>
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5 text-[11px]">
                    <li>Copy the SQL script below.</li>
                    <li>Open your Supabase Dashboard and go to the <b>SQL Editor</b>.</li>
                    <li>Paste the script and click <b>Run</b>.</li>
                    <li>Done! All documents, categories, and shares will sync across all devices in real time.</li>
                  </ol>
                </div>
              </div>

              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] font-mono overflow-x-auto max-h-[380px] leading-relaxed">
                  {SQL_SCHEMA}
                </pre>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(SQL_SCHEMA);
                    toast.success('SQL schema copied to clipboard!');
                  }}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-[#C9A84C] text-[#1c120c] font-bold rounded-lg text-xs hover:bg-[#b8953d] transition flex items-center gap-1.5 cursor-pointer shadow-md"
                >
                  <Copy size={13} />
                  <span>Copy SQL</span>
                </button>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold rounded-lg text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Sub-Component: Share Dialog
// ============================================================================
function ShareDialog({ shareConfig, onClose, onShare }) {
  const [channel, setChannel] = useState(shareConfig.channel || 'email');
  const [recipient, setRecipient] = useState(shareConfig.initialRecipient || '');
  const [message, setMessage] = useState('');

  const docs = shareConfig.docs || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-[#8C6D23]" />
            <h3 className="text-sm font-bold text-slate-900">
              Share {docs.length} Document{docs.length > 1 ? 's' : ''}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        {/* Selected Documents pills */}
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {docs.map((d) => (
            <span
              key={d.id}
              className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200"
            >
              {d.name} {d.serial ? `(${d.serial})` : ''}
            </span>
          ))}
        </div>

        {/* Channel Selection Toggle */}
        <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              channel === 'email' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail size={14} />
            <span>Email</span>
          </button>

          <button
            type="button"
            onClick={() => setChannel('whatsapp')}
            className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
              channel === 'whatsapp' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare size={14} />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Recipient Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {channel === 'email' ? 'Recipient Email Address' : 'Recipient WhatsApp Phone (10 digits)'}{' '}
            <span className="text-rose-500">*</span>
          </label>
          <input
            type={channel === 'email' ? 'email' : 'tel'}
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={channel === 'email' ? 'finance@company.com' : '9876543210'}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        {/* Message Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Personal Note (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Please find attached documents for review..."
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onShare({ docs, channel, recipient, message })}
            className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition flex items-center gap-1.5 ${
              channel === 'email'
                ? 'bg-indigo-600 hover:bg-indigo-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {channel === 'email' ? <Mail size={14} /> : <MessageSquare size={14} />}
            <span>Send via {channel === 'email' ? 'Email' : 'WhatsApp'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Component: Renewal Dialog
// ============================================================================
function RenewalDialog({ doc, onClose, onSave }) {
  const [renewalDate, setRenewalDate] = useState(doc.renewal_date ? doc.renewal_date.slice(0, 10) : addDaysToDateStr(365));

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarClock size={18} className="text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900">Renew Document</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div>
          <p className="text-xs font-bold text-slate-800">{doc.name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Serial: <span className="font-mono font-semibold">{doc.serial || '—'}</span>
          </p>
          <p className="text-[11px] text-slate-500">
            Current Expiry: {formatDateDisplay(doc.renewal_date)} ({getRenewalRemainingText(doc.renewal_date)})
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            New Renewal / Expiry Date <span className="text-rose-500">*</span>
          </label>
          <input
            type="date"
            value={renewalDate}
            onChange={(e) => setRenewalDate(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400">Quick advance:</span>
          {[
            { label: '+3 mo', days: 90 },
            { label: '+1 yr', days: 365 },
            { label: '+3 yr', days: 1095 },
            { label: '+5 yr', days: 1825 }
          ].map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => setRenewalDate(addDaysToDateStr(q.days))}
              className="text-[10px] font-semibold px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            >
              {q.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSave(doc.id, renewalDate)}
            className="px-4 py-2 text-xs font-bold rounded-lg text-[#1c120c] bg-[#C9A84C] hover:bg-[#b8953d] transition"
          >
            Update Date
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Component: Master Item Dialog (Category / Type)
// ============================================================================
function MasterItemDialog({ config, onClose, onSave }) {
  const { type, item } = config;
  const isCategory = type === 'category';

  const [name, setName] = useState(item?.name || '');
  const [prefix, setPrefix] = useState(item?.prefix || '');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (isCategory && !prefix.trim()) {
      toast.error('Serial prefix is required (e.g. PN, CN, MN)');
      return;
    }

    onSave({
      ...(item || {}),
      name: name.trim(),
      ...(isCategory ? { prefix: prefix.trim().toUpperCase() } : {})
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">
            {item ? 'Edit' : 'Add'} {isCategory ? 'Category' : 'Document Type'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <X size={16} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Enter ${isCategory ? 'category' : 'type'} name`}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
          />
        </div>

        {isCategory && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Serial Prefix (e.g. PN, CN, OP) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              maxLength={4}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="PN"
              className="w-full px-3 py-2 font-mono uppercase bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-[#C9A84C]"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Generates serial numbers like: {prefix || 'PN'}-001, {prefix || 'PN'}-002
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-bold rounded-lg text-[#1c120c] bg-[#C9A84C] hover:bg-[#b8953d] transition"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
