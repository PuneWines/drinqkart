import { createClient } from "@supabase/supabase-js";

const url = "https://yxtvvjijtraobzaqdevz.supabase.co";
const key = "sb_publishable_v3VWles1FpjdS4iGAHwhdA_xGYB2TNl";

const supabase = createClient(url, key);

async function checkUsers() {
  console.log("=== ALL USERS IN USERS TABLE MATCHING SUNIL OR ROSHAN ===");
  const { data: users, error } = await supabase
    .from("users")
    .select("*")
    .or("user_name.ilike.%sunil%,user_name.ilike.%roshan%");

  if (error) console.error("Error:", error);
  else console.log(JSON.stringify(users, null, 2));
}

checkUsers();
