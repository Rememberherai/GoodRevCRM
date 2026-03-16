import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import dns from 'dns';
import net from 'net';
import { promisify } from 'util';

const resolveMx = promisify(dns.resolveMx);

const requestSchema = z.object({
  emails: z.array(z.string()).min(1).max(500),
  // Optional: persist verification status for these person IDs
  personIds: z.array(z.string()).optional(),
  projectSlug: z.string().optional(),
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

async function checkMx(domain: string): Promise<{ hasMx: boolean; mxHost?: string; error?: string }> {
  try {
    const records = await resolveMx(domain);
    if (records && records.length > 0) {
      // Sort by priority (lowest = highest priority) and return the best MX host
      records.sort((a, b) => a.priority - b.priority);
      return { hasMx: true, mxHost: records[0]!.exchange };
    }
    return { hasMx: false };
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

// SMTP RCPT TO verification — checks if the mailbox actually exists
const SMTP_TIMEOUT = 7000; // 7 seconds per connection

async function smtpVerify(
  email: string,
  mxHost: string
): Promise<{ exists: boolean; catchAll?: boolean; reason?: string }> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let step = 0;
    let resolved = false;
    let responseBuffer = '';

    const done = (result: { exists: boolean; catchAll?: boolean; reason?: string }) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    const timeout = setTimeout(() => {
      done({ exists: true, reason: 'SMTP timeout — assuming valid' });
    }, SMTP_TIMEOUT);

    socket.on('error', () => {
      clearTimeout(timeout);
      // Can't connect to SMTP — don't penalize, assume valid (MX exists)
      done({ exists: true, reason: 'SMTP connection failed — assuming valid' });
    });

    socket.on('close', () => {
      clearTimeout(timeout);
      if (!resolved) {
        done({ exists: true, reason: 'SMTP connection closed early — assuming valid' });
      }
    });

    socket.on('data', (data) => {
      responseBuffer += data.toString();

      // Process complete lines
      const lines = responseBuffer.split('\r\n');
      responseBuffer = lines.pop() || ''; // keep incomplete line in buffer

      for (const line of lines) {
        if (!line) continue;
        const code = parseInt(line.substring(0, 3), 10);
        if (isNaN(code)) continue;

        // Multi-line responses (e.g., 250-PIPELINING) — wait for final line (250 without dash)
        if (line[3] === '-') continue;

        if (step === 0) {
          // Server greeting — expect 220
          if (code === 220) {
            step = 1;
            socket.write('EHLO verify.goodrev.com\r\n');
          } else {
            done({ exists: true, reason: 'SMTP server rejected connection — assuming valid' });
          }
        } else if (step === 1) {
          // EHLO response — expect 250
          if (code === 250) {
            step = 2;
            socket.write('MAIL FROM:<verify@goodrev.com>\r\n');
          } else {
            done({ exists: true, reason: 'EHLO rejected — assuming valid' });
          }
        } else if (step === 2) {
          // MAIL FROM response
          if (code === 250) {
            step = 3;
            socket.write(`RCPT TO:<${email}>\r\n`);
          } else {
            done({ exists: true, reason: 'MAIL FROM rejected — assuming valid' });
          }
        } else if (step === 3) {
          // RCPT TO response — this is the key check
          socket.write('QUIT\r\n');
          clearTimeout(timeout);

          if (code === 250) {
            done({ exists: true });
          } else if (code === 550 || code === 551 || code === 552 || code === 553) {
            // 550 = mailbox unavailable, 551 = user not local, 552 = exceeded storage, 553 = mailbox name not allowed
            done({ exists: false, reason: 'Mailbox does not exist' });
          } else if (code === 450 || code === 451 || code === 452) {
            // Temporary failure — don't penalize
            done({ exists: true, reason: 'SMTP temporary error — assuming valid' });
          } else {
            // Unknown response — be conservative
            done({ exists: true, reason: `SMTP returned ${code} — assuming valid` });
          }
        }
      }
    });

    socket.connect(25, mxHost);
  });
}

// Catch-all detection: test a random nonexistent address
async function isCatchAll(mxHost: string, domain: string): Promise<boolean> {
  const fakeEmail = `nonexistent-test-${Date.now()}@${domain}`;
  const result = await smtpVerify(fakeEmail, mxHost);
  return result.exists && !result.reason;
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

    const { emails, personIds, projectSlug } = parsed.data;

    // Deduplicate domains for MX checks and catch-all detection
    const domainMxCache = new Map<string, { hasMx: boolean; mxHost?: string; error?: string }>();
    const catchAllCache = new Map<string, boolean>();

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

      // 4. SMTP RCPT TO verification
      if (mxResult.mxHost) {
        // Check if domain is catch-all (cached per domain)
        if (!catchAllCache.has(domain)) {
          catchAllCache.set(domain, await isCatchAll(mxResult.mxHost, domain));
        }

        if (catchAllCache.get(domain)) {
          // Catch-all server accepts everything — MX is valid, can't verify individual mailbox
          results.push({ email: trimmed, valid: true });
          continue;
        }

        // Verify the actual mailbox
        const smtpResult = await smtpVerify(trimmed, mxResult.mxHost);
        if (!smtpResult.exists) {
          results.push({
            email: trimmed,
            valid: false,
            reason: smtpResult.reason || 'Mailbox does not exist',
          });
          continue;
        }
      }

      results.push({ email: trimmed, valid: true });
    }

    // Persist verification status if person context is provided
    if (personIds?.length && projectSlug) {
      try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('slug', projectSlug)
            .is('deleted_at', null)
            .single();

          if (project) {
            const validEmails = new Set(results.filter((r) => r.valid).map((r) => r.email));
            const invalidEmails = new Set(results.filter((r) => !r.valid).map((r) => r.email));

            // Mark valid emails as verified
            if (validEmails.size > 0) {
              await supabase
                .from('people')
                .update({
                  email_verified: true,
                  email_verified_at: new Date().toISOString(),
                })
                .eq('project_id', project.id)
                .in('id', personIds)
                .in('email', Array.from(validEmails));
            }

            // Mark invalid emails as not verified
            if (invalidEmails.size > 0) {
              await supabase
                .from('people')
                .update({
                  email_verified: false,
                  email_verified_at: new Date().toISOString(),
                })
                .eq('project_id', project.id)
                .in('id', personIds)
                .in('email', Array.from(invalidEmails));
            }
          }
        }
      } catch (dbErr) {
        // Don't fail the validation response if DB update fails
        console.error('Failed to persist email verification status:', dbErr);
      }
    }

    const validCount = results.filter((r) => r.valid).length;
    const invalidCount = results.filter((r) => !r.valid).length;

    return NextResponse.json({ results, summary: { total: results.length, valid: validCount, invalid: invalidCount } });
  } catch (error) {
    console.error('Email validation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
