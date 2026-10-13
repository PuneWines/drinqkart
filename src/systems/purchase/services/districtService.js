import { supabase } from "../lib/supabase";

export const districtService = {
  /**
   * Fetch all districts from Supabase purchase_districts table
   */
  async getDistricts() {
    // Clear any previously cached data
    try {
      localStorage.removeItem("drinqkart_purchase_districts");
    } catch (_) {}

    const { data, error } = await supabase
      .from("purchase_districts")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.warn("purchase_districts table query:", error.message);
      return [];
    }
    return data || [];
  },

  /**
   * Create a new district in Supabase
   */
  async createDistrict(name) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return { success: false, error: "District name is required" };
    }

    const { data, error } = await supabase
      .from("purchase_districts")
      .insert([{ name: trimmed }])
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  /**
   * Update an existing district in Supabase
   */
  async updateDistrict(id, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return { success: false, error: "District name is required" };
    }

    const { data, error } = await supabase
      .from("purchase_districts")
      .update({ name: trimmed })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, data };
  },

  /**
   * Delete a district from Supabase
   */
  async deleteDistrict(id) {
    const { error } = await supabase
      .from("purchase_districts")
      .delete()
      .eq("id", id);

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  }
};

export default districtService;
