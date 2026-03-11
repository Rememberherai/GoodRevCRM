-- Add attachments column to sequence_steps for email step file attachments
ALTER TABLE sequence_steps
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- Add comment describing the schema
COMMENT ON COLUMN sequence_steps.attachments IS 'Array of attachment objects: [{file_name, file_type, file_size, storage_path}]';

-- Create storage bucket for sequence attachments if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('sequence-attachments', 'sequence-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: authenticated users can upload attachments
CREATE POLICY "Authenticated users can upload sequence attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'sequence-attachments');

-- Storage policy: authenticated users can read attachments
CREATE POLICY "Authenticated users can read sequence attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'sequence-attachments');

-- Storage policy: authenticated users can delete their attachments
CREATE POLICY "Authenticated users can delete sequence attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'sequence-attachments');
