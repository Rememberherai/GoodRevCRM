# Passkey Sign-In — Product Requirements Document

**Version:** 1.0
**Date:** 2026-03-23
**Status:** Draft

---

## 1. Executive Summary

Add passwordless passkey sign-in as a primary authentication method. Users can sign in with just a passkey (Touch ID, Face ID, Windows Hello, hardware security key) — no Google OAuth required. Google OAuth remains as an alternative sign-in method.

Supabase does not support first-factor WebAuthn natively. This feature builds a custom WebAuthn layer using the `@simplewebauthn` libraries, stores credentials in a custom table, and mints valid Supabase sessions server-side after passkey verification.

### Why Passkeys

- **Phishing-resistant**: Passkeys are bound to the origin — they cannot be used on a fake site
- **No passwords to leak**: Public-key cryptography; the private key never leaves the device
- **Faster sign-in**: One biometric prompt vs. the Google OAuth redirect flow
- **Cross-device sync**: Modern passkeys (e.g., iCloud Keychain, Google Password Manager) sync across devices automatically
- **Chrome focus**: Chrome has had full WebAuthn/passkey support since version 67

---

## 2. User Flows

### 2.1 Passkey Registration (requires existing session)

A user must first sign in via Google OAuth, then register a passkey for future use.

1. User navigates to Settings > Security
2. Clicks "Register Passkey"
3. Browser prompts for biometric/PIN (Touch ID, Face ID, etc.)
4. Credential is stored server-side
5. User can optionally give it a friendly name (e.g., "MacBook Touch ID")
6. Passkey appears in a list with name, created date, and last-used date
7. User can delete passkeys from this list

### 2.2 Passkey Sign-In (no session required)

1. User arrives at `/login`
2. Clicks "Sign in with Passkey" (shown only if browser supports WebAuthn)
3. Browser shows available passkeys for this site (discoverable credential flow)
4. User selects a passkey and authenticates via biometric/PIN
5. Server verifies the credential, mints a Supabase session
6. User is redirected to `/projects` with a fully valid session (RLS works identically to Google OAuth sessions)

### 2.3 Existing Google OAuth Flow (unchanged)

The current "Continue with Google" button remains and works exactly as before. Both sign-in methods coexist on the login page.

---

## 3. Technical Architecture

### 3.1 Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@simplewebauthn/server` | ^11 | Server-side WebAuthn ceremony (challenge generation, response verification) |
| `@simplewebauthn/browser` | ^11 | Client-side `navigator.credentials` wrapper with browser compat |
| `jose` | latest | JWT signing to mint Supabase-compatible access tokens |

### 3.2 Environment Variables

| Variable | Dev Value | Prod Value | Purpose |
|----------|-----------|------------|---------|
| `SUPABASE_JWT_SECRET` | From Supabase dashboard | Same | Signs JWTs that Supabase accepts |
| `WEBAUTHN_RP_ID` | `localhost` | bare domain (e.g., `goodrevcrm.com`) | WebAuthn Relying Party ID |
| `WEBAUTHN_RP_NAME` | `GoodRev CRM` | `GoodRev CRM` | Display name in browser prompts |
| `WEBAUTHN_ORIGIN` | `http://localhost:3000` | `https://goodrevcrm.com` | Origin validation during ceremonies |

### 3.3 Database Schema

**New migration**: `supabase/migrations/0143_webauthn_credentials.sql`

#### `webauthn_credentials` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `TEXT` PK | Base64url credential ID |
| `user_id` | `UUID` FK → `auth.users(id)` | Owner of the credential |
| `public_key` | `BYTEA` | COSE public key (not sensitive) |
| `counter` | `BIGINT` | Signature counter for clone detection |
| `device_type` | `TEXT` | `'singleDevice'` or `'multiDevice'` |
| `backed_up` | `BOOLEAN` | Whether credential is synced (e.g., iCloud Keychain) |
| `transports` | `TEXT[]` | e.g., `{'internal','hybrid'}` |
| `friendly_name` | `TEXT` | User-assigned label |
| `created_at` | `TIMESTAMPTZ` | Auto |
| `last_used_at` | `TIMESTAMPTZ` | Updated on each sign-in |
| `updated_at` | `TIMESTAMPTZ` | Via `handle_updated_at()` trigger |

RLS: Users can SELECT and DELETE own credentials. INSERT/UPDATE via service role only (API routes).

#### `webauthn_challenges` table

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PK | Auto-generated |
| `challenge` | `TEXT` | Random challenge string |
| `user_id` | `UUID` nullable | NULL for login challenges (user unknown) |
| `type` | `TEXT` | `'registration'` or `'authentication'` |
| `expires_at` | `TIMESTAMPTZ` | Default NOW() + 5 minutes |
| `created_at` | `TIMESTAMPTZ` | Auto |

Includes a cleanup function `cleanup_expired_webauthn_challenges()` callable by cron.

### 3.4 API Routes

All under `app/api/auth/passkey/`.

#### Registration endpoints (require active session)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/passkey/register/options` | GET | Generate registration options; stores challenge in DB |
| `/api/auth/passkey/register/verify` | POST | Verify registration response; stores credential in DB |

- Uses `generateRegistrationOptions()` with `residentKey: 'required'` for discoverable credentials
- Excludes already-registered credentials via `excludeCredentials`
- All writes via service role client

#### Login endpoints (no session required)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/auth/passkey/login/options` | POST | Generate authentication options with empty `allowCredentials` (discoverable) |
| `/api/auth/passkey/login/verify` | POST | Verify response, mint Supabase session, set cookies |

#### Session minting strategy (the hard part)

After passkey verification succeeds in `/login/verify`:

1. Look up the credential's `user_id` in the DB
2. Call `supabase.auth.admin.generateLink({ type: 'magiclink', email })` to get a `hashed_token`
3. Exchange the token via GoTrue `POST /auth/v1/verify` to get `{ access_token, refresh_token }`
4. Call `supabase.auth.setSession()` with the tokens to set standard Supabase auth cookies
5. Return success — the session is now indistinguishable from a Google OAuth session

This approach produces a real Supabase session with a refresh token, so the standard middleware, RLS policies, and token refresh all work identically.

### 3.5 Client-Side Components

#### Login page changes (`app/(auth)/login/page.tsx`)

- Add "Sign in with Passkey" button with Lucide `Fingerprint` icon
- Conditionally rendered via `browserSupportsWebAuthn()` from `@simplewebauthn/browser`
- Placed above the Google button with an "or" divider
- Flow: fetch options → `startAuthentication()` → send to verify → `window.location.href` redirect

#### Passkey manager component (`components/settings/passkey-manager.tsx`)

- Self-contained component for the settings page
- Lists registered passkeys with friendly_name, created_at, last_used_at
- "Register new passkey" button triggers enrollment flow
- Delete button per passkey (via Supabase client, RLS allows DELETE on own)
- Flow for registration: fetch options → `startRegistration()` → send to verify

#### Settings page changes

- Add passkey manager to Account settings or a new Security section

---

## 4. Security Considerations

| Concern | Mitigation |
|---------|------------|
| Challenge replay | Challenges expire after 5 minutes; deleted after use |
| Credential cloning | Counter validation — reject if returned counter ≤ stored counter |
| Phishing | WebAuthn binds credentials to the RP ID (domain); `@simplewebauthn/server` validates origin |
| CSRF | JSON POST endpoints; WebAuthn ceremony includes origin checking |
| Rate limiting | Limit concurrent challenges per IP via the challenges table |
| Service role key | Only used server-side in API routes; never exposed to browser |
| Public key storage | Not sensitive — public-key crypto; private key never leaves device |
| Session validity | Minted session goes through standard Supabase middleware (`getUser()`); all RLS works |

---

## 5. Files Summary

### New files
- `supabase/migrations/0143_webauthn_credentials.sql` — DB schema
- `lib/webauthn/config.ts` — RP config from env vars
- `app/api/auth/passkey/register/options/route.ts` — Registration challenge
- `app/api/auth/passkey/register/verify/route.ts` — Registration verification
- `app/api/auth/passkey/login/options/route.ts` — Login challenge
- `app/api/auth/passkey/login/verify/route.ts` — Login verification + session minting
- `components/settings/passkey-manager.tsx` — Passkey management UI

### Modified files
- `app/(auth)/login/page.tsx` — Add passkey login button
- Settings page — Add passkey manager section
- `hooks/use-auth.ts` — Optional `signInWithPasskey()` method
- `.env.local` — New env vars

---

## 6. Implementation Sequence

1. Install npm dependencies
2. Add environment variables
3. Create and push database migration; regenerate TypeScript types; run typecheck
4. Create `lib/webauthn/config.ts`
5. Create the 4 API routes (register options → register verify → login options → login verify)
6. Create `components/settings/passkey-manager.tsx`
7. Modify settings page to add passkey management section
8. Modify login page to add passkey button
9. Test end-to-end

---

## 7. Verification Plan

1. Sign in via Google OAuth → go to Settings → register a passkey → confirm it appears in the list
2. Sign out completely
3. Click "Sign in with Passkey" → authenticate with registered passkey → confirm redirect to `/projects`
4. Verify data loads correctly (RLS working — session is valid)
5. Verify Google OAuth still works independently
6. Test in Chrome (primary target), verify graceful degradation (button hidden) in unsupported browsers
7. Register a second passkey, delete the first, verify sign-in works with the second
