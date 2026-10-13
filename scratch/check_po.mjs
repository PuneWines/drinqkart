import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://yxtvvjijtraobzaqdevz.supabase.co";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key exists:", !!supabaseKey);

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("purchase_purchase_orders")
    .select("*")
    .eq("po_number", "2026/PO-1567");

  if (error) {
    console.error("Error fetching PO:", error);
    return;
  }
  console.log("Found PO:", JSON.stringify(data, null, 2));
}

run();
