import { useState, useCallback, useRef } from 'react';

interface EmailValidationResult {
  valid: boolean;
  reason?: string;
}

interface ValidateOptions {
  personId?: string;
  projectSlug?: string;
}

export function useEmailValidation() {
  const [validating, setValidating] = useState(false);
  const [result, setResult] = useState<EmailValidationResult | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const validate = useCallback(async (email: string, options?: ValidateOptions) => {
    // Clear previous result
    setResult(null);

    // Skip empty or clearly incomplete emails
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      return;
    }

    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setValidating(true);
    try {
      const payload: Record<string, unknown> = { emails: [trimmed] };
      if (options?.personId && options?.projectSlug) {
        payload.personIds = [options.personId];
        payload.projectSlug = options.projectSlug;
      }

      const response = await fetch('/api/validate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        setResult(null);
        return;
      }

      const data = await response.json();
      if (data.results?.[0]) {
        setResult(data.results[0]);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Don't block on validation failures
      setResult(null);
    } finally {
      if (!controller.signal.aborted) {
        setValidating(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    setResult(null);
    setValidating(false);
    abortRef.current?.abort();
  }, []);

  return { validate, validating, result, clear };
}
