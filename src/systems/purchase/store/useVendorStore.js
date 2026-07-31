import { create } from "zustand";
import { supabase } from "../lib/supabase";

const ALLOWED_VENDOR_COLUMNS = [
  'party_name',
  'contact_number',
  'email',
  'address',
  'gstin',
  'portal_link'
];

const sanitizeVendorData = (data) => {
  const sanitized = {};
  ALLOWED_VENDOR_COLUMNS.forEach(col => {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  });
  return sanitized;
};

const useVendorStore = create((set, get) => ({
  vendors: [],
  loading: false,

  fetchVendors: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('purchase_vendors').select('*');
    if (!error && data) {
      set({ vendors: data });
    }
    set({ loading: false });
  },

  updateVendor: async (vendorId, updatedData) => {
    const payload = sanitizeVendorData(updatedData);
    const { error } = await supabase
      .from('purchase_vendors')
      .update(payload)
      .eq('id', vendorId);
      
    if (!error) {
      const { vendors } = get();
      set({
        vendors: vendors.map((v) => (v.id === vendorId ? { ...v, ...payload } : v)),
      });
      return { success: true };
    }
    return { success: false, error: error.message };
  },

  createVendor: async (vendorData) => {
    const payload = sanitizeVendorData(vendorData);
    const { data, error } = await supabase
      .from('purchase_vendors')
      .insert([payload])
      .select()
      .single();
      
    if (!error && data) {
      const { vendors } = get();
      set({ vendors: [...vendors, data] });
      return { success: true, data };
    }
    return { success: false, error: error?.message || 'Error creating vendor' };
  },

  deleteVendor: async (vendorId) => {
    const { error } = await supabase.from('purchase_vendors').delete().eq('id', vendorId);
    if (!error) {
      const { vendors } = get();
      set({ vendors: vendors.filter((v) => v.id !== vendorId) });
      return { success: true };
    }
    return { success: false, error: error.message };
  },
}));

export default useVendorStore;
