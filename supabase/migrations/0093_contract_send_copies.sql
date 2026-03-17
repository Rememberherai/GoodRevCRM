-- Add setting to control whether signed copies are emailed upon completion
ALTER TABLE public.contract_documents
  ADD COLUMN IF NOT EXISTS send_completed_copy_to_sender BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS send_completed_copy_to_recipients BOOLEAN NOT NULL DEFAULT true;
