import { supabase } from '../../../lib/supabase';

// ============================================================================
// IndexedDB for local binary attachments cache / fallback
// ============================================================================
const IDB_NAME = 'bis_doc_manager_storage';
const IDB_STORE = 'files';

function openDocDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveLocalFile(fileId, fileBlob) {
  try {
    const db = await openDocDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(fileBlob, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save file to IndexedDB:', err);
  }
}

export async function getLocalFile(fileId) {
  try {
    const db = await openDocDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(fileId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not get file from IndexedDB:', err);
    return null;
  }
}

export async function deleteLocalFile(fileId) {
  try {
    const db = await openDocDb();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not delete file from IndexedDB:', err);
  }
}

// ============================================================================
// Master Seed Data (Used when tables are initially empty)
// ============================================================================
export const SEED_DOCUMENT_TYPES = [
  'Invoice', 'Contract', 'Report', 'Presentation', 'Proposal', 'Minutes', 'Plan',
  'Tax Document', 'Resume', 'Other', 'PAN Card', 'Aadhaar Card', 'Food License',
  'Liquors License', 'Shop Act', 'Expenses Bill', 'ITR & Balance Sheet', 'Property Document',
  'TDS Challan & Certificate', 'VAT', 'VAT Certificate', 'Fire Extinguisher', 'Shop Insurance',
  'Vehicle Document', 'Sale Deed / Conveyance Deed (बिक्री विलेख)', 'Possession Letter (कब्ज़ा पत्र)',
  'Police Verification Receipt / Acknowledgement', 'Electricity Bill', 'Water Bill',
  'Maintenance Bill / Receipt', 'Rent Escalation Clause Copy', 'Monthly Rent Receipts',
  'Lock-in Period Details', 'Signature Specimen', 'Affidavit / Self Declaration',
  'Email ID & Mobile Number Proof', 'Birth Certificate', 'School Leaving Certificate',
  'Passport', 'Passport Size Photo (White Background)', 'Stamp Size Photo (If Required)',
  'Cancelled Cheque', 'Bank Passbook Copy', 'Bank Statement (Latest)',
  'Income Tax Return (ITR)', 'Form 16 (If Applicable)', 'GST Registration'
];

export const SEED_CATEGORIES = [
  { name: 'Personal Document – ID List', prefix: 'PN' },
  { name: 'Company', prefix: 'CN' },
  { name: 'Director', prefix: 'DN' },
  { name: 'Employee', prefix: 'EN' },
  { name: 'Madhura Wines Bavdhan', prefix: 'MN' },
  { name: 'Friends Wines Wagholi', prefix: 'FN' },
  { name: 'MML Spirits Pvt Ltd (Office)', prefix: 'ML' },
  { name: 'Balaji Wines Akole', prefix: 'BW' },
  { name: 'The Liquor Story (Vishal Wines) Hinjewadi', prefix: 'TN' },
  { name: 'Kunal Fine Wine (Amber Dist)', prefix: 'KA' },
  { name: 'Kunal Fine Wine (South Seas Dist)', prefix: 'KS' },
  { name: 'Own Property Document List', prefix: 'OP' },
  { name: 'Shop Rent Document List', prefix: 'SR' },
  { name: 'Excise License Document List', prefix: 'EL' }
];

export const SEED_RENEWAL_FILTERS = [
  { name: 'Needs Renewal', rule: 'needs' },
  { name: 'Upcoming', rule: 'upcoming' },
  { name: 'Today', rule: 'today' },
  { name: 'Overdue', rule: 'overdue' }
];

// Local storage backup keys
const LS_DOCS_KEY = 'bis_doc_manager_local_docs';
const LS_CATS_KEY = 'bis_doc_manager_local_cats';
const LS_TYPES_KEY = 'bis_doc_manager_local_types';
const LS_SHARES_KEY = 'bis_doc_manager_local_shares';

function readLS(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLS(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

// ============================================================================
// Service Methods with Supabase + Local Fallback
// ============================================================================

/**
 * Fetch all categories
 */
export async function fetchCategories() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    if (data && data.length > 0) {
      writeLS(LS_CATS_KEY, data);
      return { data, fromCloud: true };
    }
  } catch (err) {
    // console.warn('Supabase fetchCategories fallback:', err.message);
  }

  // Fallback to local storage or seed
  let local = readLS(LS_CATS_KEY, []);
  if (local.length === 0) {
    local = SEED_CATEGORIES.map((c, i) => ({
      id: `cat-${i + 1}`,
      name: c.name,
      prefix: c.prefix
    }));
    writeLS(LS_CATS_KEY, local);
  }
  return { data: local, fromCloud: false };
}

/**
 * Save / Update category
 */
export async function saveCategory(category) {
  const isNew = !category.id || category.id.startsWith('cat-');
  try {
    const payload = {
      name: category.name.trim(),
      prefix: (category.prefix || '').trim().toUpperCase(),
      updated_at: new Date().toISOString()
    };

    if (isNew) {
      const { data, error } = await supabase
        .from('bis_doc_manager_categories')
        .insert([payload])
        .select()
        .single();
      if (!error && data) return data;
    } else {
      const { data, error } = await supabase
        .from('bis_doc_manager_categories')
        .update(payload)
        .eq('id', category.id)
        .select()
        .single();
      if (!error && data) return data;
    }
  } catch (err) {
    // console.warn('Supabase saveCategory fallback:', err.message);
  }

  // Fallback local update
  const cats = readLS(LS_CATS_KEY, []);
  let savedCat;
  if (!category.id) {
    savedCat = { ...category, id: `cat-${Date.now()}` };
    cats.push(savedCat);
  } else {
    savedCat = { ...category };
    const idx = cats.findIndex(c => c.id === category.id);
    if (idx >= 0) cats[idx] = savedCat;
    else cats.push(savedCat);
  }
  writeLS(LS_CATS_KEY, cats);
  return savedCat;
}

/**
 * Delete category
 */
export async function deleteCategory(id) {
  try {
    await supabase.from('bis_doc_manager_categories').delete().eq('id', id);
  } catch (err) {
    // fallback
  }
  const cats = readLS(LS_CATS_KEY, []).filter(c => c.id !== id);
  writeLS(LS_CATS_KEY, cats);
  return true;
}

/**
 * Fetch all document types
 */
export async function fetchDocumentTypes() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_types')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data && data.length > 0) {
      writeLS(LS_TYPES_KEY, data);
      return { data, fromCloud: true };
    }
  } catch (err) {
    // fallback
  }

  let local = readLS(LS_TYPES_KEY, []);
  if (local.length === 0) {
    local = SEED_DOCUMENT_TYPES.map((name, i) => ({
      id: `type-${i + 1}`,
      name
    }));
    writeLS(LS_TYPES_KEY, local);
  }
  return { data: local, fromCloud: false };
}

/**
 * Save document type
 */
export async function saveDocumentType(docType) {
  const isNew = !docType.id || docType.id.startsWith('type-');
  try {
    const payload = {
      name: docType.name.trim()
    };
    if (isNew) {
      const { data, error } = await supabase
        .from('bis_doc_manager_types')
        .insert([payload])
        .select()
        .single();
      if (!error && data) return data;
    } else {
      const { data, error } = await supabase
        .from('bis_doc_manager_types')
        .update(payload)
        .eq('id', docType.id)
        .select()
        .single();
      if (!error && data) return data;
    }
  } catch {}

  const types = readLS(LS_TYPES_KEY, []);
  let saved;
  if (!docType.id) {
    saved = { ...docType, id: `type-${Date.now()}` };
    types.push(saved);
  } else {
    saved = { ...docType };
    const idx = types.findIndex(t => t.id === docType.id);
    if (idx >= 0) types[idx] = saved;
    else types.push(saved);
  }
  writeLS(LS_TYPES_KEY, types);
  return saved;
}

/**
 * Delete document type
 */
export async function deleteDocumentType(id) {
  try {
    await supabase.from('bis_doc_manager_types').delete().eq('id', id);
  } catch {}
  const types = readLS(LS_TYPES_KEY, []).filter(t => t.id !== id);
  writeLS(LS_TYPES_KEY, types);
  return true;
}

/**
 * Fetch all documents from `bis_doc_manager`
 */
export async function fetchDocuments() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      writeLS(LS_DOCS_KEY, data);
      return { data, fromCloud: true };
    }
  } catch (err) {
    // fallback
  }

  const local = readLS(LS_DOCS_KEY, []);
  return { data: local, fromCloud: false };
}

/**
 * Save new documents (single or batch) into `bis_doc_manager`
 */
export async function insertDocuments(docsArray, currentUser) {
  const userName = currentUser?.user_name || currentUser?.username || 'User';
  const now = new Date().toISOString();

  // Process files: Save to IndexedDB and keep metadata
  const preparedDocs = [];
  for (const doc of docsArray) {
    const fileMeta = [];
    if (Array.isArray(doc.newFiles)) {
      for (const f of doc.newFiles) {
        const fileId = 'file_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
        await saveLocalFile(fileId, f);
        fileMeta.push({
          id: fileId,
          name: f.name,
          size: f.size,
          mime: f.type || 'application/octet-stream',
          uploadedAt: now
        });
      }
    }

    preparedDocs.push({
      name: doc.name.trim(),
      serial: doc.serial,
      type_id: doc.typeId || null,
      type_name: doc.typeName || '',
      category_id: doc.categoryId || null,
      category_name: doc.categoryName || '',
      person_name: (doc.personName || '').trim(),
      needs_renewal: !!doc.needsRenewal,
      renewal_date: doc.needsRenewal && doc.renewalDate ? doc.renewalDate : null,
      files: fileMeta,
      status: 'active',
      created_by: userName,
      created_at: now,
      updated_at: now
    });
  }

  try {
    const { data, error } = await supabase
      .from('bis_doc_manager')
      .insert(preparedDocs)
      .select();

    if (!error && data && data.length > 0) {
      const existing = readLS(LS_DOCS_KEY, []);
      writeLS(LS_DOCS_KEY, [...data, ...existing]);
      return { data, fromCloud: true };
    }
  } catch (err) {
    // fallback
  }

  // Local storage save
  const existing = readLS(LS_DOCS_KEY, []);
  const localInserted = preparedDocs.map((d) => ({
    ...d,
    id: 'doc_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
  }));
  const updated = [...localInserted, ...existing];
  writeLS(LS_DOCS_KEY, updated);
  return { data: localInserted, fromCloud: false };
}

/**
 * Update an existing document in `bis_doc_manager`
 */
export async function updateDocument(docId, docData, newFiles = [], removedFileIds = [], currentUser) {
  const userName = currentUser?.user_name || currentUser?.username || 'User';
  const now = new Date().toISOString();

  // Process any new files
  const newFileMeta = [];
  for (const f of newFiles) {
    const fileId = 'file_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
    await saveLocalFile(fileId, f);
    newFileMeta.push({
      id: fileId,
      name: f.name,
      size: f.size,
      mime: f.type || 'application/octet-stream',
      uploadedAt: now
    });
  }

  // Clean removed files from IndexedDB
  for (const rId of removedFileIds) {
    await deleteLocalFile(rId);
  }

  const existingFiles = (docData.existingFiles || []).filter(f => !removedFileIds.includes(f.id));
  const finalFiles = [...existingFiles, ...newFileMeta];

  const payload = {
    name: docData.name.trim(),
    type_id: docData.typeId || null,
    type_name: docData.typeName || '',
    category_id: docData.categoryId || null,
    category_name: docData.categoryName || '',
    person_name: (docData.personName || '').trim(),
    needs_renewal: !!docData.needsRenewal,
    renewal_date: docData.needsRenewal && docData.renewalDate ? docData.renewalDate : null,
    files: finalFiles,
    updated_at: now
  };

  try {
    const { data, error } = await supabase
      .from('bis_doc_manager')
      .update(payload)
      .eq('id', docId)
      .select()
      .single();

    if (!error && data) {
      const allDocs = readLS(LS_DOCS_KEY, []).map(d => d.id === docId ? data : d);
      writeLS(LS_DOCS_KEY, allDocs);
      return { data, fromCloud: true };
    }
  } catch {}

  // Local fallback
  const allDocs = readLS(LS_DOCS_KEY, []);
  let localUpdated = null;
  const updatedList = allDocs.map(d => {
    if (d.id === docId) {
      localUpdated = { ...d, ...payload };
      return localUpdated;
    }
    return d;
  });
  writeLS(LS_DOCS_KEY, updatedList);
  return { data: localUpdated, fromCloud: false };
}

/**
 * Renew document with new date in `bis_doc_manager`
 */
export async function renewDocument(docId, newRenewalDate) {
  const now = new Date().toISOString();
  const payload = {
    needs_renewal: true,
    renewal_date: newRenewalDate,
    updated_at: now
  };

  try {
    const { data, error } = await supabase
      .from('bis_doc_manager')
      .update(payload)
      .eq('id', docId)
      .select()
      .single();

    if (!error && data) {
      const allDocs = readLS(LS_DOCS_KEY, []).map(d => d.id === docId ? data : d);
      writeLS(LS_DOCS_KEY, allDocs);
      return { data, fromCloud: true };
    }
  } catch {}

  const allDocs = readLS(LS_DOCS_KEY, []);
  let updatedDoc = null;
  const list = allDocs.map(d => {
    if (d.id === docId) {
      updatedDoc = { ...d, ...payload };
      return updatedDoc;
    }
    return d;
  });
  writeLS(LS_DOCS_KEY, list);
  return { data: updatedDoc, fromCloud: false };
}

/**
 * Delete documents by IDs from `bis_doc_manager`
 */
export async function deleteDocuments(docIds) {
  // Clean attached files from IndexedDB
  const allDocs = readLS(LS_DOCS_KEY, []);
  for (const id of docIds) {
    const doc = allDocs.find(d => d.id === id);
    if (doc && Array.isArray(doc.files)) {
      for (const f of doc.files) {
        await deleteLocalFile(f.id);
      }
    }
  }

  try {
    await supabase.from('bis_doc_manager').delete().in('id', docIds);
  } catch {}

  const remaining = allDocs.filter(d => !docIds.includes(d.id));
  writeLS(LS_DOCS_KEY, remaining);
  return true;
}

/**
 * Fetch share history
 */
export async function fetchShares() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_shares')
      .select('*')
      .order('shared_at', { ascending: false });

    if (!error && data) {
      writeLS(LS_SHARES_KEY, data);
      return { data, fromCloud: true };
    }
  } catch {}

  const local = readLS(LS_SHARES_KEY, []);
  return { data: local, fromCloud: false };
}

/**
 * Log shared documents
 */
export async function logShares(shareRecords, currentUser) {
  const userName = currentUser?.user_name || currentUser?.username || 'User';
  const now = new Date().toISOString();

  const prepared = shareRecords.map(s => ({
    doc_id: s.docId || null,
    doc_name: s.docName || '',
    serial: s.serial || '',
    category_name: s.categoryName || '',
    person_name: s.personName || '',
    channel: s.channel || 'email',
    recipient: s.recipient || '',
    message: s.message || '',
    shared_by: userName,
    shared_at: now
  }));

  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_shares')
      .insert(prepared)
      .select();

    if (!error && data && data.length > 0) {
      const existing = readLS(LS_SHARES_KEY, []);
      writeLS(LS_SHARES_KEY, [...data, ...existing]);
      return { data, fromCloud: true };
    }
  } catch {}

  const existing = readLS(LS_SHARES_KEY, []);
  const localInserted = prepared.map(p => ({
    ...p,
    id: 'share_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
  }));
  writeLS(LS_SHARES_KEY, [...localInserted, ...existing]);
  return { data: localInserted, fromCloud: false };
}

/**
 * Delete a share history record
 */
export async function deleteShareRecord(shareId) {
  try {
    await supabase.from('bis_doc_manager_shares').delete().eq('id', shareId);
  } catch {}
  const remaining = readLS(LS_SHARES_KEY, []).filter(s => s.id !== shareId);
  writeLS(LS_SHARES_KEY, remaining);
  return true;
}
