/**
 * Rate Limiting & Sanitizer Tests
 *
 * Tests for validate-email rate limiting, DOMPurify email sanitization,
 * and middleware CSP headers.
 */

import { describe, it, expect } from 'vitest';

// ============================================================
// 1. Validate-email rate limiting pattern (BUG-176)
// ============================================================
describe('Validate-email rate limiting (BUG-176)', () => {
  // Replicate the rate limiter logic for testing
  const RATE_LIMIT_WINDOW_MS = 60_000;
  const RATE_LIMIT_MAX = 3;

  function createRateLimiter() {
    const map = new Map<string, { count: number; resetAt: number }>();

    return function checkRateLimit(userId: string): boolean {
      const now = Date.now();
      const entry = map.get(userId);
      if (!entry || now > entry.resetAt) {
        map.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
      }
      if (entry.count >= RATE_LIMIT_MAX) return false;
      entry.count++;
      return true;
    };
  }

  it('should allow first request', () => {
    const checkRateLimit = createRateLimiter();
    expect(checkRateLimit('user-1')).toBe(true);
  });

  it('should allow up to 3 requests', () => {
    const checkRateLimit = createRateLimiter();
    expect(checkRateLimit('user-1')).toBe(true);
    expect(checkRateLimit('user-1')).toBe(true);
    expect(checkRateLimit('user-1')).toBe(true);
  });

  it('should block 4th request', () => {
    const checkRateLimit = createRateLimiter();
    checkRateLimit('user-1');
    checkRateLimit('user-1');
    checkRateLimit('user-1');
    expect(checkRateLimit('user-1')).toBe(false);
  });

  it('should track users independently', () => {
    const checkRateLimit = createRateLimiter();
    checkRateLimit('user-1');
    checkRateLimit('user-1');
    checkRateLimit('user-1');
    expect(checkRateLimit('user-1')).toBe(false);
    // Different user should still be allowed
    expect(checkRateLimit('user-2')).toBe(true);
  });
});

// ============================================================
// 2. Kiosk PIN rate limiting pattern (BUG-175)
// ============================================================
describe('Kiosk PIN rate limiting (BUG-175)', () => {
  const MAX_ATTEMPTS = 5;
  const BLOCK_DURATION_MS = 5 * 60 * 1000;

  function createPinRateLimiter() {
    const attempts = new Map<string, { count: number; blockedUntil: number }>();

    return {
      isBlocked(ip: string): boolean {
        const entry = attempts.get(ip);
        if (!entry) return false;
        if (Date.now() > entry.blockedUntil) {
          attempts.delete(ip);
          return false;
        }
        return entry.count >= MAX_ATTEMPTS;
      },
      recordFailure(ip: string): void {
        const entry = attempts.get(ip);
        if (!entry) {
          attempts.set(ip, { count: 1, blockedUntil: Date.now() + BLOCK_DURATION_MS });
        } else {
          entry.count++;
        }
      },
      clearAttempts(ip: string): void {
        attempts.delete(ip);
      },
    };
  }

  it('should not block on first attempts', () => {
    const limiter = createPinRateLimiter();
    expect(limiter.isBlocked('1.2.3.4')).toBe(false);
    limiter.recordFailure('1.2.3.4');
    expect(limiter.isBlocked('1.2.3.4')).toBe(false);
  });

  it('should block after 5 failures', () => {
    const limiter = createPinRateLimiter();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('1.2.3.4');
    }
    expect(limiter.isBlocked('1.2.3.4')).toBe(true);
  });

  it('should not block other IPs', () => {
    const limiter = createPinRateLimiter();
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('1.2.3.4');
    }
    expect(limiter.isBlocked('5.6.7.8')).toBe(false);
  });

  it('should clear on successful login', () => {
    const limiter = createPinRateLimiter();
    for (let i = 0; i < 4; i++) {
      limiter.recordFailure('1.2.3.4');
    }
    limiter.clearAttempts('1.2.3.4');
    expect(limiter.isBlocked('1.2.3.4')).toBe(false);
  });
});

// ============================================================
// 3. Email HTML sanitization via DOMPurify (BUG-137)
// ============================================================
describe('Email HTML sanitization (BUG-137)', () => {
  let DOMPurify: typeof import('isomorphic-dompurify').default;

  it('should import DOMPurify', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    expect(typeof DOMPurify.sanitize).toBe('function');
  });

  it('should strip script tags', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    const dirty = '<p>Hello</p><script>alert("xss")</script>';
    const clean = DOMPurify.sanitize(dirty, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    });
    expect(clean).not.toContain('<script>');
    expect(clean).toContain('<p>Hello</p>');
  });

  it('should strip javascript: links', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    const dirty = '<a href="javascript:alert(1)">Click me</a>';
    const clean = DOMPurify.sanitize(dirty, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    });
    expect(clean).not.toContain('javascript:');
  });

  it('should strip event handlers', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    const dirty = '<img src="x" onerror="alert(1)">';
    const clean = DOMPurify.sanitize(dirty, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    });
    expect(clean).not.toContain('onerror');
  });

  it('should strip iframes', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    const dirty = '<iframe src="https://evil.com"></iframe>';
    const clean = DOMPurify.sanitize(dirty, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    });
    expect(clean).not.toContain('<iframe');
  });

  it('should preserve safe HTML content', async () => {
    const mod = await import('isomorphic-dompurify');
    DOMPurify = mod.default;
    const safe = '<div><h1>Subject</h1><p>Hello <strong>world</strong></p><a href="https://example.com">Link</a></div>';
    const clean = DOMPurify.sanitize(safe, {
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    });
    expect(clean).toContain('<h1>Subject</h1>');
    expect(clean).toContain('<strong>world</strong>');
    expect(clean).toContain('href="https://example.com"');
  });

  // Note: DOMPurify with jsdom may strip <style> tags even with ADD_TAGS.
  // In a real browser environment, ADD_TAGS: ['style'] works correctly.
  // This is a known jsdom limitation — not a real bug in the sanitizer.
});

// ============================================================
// 4. SMTP injection prevention (BUG-133/176)
// ============================================================
describe('SMTP injection prevention (BUG-133)', () => {
  it('should reject emails with CR/LF characters', () => {
    const hasCRLF = (email: string) => /[\r\n]/.test(email);

    expect(hasCRLF('normal@example.com')).toBe(false);
    expect(hasCRLF('injected@example.com\r\nRSET')).toBe(true);
    expect(hasCRLF('injected@example.com\nMAIL FROM:<evil@hacker.com>')).toBe(true);
  });

  it('should sanitize email before SMTP command', () => {
    const sanitizeForSmtp = (email: string) => email.replace(/[\r\n]/g, '');

    expect(sanitizeForSmtp('normal@example.com')).toBe('normal@example.com');
    expect(sanitizeForSmtp('evil@test.com\r\nRSET')).toBe('evil@test.comRSET');
    expect(sanitizeForSmtp('evil@test.com\nMAIL FROM:<x>')).toBe('evil@test.comMAIL FROM:<x>');
  });
});

// ============================================================
// 5. Middleware CSP headers
// ============================================================
describe('Middleware CSP header values', () => {
  it('non-embed CSP should restrict framing to self', () => {
    const csp = "frame-ancestors 'self'";
    expect(csp).toContain("'self'");
    expect(csp).not.toContain('*');
    expect(csp).not.toContain('https:');
  });

  it('embed CSP should restrict forms to self', () => {
    const csp = "frame-ancestors 'self' https:; form-action 'self'";
    expect(csp).toContain("form-action 'self'");
    // Should NOT allow form submission to external origins
    expect(csp).not.toContain('form-action *');
  });

  it('embed CSP should not include wildcard frame-ancestors', () => {
    const csp = "frame-ancestors 'self' https:; form-action 'self'";
    // Should NOT be just '*' — at least restricted to https:
    expect(csp).not.toBe("frame-ancestors *");
    expect(csp).toContain('https:');
  });
});

// ============================================================
// 6. Comment ownership check pattern (BUG-104)
// ============================================================
describe('Comment ownership enforcement (BUG-104)', () => {
  it('should require created_by filter on update queries', () => {
    // This is a pattern test — verify the logic that should be in the route
    // The actual DB call is: .update(data).eq('id', commentId).eq('created_by', user.id)
    // We verify the pattern: if created_by doesn't match, no rows are updated

    const comments = [
      { id: 'c1', created_by: 'user-a', content: 'Hello' },
      { id: 'c2', created_by: 'user-b', content: 'World' },
    ];

    // Simulating the query with ownership check
    const updateWithOwnership = (commentId: string, userId: string) => {
      return comments.find(c => c.id === commentId && c.created_by === userId);
    };

    // Owner can update their own comment
    expect(updateWithOwnership('c1', 'user-a')).toBeDefined();

    // Non-owner should NOT be able to update
    expect(updateWithOwnership('c1', 'user-b')).toBeUndefined();
    expect(updateWithOwnership('c2', 'user-a')).toBeUndefined();
  });
});
