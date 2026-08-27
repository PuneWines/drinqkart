import { createClient } from "@supabase/supabase-js";

const url = "https://yxtvvjijtraobzaqdevz.supabase.co";
const key = "sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl";

const supabase = createClient(url, key);

async function checkBuckets() {
  console.log("=== LISTING ALL SUPABASE STORAGE BUCKETS ===");
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) console.error("List buckets error:", error);
  else console.log("Buckets:", buckets);
}

checkBuckets();
