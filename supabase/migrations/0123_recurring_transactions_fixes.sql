-- Fix recurring_transactions: created_by FK and RLS policy permissions
-- Bug #5: created_by references auth.users instead of public.users
-- Bug #6: INSERT/DELETE RLS policies are too permissive (allow viewers)

-- Fix created_by FK: drop auth.users FK constraint and add public.users FK
DO $$
BEGIN
  -- Drop the existing FK to auth.users if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'recurring_transactions'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name LIKE '%created_by%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.recurring_transactions DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'recurring_transactions'
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name LIKE '%created_by%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.recurring_transactions
  ADD CONSTRAINT recurring_transactions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id);

-- Fix RLS policies: require member role for create/update, admin for soft delete
DROP POLICY IF EXISTS "recurring_transactions_insert" ON public.recurring_transactions;
DROP POLICY IF EXISTS "recurring_transactions_update" ON public.recurring_transactions;
DROP POLICY IF EXISTS "recurring_transactions_delete" ON public.recurring_transactions;

CREATE POLICY "recurring_transactions_insert"
  ON public.recurring_transactions FOR INSERT
  WITH CHECK (public.has_accounting_role(company_id, 'member'));

CREATE POLICY "recurring_transactions_update"
  ON public.recurring_transactions FOR UPDATE
  USING (public.has_accounting_role(company_id, 'member'))
  WITH CHECK (
    (
      deleted_at IS NULL
      AND public.has_accounting_role(company_id, 'member')
    )
    OR public.has_accounting_role(company_id, 'admin')
  );

CREATE POLICY "recurring_transactions_delete"
  ON public.recurring_transactions FOR DELETE
  USING (public.has_accounting_role(company_id, 'admin'));
