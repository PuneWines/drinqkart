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

    // Merge areas from DB or fallback to localStorage cache if DB column not yet migrated
    return (data || []).map((dist) => {
      let areas = dist.areas;
      if (!Array.isArray(areas)) {
        try {
          const cached = localStorage.getItem(`drinqkart_district_areas_${dist.id}`);
          if (cached) areas = JSON.parse(cached);
        } catch (_) {}
      }
      return {
        ...dist,
        areas: Array.isArray(areas) ? areas : []
      };
    });
  },

  /**
   * Create a new district in Supabase with optional areas
   */
  async createDistrict(name, areas = []) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return { success: false, error: "District name is required" };
    }

    const cleanAreas = Array.isArray(areas) ? areas : [];

    // Attempt insert with areas column
    let { data, error } = await supabase
      .from("purchase_districts")
      .insert([{ name: trimmed, areas: cleanAreas }])
      .select()
      .single();

    // Fallback if areas column not in schema yet
    if (error && (error.message.includes("areas") || error.code === "PGRST204")) {
      const fallbackRes = await supabase
        .from("purchase_districts")
        .insert([{ name: trimmed }])
        .select()
        .single();

      if (fallbackRes.error) {
        return { success: false, error: fallbackRes.error.message };
      }
      data = fallbackRes.data;
      error = null;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (data?.id && cleanAreas.length > 0) {
      try {
        localStorage.setItem(`drinqkart_district_areas_${data.id}`, JSON.stringify(cleanAreas));
      } catch (_) {}
    }

    return { success: true, data: { ...data, areas: cleanAreas } };
  },

  /**
   * Update an existing district in Supabase with optional areas
   */
  async updateDistrict(id, name, areas = []) {
    const trimmed = (name || "").trim();
    if (!trimmed) {
      return { success: false, error: "District name is required" };
    }

    const cleanAreas = Array.isArray(areas) ? areas : [];

    // Attempt update with areas column
    let { data, error } = await supabase
      .from("purchase_districts")
      .update({ name: trimmed, areas: cleanAreas })
      .eq("id", id)
      .select()
      .single();

    // Fallback if areas column not in schema yet
    if (error && (error.message.includes("areas") || error.code === "PGRST204")) {
      const fallbackRes = await supabase
        .from("purchase_districts")
        .update({ name: trimmed })
        .eq("id", id)
        .select()
        .single();

      if (fallbackRes.error) {
        return { success: false, error: fallbackRes.error.message };
      }
      data = fallbackRes.data;
      error = null;
    }

    if (error) {
      return { success: false, error: error.message };
    }

    if (id) {
      try {
        localStorage.setItem(`drinqkart_district_areas_${id}`, JSON.stringify(cleanAreas));
      } catch (_) {}
    }

    return { success: true, data: { ...data, areas: cleanAreas } };
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

    try {
      localStorage.removeItem(`drinqkart_district_areas_${id}`);
    } catch (_) {}

    return { success: true };
  },
};

export default districtService;
