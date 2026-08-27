import { createClient } from "@supabase/supabase-js";

const url = "https://yxtvvjijtraobzaqdevz.supabase.co";
const key = "sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl";

const supabase = createClient(url, key);

async function checkShopTable() {
  console.log("=== ALL SHOPS IN SHOP TABLE ===");
  const { data: shops } = await supabase.from("shop").select("*");
  console.table(shops);

  console.log("\n=== UNIQUE SHOP NAMES IN WORK_TASK_NEW ===");
  const { data: wtShops } = await supabase.from("work_task_new").select("shop_name");
  const uniqueWtShops = [...new Set(wtShops?.map(s => s.shop_name))];
  console.log("work_task_new shop_names:", uniqueWtShops);
}

checkShopTable();
