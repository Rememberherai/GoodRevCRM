import { NextResponse } from 'next/server';
import { z } from 'zod';
import dns from 'dns';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const requestSchema = z.object({
  emails: z.array(z.string()).min(1).max(500),
});

interface ValidationResult {
  email: string;
  valid: boolean;
  reason?: string;
}

// Common disposable/temporary email domains
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com', 'grr.la',
  'dispostable.com', 'trashmail.com', 'fakeinbox.com', 'tempail.com',
  'maildrop.cc', 'mailnesia.com', 'tempr.email', 'discard.email',
]);

function validateFormat(email: string): string | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Invalid email format';
  if (email.length > 254) return 'Email too long';

  const [local, domain] = email.split('@');
  if (!local || local.length > 64) return 'Invalid local part';
  if (!domain || domain.length > 253) return 'Invalid domain';

  // Check for common typos in popular domains
  const typoMap: Record<string, string> = {
    'gmial.com': 'gmail.com',
    'gmai.com': 'gmail.com',
    'gmil.com': 'gmail.com',
    'gamil.com': 'gmail.com',
    'gnail.com': 'gmail.com',
    'gmal.com': 'gmail.com',
    'yahooo.com': 'yahoo.com',
    'yaho.com': 'yahoo.com',
    'hotmal.com': 'hotmail.com',
    'hotmial.com': 'hotmail.com',
    'outlok.com': 'outlook.com',
  };
  if (typoMap[domain.toLowerCase()]) {
    return `Likely typo - did you mean ${local}@${typoMap[domain.toLowerCase()]}?`;
  }

  return null;
}

async function checkMx(domain: string): Promise<{ hasMx: boolean; error?: string }> {
  try {
    const records = await resolveMx(domain);
    return { hasMx: records && records.length > 0 };
  } catch (err: unknown) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOTFOUND' || error.code === 'ENODATA') {
      return { hasMx: false, error: 'Domain does not exist' };
    }
    if (error.code === 'ETIMEOUT') {
      return { hasMx: false, error: 'DNS lookup timed out' };
    }
    return { hasMx: false, error: 'DNS lookup failed' };
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { emails } = parsed.data;

    // Deduplicate domains for MX checks
    const domainMxCache = new Map<string, { hasMx: boolean; error?: string }>();

    const results: ValidationResult[] = [];

    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();

      // 1. Format check
      const formatError = validateFormat(trimmed);
      if (formatError) {
        results.push({ email: trimmed, valid: false, reason: formatError });
        continue;
      }

      const domain = trimmed.split('@')[1] as string; // format validated above

      // 2. Disposable domain check
      if (DISPOSABLE_DOMAINS.has(domain)) {
        results.push({ email: trimmed, valid: false, reason: 'Disposable/temporary email domain' });
        continue;
      }

      // 3. MX record check (cached per domain)
      if (!domainMxCache.has(domain)) {
        domainMxCache.set(domain, await checkMx(domain));
      }

      const mxResult = domainMxCache.get(domain)!;
      if (!mxResult.hasMx) {
        results.push({
          email: trimmed,
          valid: false,
          reason: mxResult.error || 'Domain has no mail server (no MX records)',
        });
        continue;
      }

      results.push({ email: trimmed, valid: true });
    }

    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.filter((r) => !r.valid).length;

    return NextResponse.json({ results, summary: { total: results.length, valid: validCount, invalid: invalidCount } });
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
