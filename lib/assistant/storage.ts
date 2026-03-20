import crypto from 'crypto';

export const COMMUNITY_UPLOAD_BUCKET = 'contracts';

function sanitizeFileName(fileName: string) {
  return fileName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export function buildCommunityReceiptStoragePath(projectId: string, fileName: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safeFileName = sanitizeFileName(fileName) || 'receipt-upload';
  return `${projectId}/community/receipts/${year}/${month}/${crypto.randomUUID()}-${safeFileName}`;
}

export function buildReceiptUploadMessage(params: {
  bucket: string;
  storagePath: string;
  contentType: string;
  fileName: string;
}) {
  return [
    'Uploaded receipt file for processing.',
    `bucket=${params.bucket}`,
    `storage_path=${params.storagePath}`,
    `content_type=${params.contentType}`,
    `file_name=${params.fileName}`,
    'Please extract the vendor, amount, date, and likely coding details, then ask me to confirm before creating the bill.',
  ].join('\n');
}

