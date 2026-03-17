-- Migration 0092: Contract storage bucket and triggers
-- Private bucket for contract PDFs, certificates, and signed documents
-- Storage policies match the pattern from 0071_sequence_step_attachments.sql

-- Storage bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: broad authenticated access
-- Project scoping is enforced in API route handlers, not at bucket level
CREATE POLICY "Authenticated users can upload contracts"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can read contracts"
    ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'contracts');

CREATE POLICY "Authenticated users can delete contracts"
    ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'contracts');
