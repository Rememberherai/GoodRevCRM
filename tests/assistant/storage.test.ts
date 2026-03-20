import { describe, expect, it } from 'vitest';
import {
  COMMUNITY_UPLOAD_BUCKET,
  buildCommunityReceiptStoragePath,
  buildReceiptUploadMessage,
} from '@/lib/assistant/storage';

describe('community receipt storage', () => {
  it('builds a receipt path under the community receipt folder', () => {
    const path = buildCommunityReceiptStoragePath('project-123', 'Spring Gala Receipt.JPG');

    expect(path).toContain('project-123/community/receipts/');
    expect(path).toContain('-spring-gala-receipt.jpg');
  });

  it('formats a structured assistant upload message', () => {
    const message = buildReceiptUploadMessage({
      bucket: COMMUNITY_UPLOAD_BUCKET,
      storagePath: 'project-123/community/receipts/2026/03/example.jpg',
      contentType: 'image/jpeg',
      fileName: 'example.jpg',
    });

    expect(message).toContain('bucket=contracts');
    expect(message).toContain('storage_path=project-123/community/receipts/2026/03/example.jpg');
    expect(message).toContain('content_type=image/jpeg');
  });
});

