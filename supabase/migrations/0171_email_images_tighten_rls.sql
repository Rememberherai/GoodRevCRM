-- Migration 0171: Tighten email-images storage RLS to project-scoped access
-- Replaces the permissive bucket-only policies from 0170 with policies that
-- verify the user is a member of the project whose folder they're accessing.

DROP POLICY IF EXISTS "Authenticated users can upload email images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update email images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete email images" ON storage.objects;
-- Public read stays unchanged, just drop-and-recreate for idempotency
DROP POLICY IF EXISTS "Public read access for email images" ON storage.objects;

-- Allow authenticated users to upload email images (project-scoped)
CREATE POLICY "Authenticated users can upload email images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'email-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.deleted_at IS NULL
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
        )
      )
  )
);

-- Allow authenticated users to update their uploads (project-scoped)
CREATE POLICY "Authenticated users can update email images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'email-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.deleted_at IS NULL
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
        )
      )
  )
)
WITH CHECK (
  bucket_id = 'email-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.deleted_at IS NULL
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
        )
      )
  )
);

-- Allow authenticated users to delete email images (project-scoped)
CREATE POLICY "Authenticated users can delete email images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'email-images'
  AND (storage.foldername(name))[1] IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id::text = (storage.foldername(name))[1]
      AND p.deleted_at IS NULL
      AND (
        p.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM project_memberships pm
          WHERE pm.project_id = p.id
            AND pm.user_id = auth.uid()
        )
      )
  )
);

-- Allow public read access so emails can display images
CREATE POLICY "Public read access for email images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'email-images');
