-- HR FMS: employee verification ("Action Required")
-- Run once in the Supabase SQL editor.

ALTER TABLE hr_management_employees
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'Pending'
    CHECK (verification_status IN ('Pending','Verified','Rejected')),
  ADD COLUMN IF NOT EXISTS verified_by text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_remarks text;

-- Existing employees are treated as already verified (runs once, before the trigger exists)
UPDATE hr_management_employees
   SET verification_status = 'Verified', verified_at = now()
 WHERE verification_status = 'Pending';

CREATE INDEX IF NOT EXISTS idx_hr_emp_verification
  ON hr_management_employees (verification_status);

-- Every newly created employee starts as Pending, regardless of what the client sends
CREATE OR REPLACE FUNCTION hr_emp_set_pending() RETURNS trigger AS $$
BEGIN
  NEW.verification_status := 'Pending';
  NEW.verified_by := NULL;
  NEW.verified_at := NULL;
  NEW.verification_remarks := NULL;
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hr_emp_pending ON hr_management_employees;
CREATE TRIGGER trg_hr_emp_pending
  BEFORE INSERT ON hr_management_employees
  FOR EACH ROW EXECUTE FUNCTION hr_emp_set_pending();
