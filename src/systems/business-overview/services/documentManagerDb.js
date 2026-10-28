import { supabase } from '../../../lib/supabase';

// ============================================================================
// Helper: UUID Check
// ============================================================================
export const isUUID = (str) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

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
 * Fetch all categories directly from database
 */
export async function fetchCategories() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_categories')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      writeLS(LS_CATS_KEY, data);
      return { data, fromCloud: true };
    }
  } catch (err) {
    console.warn('fetchCategories error:', err);
  }

  const local = readLS(LS_CATS_KEY, []);
  return { data: local, fromCloud: false };
}

/**
 * Save / Update category in Supabase
 */
export async function saveCategory(category) {
  const isNew = !category.id || !isUUID(category.id);
  const payload = {
    name: category.name.trim(),
    prefix: (category.prefix || '').trim().toUpperCase(),
    updated_at: new Date().toISOString()
  };

  try {
    if (isNew) {
      const { data, error } = await supabase
        .from('bis_doc_manager_categories')
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        const cats = readLS(LS_CATS_KEY, []);
        writeLS(LS_CATS_KEY, [...cats, data]);
        return data;
      }
      if (error) console.error('[saveCategory] Supabase insert error:', error.message);
    } else {
      const { data, error } = await supabase
        .from('bis_doc_manager_categories')
        .update(payload)
        .eq('id', category.id)
        .select()
        .single();
      if (!error && data) {
        const cats = readLS(LS_CATS_KEY, []).map(c => c.id === category.id ? data : c);
        writeLS(LS_CATS_KEY, cats);
        return data;
      }
      if (error) console.error('[saveCategory] Supabase update error:', error.message);
    }
  } catch (err) {
    console.warn('[saveCategory] Exception:', err);
  }

  // Fallback local update
  const cats = readLS(LS_CATS_KEY, []);
  let savedCat;
  if (!category.id || !isUUID(category.id)) {
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
  if (isUUID(id)) {
    try {
      await supabase.from('bis_doc_manager_categories').delete().eq('id', id);
    } catch (err) {
      console.warn('[deleteCategory] Supabase delete error:', err);
    }
  }
  const cats = readLS(LS_CATS_KEY, []).filter(c => c.id !== id);
  writeLS(LS_CATS_KEY, cats);
  return true;
}

/**
 * Fetch all document types directly from database
 */
export async function fetchDocumentTypes() {
  try {
    const { data, error } = await supabase
      .from('bis_doc_manager_types')
      .select('*')
      .order('name', { ascending: true });

    if (!error && data) {
      writeLS(LS_TYPES_KEY, data);
      return { data, fromCloud: true };
    }
  } catch (err) {
    console.warn('fetchDocumentTypes error:', err);
  }

  const local = readLS(LS_TYPES_KEY, []);
  return { data: local, fromCloud: false };
}

/**
 * Save document type in Supabase
 */
export async function saveDocumentType(docType) {
  const isNew = !docType.id || !isUUID(docType.id);
  const payload = {
    name: docType.name.trim()
  };

  try {
    if (isNew) {
      const { data, error } = await supabase
        .from('bis_doc_manager_types')
        .insert([payload])
        .select()
        .single();
      if (!error && data) {
        const types = readLS(LS_TYPES_KEY, []);
        writeLS(LS_TYPES_KEY, [...types, data]);
        return data;
      }
      if (error) console.error('[saveDocumentType] Supabase insert error:', error.message);
    } else {
      const { data, error } = await supabase
        .from('bis_doc_manager_types')
        .update(payload)
        .eq('id', docType.id)
        .select()
        .single();
      if (!error && data) {
        const types = readLS(LS_TYPES_KEY, []).map(t => t.id === docType.id ? data : t);
        writeLS(LS_TYPES_KEY, types);
        return data;
      }
      if (error) console.error('[saveDocumentType] Supabase update error:', error.message);
    }
  } catch (err) {
    console.warn('[saveDocumentType] Exception:', err);
  }

  const types = readLS(LS_TYPES_KEY, []);
  let saved;
  if (!docType.id || !isUUID(docType.id)) {
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
  if (isUUID(id)) {
    try {
      await supabase.from('bis_doc_manager_types').delete().eq('id', id);
    } catch (err) {
      console.warn('[deleteDocumentType] Supabase delete error:', err);
    }
  }
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
    if (error) {
      console.warn('[fetchDocuments] Supabase error:', error.message);
    }
  } catch (err) {
    console.warn('[fetchDocuments] Exception:', err);
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
      serial: doc.serial || null,
      type_id: isUUID(doc.typeId) ? doc.typeId : null,
      type_name: doc.typeName || '',
      category_id: isUUID(doc.categoryId) ? doc.categoryId : null,
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
    if (error) {
      console.error('[insertDocuments] Supabase insert error:', error.message);
    }
  } catch (err) {
    console.error('[insertDocuments] Exception:', err);
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
    type_id: isUUID(docData.typeId) ? docData.typeId : null,
    type_name: docData.typeName || '',
    category_id: isUUID(docData.categoryId) ? docData.categoryId : null,
    category_name: docData.categoryName || '',
    person_name: (docData.personName || '').trim(),
    needs_renewal: !!docData.needsRenewal,
    renewal_date: docData.needsRenewal && docData.renewalDate ? docData.renewalDate : null,
    files: finalFiles,
    updated_at: now
  };

  if (isUUID(docId)) {
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
      if (error) console.error('[updateDocument] Supabase update error:', error.message);
    } catch (err) {
      console.error('[updateDocument] Exception:', err);
    }
  }

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

  if (isUUID(docId)) {
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
    } catch (err) {
      console.warn('[renewDocument] Supabase error:', err);
    }
  }

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

  const uuidDocIds = docIds.filter(isUUID);
  if (uuidDocIds.length > 0) {
    try {
      await supabase.from('bis_doc_manager').delete().in('id', uuidDocIds);
    } catch (err) {
      console.warn('[deleteDocuments] Supabase error:', err);
    }
  }

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
  } catch (err) {
    console.warn('[fetchShares] error:', err);
  }

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
    doc_id: isUUID(s.docId) ? s.docId : null,
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
  } catch (err) {
    console.warn('[logShares] error:', err);
  }

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
  if (isUUID(shareId)) {
    try {
      await supabase.from('bis_doc_manager_shares').delete().eq('id', shareId);
    } catch (err) {
      console.warn('[deleteShareRecord] error:', err);
    }
  }
  const remaining = readLS(LS_SHARES_KEY, []).filter(s => s.id !== shareId);
  writeLS(LS_SHARES_KEY, remaining);
  return true;
}
