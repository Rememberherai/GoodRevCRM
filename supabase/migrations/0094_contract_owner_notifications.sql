-- Add owner notification preferences to contract_documents
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS notify_on_view BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_sign BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_on_decline BOOLEAN NOT NULL DEFAULT true;
