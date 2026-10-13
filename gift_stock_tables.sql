-- =========================================================================
-- DRINQKART GIFT STOCK MANAGEMENT SYSTEM
-- Purpose:
--   1. Create 'gift_stock_items' table (Gift Item Master)
--   2. Create 'gift_stock_trader_pairs' table (Trader & Company Master)
--   3. Create 'gift_stock_ins' table (Stock In Entries)
--   4. Create 'gift_stock_outs' table (Stock Out / Sales Entries)
--   5. Enable Row Level Security (RLS) and public policies for full access
--   6. Pre-seed Trader-Company relationships into 'gift_stock_trader_pairs'
-- =========================================================================

-- 1. Create gift_stock_items table
CREATE TABLE IF NOT EXISTS public.gift_stock_items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    store TEXT NOT NULL DEFAULT 'ALL STORES',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create gift_stock_trader_pairs table
CREATE TABLE IF NOT EXISTS public.gift_stock_trader_pairs (
    id TEXT PRIMARY KEY,
    trader TEXT NOT NULL,
    company TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_trader_company UNIQUE (trader, company)
);

-- 3. Create gift_stock_ins table
CREATE TABLE IF NOT EXISTS public.gift_stock_ins (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    store TEXT NOT NULL,
    trader TEXT NOT NULL,
    company TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create gift_stock_outs table
CREATE TABLE IF NOT EXISTS public.gift_stock_outs (
    id TEXT PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    store TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    qty INTEGER NOT NULL CHECK (qty > 0),
    customer TEXT NOT NULL,
    contact TEXT NOT NULL,
    proof_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure proof_image column exists on existing installations
ALTER TABLE public.gift_stock_outs 
ADD COLUMN IF NOT EXISTS proof_image TEXT;

-- =========================================================================
-- Enable Row Level Security (RLS) & Policies
-- =========================================================================

ALTER TABLE public.gift_stock_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_stock_trader_pairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_stock_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_stock_outs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    -- Policies for gift_stock_items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_items' AND policyname = 'Allow public read gift_stock_items') THEN
        CREATE POLICY "Allow public read gift_stock_items" ON public.gift_stock_items FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_items' AND policyname = 'Allow public insert gift_stock_items') THEN
        CREATE POLICY "Allow public insert gift_stock_items" ON public.gift_stock_items FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_items' AND policyname = 'Allow public update gift_stock_items') THEN
        CREATE POLICY "Allow public update gift_stock_items" ON public.gift_stock_items FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_items' AND policyname = 'Allow public delete gift_stock_items') THEN
        CREATE POLICY "Allow public delete gift_stock_items" ON public.gift_stock_items FOR DELETE USING (true);
    END IF;

    -- Policies for gift_stock_trader_pairs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_trader_pairs' AND policyname = 'Allow public read gift_stock_trader_pairs') THEN
        CREATE POLICY "Allow public read gift_stock_trader_pairs" ON public.gift_stock_trader_pairs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_trader_pairs' AND policyname = 'Allow public insert gift_stock_trader_pairs') THEN
        CREATE POLICY "Allow public insert gift_stock_trader_pairs" ON public.gift_stock_trader_pairs FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_trader_pairs' AND policyname = 'Allow public update gift_stock_trader_pairs') THEN
        CREATE POLICY "Allow public update gift_stock_trader_pairs" ON public.gift_stock_trader_pairs FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_trader_pairs' AND policyname = 'Allow public delete gift_stock_trader_pairs') THEN
        CREATE POLICY "Allow public delete gift_stock_trader_pairs" ON public.gift_stock_trader_pairs FOR DELETE USING (true);
    END IF;

    -- Policies for gift_stock_ins
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_ins' AND policyname = 'Allow public read gift_stock_ins') THEN
        CREATE POLICY "Allow public read gift_stock_ins" ON public.gift_stock_ins FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_ins' AND policyname = 'Allow public insert gift_stock_ins') THEN
        CREATE POLICY "Allow public insert gift_stock_ins" ON public.gift_stock_ins FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_ins' AND policyname = 'Allow public update gift_stock_ins') THEN
        CREATE POLICY "Allow public update gift_stock_ins" ON public.gift_stock_ins FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_ins' AND policyname = 'Allow public delete gift_stock_ins') THEN
        CREATE POLICY "Allow public delete gift_stock_ins" ON public.gift_stock_ins FOR DELETE USING (true);
    END IF;

    -- Policies for gift_stock_outs
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_outs' AND policyname = 'Allow public read gift_stock_outs') THEN
        CREATE POLICY "Allow public read gift_stock_outs" ON public.gift_stock_outs FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_outs' AND policyname = 'Allow public insert gift_stock_outs') THEN
        CREATE POLICY "Allow public insert gift_stock_outs" ON public.gift_stock_outs FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_outs' AND policyname = 'Allow public update gift_stock_outs') THEN
        CREATE POLICY "Allow public update gift_stock_outs" ON public.gift_stock_outs FOR UPDATE USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gift_stock_outs' AND policyname = 'Allow public delete gift_stock_outs') THEN
        CREATE POLICY "Allow public delete gift_stock_outs" ON public.gift_stock_outs FOR DELETE USING (true);
    END IF;
END $$;

-- =========================================================================
-- Initial Seed: Trader & Company Relationships
-- =========================================================================

INSERT INTO public.gift_stock_trader_pairs (id, trader, company) VALUES
('p_1', 'GAYATRI ENTERPRISES', 'Comte de Grasse'),
('p_2', 'WINE ENTERPRISES PVT LTD', 'SEAGRAM/PERNOD RICARD'),
('p_3', 'MILLINNIUM SPIRITS PVT LTD', '12TH MAN BREWING'),
('p_4', 'MILLINNIUM SPIRITS PVT LTD', 'BACARDI'),
('p_5', 'VINTAGE SPIRITS', 'SEAGRAM/PERNOD RICARD'),
('p_6', 'K.S.N. IRANI & CO.', 'MONICA ALCO BEV'),
('p_7', 'MML SPIRITS PRIVATE LIMITED', 'MEHER DISTILLERIES'),
('p_8', 'MILLINNIUM SPIRITS PVT LTD', 'RADICO KHAITAN'),
('p_9', 'VC TRADERS', 'ACE BEVERAGEZ'),
('p_10', 'VC TRADERS', 'INDEED BREWING COMPANY'),
('p_11', 'SATYAM AGENCY', 'OAKWOOD VINEYARDS'),
('p_12', 'VINTAGE SPIRITS', 'ADINCO DISTILLERIES'),
('p_13', 'DRUNKEN MONKEY BEVERAGES LTD', 'INDEED BREWING COMPANY'),
('p_14', 'G.K. ENTERPRISES', 'VIRAJ ALCOHOLS & ALLIED INDUSTRIES LTD.'),
('p_15', 'SATYAM AGENCY', 'KONKAN AGRO MARINE INDUSTRIES PVT. LTD.'),
('p_16', 'WINE ENTERPRISES PVT LTD', 'CAPOVITEZ PRIVATE LIMITED'),
('p_17', 'VINTAGE SPIRITS', 'AMRUT DISTILLERIES'),
('p_18', 'ROYAL AGENCY', 'UNITED BREWERIES'),
('p_19', 'GRACE ENTERPRISES', 'UNITED SPIRITS'),
('p_20', 'VINTAGE SPIRITS', 'ALLIED BLENDERS & DISTILLERS'),
('p_21', 'WALVEKAR SONS', 'ARDBEG'),
('p_22', 'MILLINNIUM SPIRITS PVT LTD', 'BEAM SUNTORY'),
('p_23', 'ROHIT ENTERPRISES', 'ARKA'),
('p_24', 'MILLINNIUM SPIRITS PVT LTD', 'MONICA ALCO BEV'),
('p_25', 'KRANTI LIQUORS', 'BAAGH'),
('p_26', 'ROHIT ENTERPRISES', 'BACARDI'),
('p_27', 'DRUNKEN MONKEY BEVERAGES LTD', 'SOMA VINE VILLAGE PVT LTD'),
('p_28', 'KRANTI LIQUORS', 'INBREW'),
('p_29', 'WINE ENTERPRISES PVT LTD', 'BACARDI'),
('p_30', 'ROHIT ENTERPRISES', 'WILLIAM GRANT & SONS'),
('p_31', 'KRANTI LIQUORS', 'BACARDI'),
('p_32', 'EFFINGUT BREWERIES PVT LTD-PUNE', 'B&CO'),
('p_33', 'SATYAM AGENCY', 'BUDWEISER'),
('p_34', 'SATYAM AGENCY', 'BELLA TAVOLA'),
('p_35', 'WALVEKAR SONS', 'SULA'),
('p_36', 'WALVEKAR SONS', 'MOET HENNESSY'),
('p_37', 'MILLINNIUM SPIRITS PVT LTD', 'PAUL JOHN'),
('p_38', 'K. B. WINES PVT LTD', 'BIRA'),
('p_39', 'WALVEKAR SONS', 'BIG BANYAN'),
('p_40', 'WALVEKAR SONS', 'BILLION AIR'),
('p_41', 'WALVEKAR SONS', 'UNITED SPIRITS'),
('p_42', 'WALVEKAR SONS', 'ASPRI SPIRITS'),
('p_43', 'WALVEKAR SONS', 'BACARDI'),
('p_44', 'VINTAGE SPIRITS', 'BLUEMOON/PARTY SPECIAL'),
('p_45', 'KRANTI LIQUORS', 'UNITED SPIRITS'),
('p_46', 'SATYAM AGENCY', 'AMRUT DISTILLERIES'),
('p_47', 'VINTAGE SPIRITS', 'PRIVILIGE INDUSTRIES LIMITED'),
('p_48', 'VINTAGE SPIRITS', 'IndoBevs'),
('p_49', 'WALVEKAR SONS', 'Grainotch Industries'),
('p_50', 'WALVEKAR SONS', 'ACE BEVERAGEZ'),
('p_51', 'K.S.N. IRANI & CO.', 'JOHN DISTILLERIES'),
('p_52', 'ROYAL AGENCY', 'CAMPARI'),
('p_53', 'ROYAL AGENCY', 'IndoBevs'),
('p_54', 'WALVEKAR SONS', 'IndoBevs'),
('p_55', 'WALVEKAR SONS', 'MONICA ALCO BEV'),
('p_56', 'VC TRADERS', 'MONICA ALCO BEV'),
('p_57', 'ROHIT ENTERPRISES', 'PAUL JOHN'),
('p_58', 'K.S.N. IRANI & CO.', 'C PROSECCO'),
('p_59', 'K.S.N. IRANI & CO.', 'CACHACA PITU'),
('p_60', 'K.S.N. IRANI & CO.', 'CAFE CULTURE'),
('p_61', 'K.S.N. IRANI & CO.', 'CAFFE BORGHETTI'),
('p_62', 'MILLINNIUM SPIRITS PVT LTD', 'PICCADILY DISTILLERIES'),
('p_63', 'MILLINNIUM SPIRITS PVT LTD', 'CAMPARI'),
('p_64', 'K.S.N. IRANI & CO.', 'CAMPARI'),
('p_65', 'WALVEKAR SONS', 'SEAGRAM/PERNOD RICARD'),
('p_66', 'GRACE ENTERPRISES', 'ASPRI SPIRITS'),
('p_67', 'WALVEKAR SONS', 'CARLSBERG'),
('p_68', 'K.S.N. IRANI & CO.', 'PICCADILY DISTILLERIES'),
('p_69', 'K.S.N. IRANI & CO.', 'CASILLERO DEL DIABLO'),
('p_70', 'K.S.N. IRANI & CO.', 'ANGELS SHARE'),
('p_71', 'K.S.N. IRANI & CO.', 'Castello di Querceto')
ON CONFLICT (trader, company) DO NOTHING;
