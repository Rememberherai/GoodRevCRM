-- Migration 0170: Storage bucket for email builder images
-- Images uploaded via the email builder are stored here and referenced in email HTML.

INSERT INTO storage.buckets (id, name, public)
VALUES ('email-images', 'email-images', true)
ON CONFLICT (id) DO NOTHING;

-- Drop policies first to make migration idempotent
DROP POLICY IF EXISTS "Authenticated users can upload email images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update email images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for email images" ON storage.objects;

-- Allow authenticated users to upload email images
CREATE POLICY "Authenticated users can upload email images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'email-images');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update email images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'email-images')
WITH CHECK (bucket_id = 'email-images');

-- Allow authenticated users to delete email images
CREATE POLICY "Authenticated users can delete email images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'email-images');

-- Allow public read access so emails can display images
CREATE POLICY "Public read access for email images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-images');
