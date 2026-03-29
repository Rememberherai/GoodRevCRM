import { getPublicAppUrl } from '@/lib/url/get-public-url';

// WebAuthn utility constants and helpers

export const WEBAUTHN_RP_NAME = 'GoodRev CRM';

function getDefaultAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

function getHostname(appUrl: string): string {
  try {
    return new URL(appUrl).hostname;
  } catch {
    return 'localhost';
  }
}

export function getWebAuthnConfig(request?: Request): { appUrl: string; origin: string; rpID: string } {
  const appUrl = request ? getPublicAppUrl(request) : getDefaultAppUrl();

  return {
    appUrl,
    origin: appUrl,
    rpID: getHostname(appUrl),
  };
}

/** Returns the relying party ID (hostname without port) */
export function getRpId(request?: Request): string {
  return getWebAuthnConfig(request).rpID;
}

/** Returns the expected origin for WebAuthn assertions */
export function getOrigin(request?: Request): string {
  return getWebAuthnConfig(request).origin;
}

/** Check if WebAuthn is supported in the current browser */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined'
  );
}
