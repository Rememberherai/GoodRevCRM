import { getProjectSecrets, setProjectSecret } from '@/lib/secrets';

const QUICKBOOKS_OAUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QUICKBOOKS_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

type QuickBooksEnvironment = 'sandbox' | 'production';

function getQuickBooksEnvironment(): QuickBooksEnvironment {
  return process.env.QUICKBOOKS_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
}

function getQuickBooksApiBaseUrl() {
  return getQuickBooksEnvironment() === 'production'
    ? 'https://quickbooks.api.intuit.com'
    : 'https://sandbox-quickbooks.api.intuit.com';
}

function getQuickBooksOAuthConfig() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('QuickBooks OAuth is not configured');
  }

  return { clientId, clientSecret };
}

function getRedirectUri(requestOrigin: string) {
  return `${requestOrigin}/api/integrations/quickbooks/callback`;
}

export function buildQuickBooksConnectUrl(params: {
  requestOrigin: string;
  state: string;
}) {
  const { clientId } = getQuickBooksOAuthConfig();
  const query = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: getRedirectUri(params.requestOrigin),
    state: params.state,
  });

  return `${QUICKBOOKS_OAUTH_URL}?${query.toString()}`;
}

export async function exchangeQuickBooksCode(params: {
  code: string;
  realmId: string;
  requestOrigin: string;
}) {
  const { clientId, clientSecret } = getQuickBooksOAuthConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      redirect_uri: getRedirectUri(params.requestOrigin),
    }),
  });

  if (!response.ok) {
    throw new Error(`QuickBooks token exchange failed (${response.status})`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    realmId: params.realmId,
  };
}

async function refreshQuickBooksAccessToken(projectId: string, refreshToken: string) {
  const { clientId, clientSecret } = getQuickBooksOAuthConfig();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(QUICKBOOKS_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`QuickBooks token refresh failed (${response.status})`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
  await Promise.all([
    setProjectSecret(projectId, 'quickbooks_access_token', data.access_token, null),
    setProjectSecret(projectId, 'quickbooks_refresh_token', data.refresh_token, null),
    setProjectSecret(projectId, 'quickbooks_token_expires_at', expiresAt, null),
  ]);

  return data.access_token;
}

async function getQuickBooksAccessToken(projectId: string) {
  const secrets = await getProjectSecrets(projectId, [
    'quickbooks_access_token',
    'quickbooks_refresh_token',
    'quickbooks_realm_id',
    'quickbooks_token_expires_at',
  ]);

  const realmId = secrets.quickbooks_realm_id;
  const accessToken = secrets.quickbooks_access_token;
  const refreshToken = secrets.quickbooks_refresh_token;
  const expiresAt = secrets.quickbooks_token_expires_at;

  if (!realmId || !accessToken || !refreshToken || !expiresAt) {
    throw new Error('QuickBooks is not connected for this project');
  }

  if (new Date(expiresAt).getTime() > Date.now() + 30_000) {
    return { accessToken, realmId };
  }

  const nextToken = await refreshQuickBooksAccessToken(projectId, refreshToken);
  return { accessToken: nextToken, realmId };
}

async function quickBooksFetch(projectId: string, path: string, init?: RequestInit) {
  const { accessToken, realmId } = await getQuickBooksAccessToken(projectId);
  const url = `${getQuickBooksApiBaseUrl()}/v3/company/${realmId}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`QuickBooks API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function ensureVendor(projectId: string, vendorName: string) {
  const safeVendor = vendorName.replace(/'/g, "''");
  const query = encodeURIComponent(`select * from Vendor where DisplayName = '${safeVendor}'`);
  const existing = await quickBooksFetch(projectId, `/query?query=${query}&minorversion=70`);
  const existingVendor = existing?.QueryResponse?.Vendor?.[0];
  if (existingVendor?.Id) {
    return existingVendor.Id as string;
  }

  const created = await quickBooksFetch(projectId, '/vendor?minorversion=70', {
    method: 'POST',
    body: JSON.stringify({
      DisplayName: vendorName,
    }),
  });

  return created?.Vendor?.Id as string;
}

async function resolveAccount(projectId: string, accountCode: string | null | undefined) {
  if (!accountCode) return null;
  const safeCode = accountCode.replace(/'/g, "''");
  const query = encodeURIComponent(`select * from Account where AcctNum = '${safeCode}'`);
  const existing = await quickBooksFetch(projectId, `/query?query=${query}&minorversion=70`);
  const account = existing?.QueryResponse?.Account?.[0];
  return account?.Id ? String(account.Id) : null;
}

export async function createQBBill(params: {
  projectId: string;
  vendor: string;
  amount: number;
  receiptDate: string;
  description: string | null;
  accountCode?: string | null;
  className?: string | null;
  imageUrl?: string | null;
}) {
  const vendorId = await ensureVendor(params.projectId, params.vendor);
  const accountId = await resolveAccount(params.projectId, params.accountCode);

  const body = {
    VendorRef: { value: vendorId },
    TxnDate: params.receiptDate,
    PrivateNote: params.description ?? undefined,
    Line: [
      {
        DetailType: 'AccountBasedExpenseLineDetail',
        Amount: params.amount,
        Description: params.description ?? params.vendor,
        AccountBasedExpenseLineDetail: {
          ...(accountId ? { AccountRef: { value: accountId } } : {}),
          ...(params.className ? { ClassRef: { name: params.className } } : {}),
        },
      },
    ],
  };

  const result = await quickBooksFetch(params.projectId, '/bill?minorversion=70', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return {
    id: String(result?.Bill?.Id ?? ''),
    raw: result,
  };
}
