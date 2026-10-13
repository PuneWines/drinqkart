import { create } from "zustand";
import { supabase } from "../lib/supabase";

const useCompanyStore = create((set, get) => ({
  companySettings: null,
  companies: [],
  loading: false,

  fetchCompanies: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('purchase_company_settings')
      .select('*')
      .order('name');
    
    if (!error && data) {
      const normalized = data.map((c) => ({
        ...c,
        district:
          c.district ||
          (c.bank_details && typeof c.bank_details === 'object' ? c.bank_details.district : '') ||
          ''
      }));
      set({ companies: normalized });
      // If we don't have an active company selected yet, default to the first one
      if (normalized.length > 0) {
        set({ companySettings: normalized[0] });
      } else {
        set({ companySettings: null });
      }
    }
    set({ loading: false });
  },

  fetchCompanySettings: async () => {
    // Call fetchCompanies so that both arrays and single settings are updated
    await get().fetchCompanies();
  },

  createCompany: async (companyData) => {
    set({ loading: true });
    // Remove id from insertion if it is present
    const { id, ...insertData } = companyData;
    let { data, error } = await supabase
      .from('purchase_company_settings')
      .insert([insertData])
      .select()
      .single();
    
    // Fallback if 'district' column is not yet in schema cache (PGRST204)
    if (error && error.code === 'PGRST204' && insertData.district !== undefined) {
      const { district, ...fallbackData } = insertData;
      fallbackData.bank_details = {
        ...(typeof fallbackData.bank_details === 'object' && fallbackData.bank_details ? fallbackData.bank_details : {}),
        district: district || ''
      };
      const fallbackRes = await supabase
        .from('purchase_company_settings')
        .insert([fallbackData])
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }
    
    set({ loading: false });
    if (!error && data) {
      await get().fetchCompanies();
      return { success: true, data };
    }
    return { success: false, error: error?.message };
  },

  updateCompany: async (id, companyData) => {
    set({ loading: true });
    // Strip id from companyData
    const { id: _, ...updateData } = companyData;
    let { data, error } = await supabase
      .from('purchase_company_settings')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    // Fallback if 'district' column is not yet in schema cache (PGRST204)
    if (error && error.code === 'PGRST204' && updateData.district !== undefined) {
      const { district, ...fallbackData } = updateData;
      const existing = get().companies.find((c) => c.id === id);
      const existingBank = (existing && typeof existing.bank_details === 'object' && existing.bank_details) ? existing.bank_details : {};
      fallbackData.bank_details = {
        ...existingBank,
        district: district || ''
      };
      const fallbackRes = await supabase
        .from('purchase_company_settings')
        .update(fallbackData)
        .eq('id', id)
        .select()
        .single();
      data = fallbackRes.data;
      error = fallbackRes.error;
    }
    
    set({ loading: false });
    if (!error && data) {
      await get().fetchCompanies();
      return { success: true, data };
    }
    return { success: false, error: error?.message };
  },

  deleteCompany: async (id) => {
    set({ loading: true });
    const { error } = await supabase
      .from('purchase_company_settings')
      .delete()
      .eq('id', id);
    
    set({ loading: false });
    if (!error) {
      await get().fetchCompanies();
      return { success: true };
    }
    return { success: false, error: error?.message };
  },

  updateCompanySettings: async (settingsData) => {
    if (settingsData.id) {
      return get().updateCompany(settingsData.id, settingsData);
    }
    
    // Strict fallback check for single profile setup
    const { data: existingData } = await supabase
      .from('purchase_company_settings')
      .select('id')
      .limit(1)
      .maybeSingle();
    
    if (existingData && existingData.id) {
      return get().updateCompany(existingData.id, settingsData);
    } else {
      return get().createCompany(settingsData);
    }
  }
}));

export default useCompanyStore;
