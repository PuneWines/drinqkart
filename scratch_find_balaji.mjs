import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yxtvvjijtraobzaqdevz.supabase.co";
const supabaseKey = "sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl";
const supabase = createClient(supabaseUrl, supabaseKey);

async function findBalajiInfo() {
  // Check shop table
  const { data: shops } = await supabase.from("shop").select("*").ilike("shop_name", "%BALAJI%");
  console.log("Shop table for Balaji:", shops);

  // Check purchase_company_settings
  const { data: companies } = await supabase.from("purchase_company_settings").select("*").ilike("name", "%BALAJI%");
  console.log("Company settings for Balaji:", companies);

  // Check purchase_receivers for Balaji
  const { data: receivers } = await supabase.from("purchase_receivers").select("*").ilike("shop_name", "%BALAJI%");
  console.log("Receivers for Balaji:", receivers);
}

findBalajiInfo();
