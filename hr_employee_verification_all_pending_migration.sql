-- ============================================================================
-- HR SYSTEM: RESET ALL EMPLOYEES TO PENDING VERIFICATION & STORE VERIFIER EMP ID
-- Run this script in the Supabase SQL Editor.
-- ============================================================================

-- 1. Ensure verification columns exist in hr_management_employees,
--    including verified_by_emp_id to explicitly record the verifier's Employee ID.
ALTER TABLE public.hr_management_employees
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'Pending',
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_by_emp_id text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_remarks text;

-- Ensure valid check constraint on verification_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hr_management_employees_verification_status_check'
  ) THEN
    ALTER TABLE public.hr_management_employees
      ADD CONSTRAINT hr_management_employees_verification_status_check
      CHECK (verification_status IN ('Pending', 'Verified', 'Rejected'));
  END IF;
END $$;

-- 2. Indexes for fast filtering on verification_status & verifier employee ID
CREATE INDEX IF NOT EXISTS idx_hr_emp_verification
  ON public.hr_management_employees (verification_status);

CREATE INDEX IF NOT EXISTS idx_hr_emp_verified_by_emp_id
  ON public.hr_management_employees (verified_by_emp_id);

-- 3. RESET ALL EXISTING EMPLOYEES:
--    Set all employee accounts to require verification ('Pending')
--    and clear any previous verification stamps & remarks.
UPDATE public.hr_management_employees
   SET verification_status = 'Pending',
       verified_by = NULL,
       verified_by_emp_id = NULL,
       verified_at = NULL,
       verification_remarks = NULL;

-- 4. TRIGGER FOR NEW EMPLOYEES:
--    Ensure every newly created or inserted employee starts as 'Pending' (Action Required).
CREATE OR REPLACE FUNCTION public.hr_emp_set_pending()
RETURNS trigger AS $$
BEGIN
  NEW.verification_status := 'Pending';
  NEW.verified_by := NULL;
  NEW.verified_by_emp_id := NULL;
  NEW.verified_at := NULL;
  NEW.verification_remarks := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_emp_pending ON public.hr_management_employees;
CREATE TRIGGER trg_hr_emp_pending
  BEFORE INSERT ON public.hr_management_employees
  FOR EACH ROW
  EXECUTE FUNCTION public.hr_emp_set_pending();

-- 5. VERIFICATION STATUS CHECK (shows total counts per status):
SELECT verification_status, count(*) AS total_employees
  FROM public.hr_management_employees
 GROUP BY verification_status;

