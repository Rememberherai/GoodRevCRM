/**
 * Resend email provider integration.
 * Uses raw fetch — no SDK dependency.
 */

export interface ResendEmailPayload {
  from: string; // "Name <email@domain.com>"
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  reply_to?: string;
}

export interface ResendSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface ResendDomainRecord {
  id: string;
  name: string;
  status?: string;
  records?: Array<{ type: string; name: string; value: string; status: string }>;
}

const RESEND_API_URL = 'https://api.resend.com/emails';

export async function sendViaResend(
  apiKey: string,
  payload: ResendEmailPayload
): Promise<ResendSendResult> {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: payload.from,
      to: Array.isArray(payload.to) ? payload.to : [payload.to],
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      reply_to: payload.reply_to,
    }),
  });

  if (!response.ok) {
    let errorMessage = `Resend API error (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody.message) {
        errorMessage = `Resend: ${errorBody.message}`;
      }
    } catch {
      // ignore JSON parse failure
    }
    return { success: false, error: errorMessage };
  }

  const data = await response.json();
  return { success: true, messageId: data.id };
}

/**
 * Verify a domain's DNS configuration with Resend.
 * Returns the domain verification status and required DNS records.
 */
export async function getResendDomainStatus(
  apiKey: string,
  domainId: string
): Promise<{ verified: boolean; records: Array<{ type: string; name: string; value: string; status: string }> } | null> {
  const response = await fetch(`https://api.resend.com/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  return {
    verified: data.status === 'verified',
    records: (data.records ?? []).map((r: { type: string; name: string; value: string; status: string }) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      status: r.status,
    })),
  };
}

/**
 * Register a domain with Resend for email sending.
 * Returns the domain ID and DNS records needed for verification.
 */
export async function addResendDomain(
  apiKey: string,
  domain: string
): Promise<{ id: string; records: Array<{ type: string; name: string; value: string; status: string }> } | { error: string }> {
  const response = await fetch('https://api.resend.com/domains', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: domain }),
  });

  if (!response.ok) {
    let errorMessage = `Resend API error (${response.status})`;
    try {
      const errorBody = await response.json();
      if (errorBody.message) errorMessage = `Resend: ${errorBody.message}`;
    } catch {
      // ignore
    }
    return { error: errorMessage };
  }

  const data = await response.json();
  return {
    id: data.id,
    records: (data.records ?? []).map((r: { type: string; name: string; value: string; status: string }) => ({
      type: r.type,
      name: r.name,
      value: r.value,
      status: r.status,
    })),
  };
}

export async function findResendDomainByName(
  apiKey: string,
  domain: string
): Promise<{ id: string; verified: boolean } | null> {
  const response = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  const domains = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data?.domains)
      ? data.domains
      : [];

  const match = (domains as ResendDomainRecord[]).find((item) => item.name === domain);
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    verified: match.status === 'verified',
  };
}

/**
 * Trigger domain verification check with Resend.
 */
export async function verifyResendDomain(
  apiKey: string,
  domainId: string
): Promise<{ verified: boolean; error?: string }> {
  const response = await fetch(`https://api.resend.com/domains/${domainId}/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    return { verified: false, error: `Verification request failed (${response.status})` };
  }

  // After triggering verify, check status
  const status = await getResendDomainStatus(apiKey, domainId);
  return { verified: status?.verified ?? false };
}
