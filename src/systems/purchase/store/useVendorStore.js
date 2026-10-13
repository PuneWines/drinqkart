import { create } from "zustand";
import { supabase } from "../lib/supabase";

const ALLOWED_VENDOR_COLUMNS = [
  'party_name',
  'contact',
  'contact_name',
  'email',
  'address',
  'gstin',
  'portal_link',
  'terms',
  'company_name',
  'district_contacts'
];

const sanitizeVendorData = (data) => {
  const sanitized = {};
  ALLOWED_VENDOR_COLUMNS.forEach(col => {
    if (data[col] !== undefined) {
      sanitized[col] = data[col];
    }
  });
  if (data.contact_number !== undefined && sanitized.contact === undefined) {
    sanitized.contact = data.contact_number;
  }
  if (sanitized.company_name === "" || sanitized.company_name === "None") {
    sanitized.company_name = null;
  }
  // Sanitize district_contacts array if present
  if (Array.isArray(sanitized.district_contacts)) {
    sanitized.district_contacts = sanitized.district_contacts.filter(
      (dc) => dc && (dc.district || dc.phone || dc.name || dc.email)
    );
  }
  return sanitized;
};

const mapVendorFields = (vendor) => {
  if (!vendor) return vendor;
  const contactVal = vendor.contact !== undefined ? vendor.contact : (vendor.contact_number || "");
  
  let districtContacts = vendor.district_contacts;
  if (!districtContacts && vendor.id) {
    try {
      const cached = localStorage.getItem(`drinqkart_vendor_district_contacts_${vendor.id}`);
      if (cached) districtContacts = JSON.parse(cached);
    } catch {
      districtContacts = [];
    }
  }
  if (typeof districtContacts === "string") {
    try {
      districtContacts = JSON.parse(districtContacts);
    } catch {
      districtContacts = [];
    }
  }

  return {
    ...vendor,
    contact: contactVal,
    contact_number: contactVal,
    district_contacts: Array.isArray(districtContacts) ? districtContacts : []
  };
};

const useVendorStore = create((set, get) => ({
  vendors: [],
  loading: false,

  fetchVendors: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from('purchase_vendors').select('*');
    if (!error && data) {
      set({ vendors: data.map(mapVendorFields) });
    }
    set({ loading: false });
  },

  updateVendor: async (vendorId, updatedData) => {
    const payload = sanitizeVendorData(updatedData);
    
    // Save to local cache as immediate persistent fallback
    if (payload.district_contacts !== undefined) {
      try {
        localStorage.setItem(
          `drinqkart_vendor_district_contacts_${vendorId}`,
          JSON.stringify(payload.district_contacts)
        );
      } catch (e) {
        console.error("Local storage error:", e);
      }
    }

    let { error } = await supabase
      .from('purchase_vendors')
      .update(payload)
      .eq('id', vendorId);
      
    // Fallback if 'district_contacts' column is not yet in schema cache (PGRST204)
    if (error && error.code === 'PGRST204' && payload.district_contacts !== undefined) {
      const { district_contacts, ...fallbackPayload } = payload;
      const fallbackRes = await supabase
        .from('purchase_vendors')
        .update(fallbackPayload)
        .eq('id', vendorId);
      error = fallbackRes.error;
    }

    if (!error) {
      const { vendors } = get();
      const mappedPayload = mapVendorFields({ ...payload, id: vendorId, contact_number: payload.contact });
      set({
        vendors: vendors.map((v) => (v.id === vendorId ? { ...v, ...mappedPayload } : v)),
      });
      return { success: true };
    }
    return { success: false, error: error.message };
  },

  createVendor: async (vendorData) => {
    const payload = sanitizeVendorData(vendorData);
    let { data, error } = await supabase
      .from('purchase_vendors')
      .insert([payload])
      .select()
      .single();
      
    // Fallback if 'district_contacts' column is not yet in schema cache (PGRST204)
    if (error && error.code === 'PGRST204' && payload.district_contacts !== undefined) {
      const { district_contacts, ...fallbackPayload } = payload;
      const fallbackRes = await supabase
        .from('purchase_vendors')
        .insert([fallbackPayload])
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }

    if (!error && data) {
      if (payload.district_contacts !== undefined) {
        try {
          localStorage.setItem(
            `drinqkart_vendor_district_contacts_${data.id}`,
            JSON.stringify(payload.district_contacts)
          );
        } catch (e) {
          console.error("Local storage error:", e);
        }
      }
      const { vendors } = get();
      const mappedData = mapVendorFields({ ...data, district_contacts: payload.district_contacts || [] });
      set({ vendors: [...vendors, mappedData] });
      return { success: true, data: mappedData };
    }
    return { success: false, error: error?.message || 'Error creating vendor' };
  },

  deleteVendor: async (vendorId) => {
    try {
      localStorage.removeItem(`drinqkart_vendor_district_contacts_${vendorId}`);
    } catch {}
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

