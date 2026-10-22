-- ==============================================================================
-- SHOP VISIT CHECKLIST MASTER TABLE & SEED DATA
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- ==============================================================================

-- 1. Create table for dynamic shop visit checklist items
CREATE TABLE IF NOT EXISTS public.shop_visit_checklist_items (
    id TEXT PRIMARY KEY,
    group_name TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '📋',
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Indexes for fast category filtering and sorting
CREATE INDEX IF NOT EXISTS idx_shop_visit_checklist_group ON public.shop_visit_checklist_items (group_name);
CREATE INDEX IF NOT EXISTS idx_shop_visit_checklist_order ON public.shop_visit_checklist_items (sort_order);
CREATE INDEX IF NOT EXISTS idx_shop_visit_checklist_active ON public.shop_visit_checklist_items (is_active);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.shop_visit_checklist_items ENABLE ROW LEVEL SECURITY;

-- 4. Policies (allow public/authenticated users to view and update checklist options)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow public read on shop_visit_checklist_items" ON public.shop_visit_checklist_items;
    DROP POLICY IF EXISTS "Allow public write on shop_visit_checklist_items" ON public.shop_visit_checklist_items;
END $$;

CREATE POLICY "Allow public read on shop_visit_checklist_items"
ON public.shop_visit_checklist_items FOR SELECT USING (true);

CREATE POLICY "Allow public write on shop_visit_checklist_items"
ON public.shop_visit_checklist_items FOR ALL USING (true) WITH CHECK (true);

-- 5. Seed initial 53 checklist items
INSERT INTO public.shop_visit_checklist_items (id, group_name, label, icon, sort_order, is_active)
VALUES
-- Sales Counter & Points (8 items)
('cash', 'Sales Counter & Points', 'Cash counter', '💵', 1, true),
('barcode', 'Sales Counter & Points', 'Barcode scanner', '🏷️', 2, true),
('card', 'Sales Counter & Points', 'Card swipe machine + charger & UPI sound box + charger', '💳', 3, true),
('sale1', 'Sales Counter & Points', 'Sale point 1', '🧾', 4, true),
('sale2', 'Sales Counter & Points', 'Sale point 2', '🧾', 5, true),
('sale3', 'Sales Counter & Points', 'Sale point 3', '🧾', 6, true),
('offer', 'Sales Counter & Points', 'Offer board', '📢', 7, true),
('chairs', 'Sales Counter & Points', 'Chairs & Tables', '🪑', 8, true),

-- Billing & Systems (6 items)
('server', 'Billing & Systems', 'Main server computer', '🖥️', 9, true),
('billprint', 'Billing & Systems', 'Billing printer', '🖨️', 10, true),
('exciseprint', 'Billing & Systems', 'Excise printer', '📠', 11, true),
('wifi', 'Billing & Systems', 'WiFi / Networking Device', '📶', 12, true),
('mobile', 'Billing & Systems', 'Mobile Phone + Charger', '📱', 13, true),
('inverter', 'Billing & Systems', 'Inverter', '🔋', 14, true),

-- Security & Safety (3 items)
('cctv', 'Security & Safety', 'CCTV camera / TV / remote', '📹', 15, true),
('alarm', 'Security & Safety', 'Alarm system (shutter & smoke)', '🚨', 16, true),
('fire', 'Security & Safety', 'Fire cylinder', '🧯', 17, true),

-- Storage & Refrigeration (5 items)
('fridge_steel', 'Storage & Refrigeration', 'Fridge / steel unit', '❄️', 18, true),
('fridge_bud', 'Storage & Refrigeration', 'Fridge Budweiser', '🍺', 19, true),
('fridge_kf', 'Storage & Refrigeration', 'Fridge Kingfisher', '🍺', 20, true),
('water_jar', 'Storage & Refrigeration', 'Water Jar', '🚰', 21, true),
('cleaning', 'Storage & Refrigeration', 'Cleaning Items (Mop, Bucket & Liquids)', '🧹', 22, true),

-- Branding & Display (4 items)
('main_board', 'Branding & Display', 'Main Wine Shop Board', '🏙️', 23, true),
('window_disp', 'Branding & Display', 'Window Display', '🖼️', 24, true),
('disp_stand', 'Branding & Display', 'Display Stand', '🪜', 25, true),
('lighting', 'Branding & Display', 'Lighting (Board, Rack, Counter)', '💡', 26, true),

-- Doors, Shutters & Keys (6 items)
('shutter_door', 'Doors, Shutters & Keys', 'Shutter & Door', '🚪', 27, true),
('shutter_remote', 'Doors, Shutters & Keys', 'Shutter Sensor Remote', '📻', 28, true),
('main_key', 'Doors, Shutters & Keys', 'Main Shutter & Central Lock Key', '🔑', 29, true),
('cash_key', 'Doors, Shutters & Keys', 'Cash Counter & Drawer Key', '🔑', 30, true),
('godown_key', 'Doors, Shutters & Keys', 'Godown / Store Room Key', '🔑', 31, true),
('showcase_key', 'Doors, Shutters & Keys', 'Showcase / Display Case Key', '🔑', 32, true),

-- Vehicles & Delivery (5 items)
('bike_activa', 'Vehicles & Delivery', 'Bike Available (Activa)', '🛵', 33, true),
('bike_ev', 'Vehicles & Delivery', 'Bike Available (Electric)', '⚡', 34, true),
('ev_charger', 'Vehicles & Delivery', 'Bike Charger (Electric)', '🔌', 35, true),
('helmet', 'Vehicles & Delivery', 'Helmet', '🪖', 36, true),
('rto_cleared', 'Vehicles & Delivery', 'RTO Penalty Cleared', '📄', 37, true),

-- Licenses & Legal Docs (7 items)
('shop_lic', 'Licenses & Legal Docs', 'Shop License', '📜', 38, true),
('fssai_lic', 'Licenses & Legal Docs', 'FSSAI Food License', '🥗', 39, true),
('shop_act', 'Licenses & Legal Docs', 'Shop Act', '⚖️', 40, true),
('shop_map', 'Licenses & Legal Docs', 'Shop Map', '🗺️', 41, true),
('vat_cert', 'Licenses & Legal Docs', 'VAT Certificate', '📑', 42, true),
('tp_file', 'Licenses & Legal Docs', 'TP File (IMFL + CL + MML)', '📂', 43, true),
('excise_reg', 'Licenses & Legal Docs', 'Excise Register & Printout & Monthly', '📖', 44, true),

-- Accounts, Books & Expenses (9 items)
('attendance_book', 'Accounts, Books & Expenses', 'Attendance Book', '📒', 45, true),
('nokarnama', 'Accounts, Books & Expenses', 'Nokarnama & ID Proof', '🆔', 46, true),
('visit_book', 'Accounts, Books & Expenses', 'Visit Book', '📗', 47, true),
('expense_book', 'Accounts, Books & Expenses', 'Expense Book', '📘', 48, true),
('wholesale_out', 'Accounts, Books & Expenses', 'Wholesale Party Outstanding Amount', '💰', 49, true),
('license_rent', 'Accounts, Books & Expenses', 'License Rent', '🏠', 50, true),
('shop_rent', 'Accounts, Books & Expenses', 'Shop Rent', '🏪', 51, true),
('excise_police', 'Accounts, Books & Expenses', 'Excise & Police monthly', '👮', 52, true),
('opening_cash', 'Accounts, Books & Expenses', 'Opening Cash', '💵', 53, true)
ON CONFLICT (id) DO UPDATE SET
    group_name = EXCLUDED.group_name,
    label = EXCLUDED.label,
    icon = EXCLUDED.icon,
    sort_order = EXCLUDED.sort_order;
