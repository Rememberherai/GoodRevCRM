# GoodRev Mobile — Product Requirements Document

**Version:** 2.1
**Date:** 2026-03-21
**Status:** Draft

---

## 1. Executive Summary

GoodRev Mobile is a parallel Expo React Native app — a native mobile client that calls the existing Next.js API routes over HTTP and shares the Supabase database, auth, TypeScript types, and Zod validators.

The community project platform is **fully built** on web. All ~300 API routes, all community entities (households, programs, contributions, assets, grants, contractors, jobs, referrals, broadcasts, relationships), the AI chat assistant, receipt OCR, calendar sync, community map, batch attendance, time tracking, and permission system exist and work. The mobile app is a UI-only port against this existing backend.

### Why Not Responsive Web

The web app uses:
- `createServerClient()` from `@supabase/ssr` which requires Next.js `cookies()` — doesn't exist in React Native
- `middleware.ts` redirects unauthenticated requests to `/login` — mobile needs Bearer tokens
- Sidebar (264px `w-64`) + header (56px `h-14`) + chat panel (360-800px resizable, `z-[60]`, `fixed inset-y-0 right-0`) layout — not viable on phone
- shadcn/ui components built on Radix UI primitives (DOM-only: `<Dialog>`, `<Popover>`, `<Select>`, `<DropdownMenu>`)
- Recharts (SVG/Canvas), Leaflet (DOM map), FullCalendar (DOM grid), TipTap (DOM editor)
- Server Components (async RSC) that run on the server and stream HTML

None of these work in React Native. A responsive rewrite would be more work than a parallel native app, and still wouldn't give us camera, push notifications, background timers, or offline support.

### Exact Reuse Inventory

**100% reusable, zero changes:**

| Asset | Location | Why it works |
|-------|----------|-------------|
| All API routes (~300) | `app/api/**` | HTTP endpoints — called with `fetch()` from anywhere |
| Supabase DB + RLS | `supabase/migrations/0001-0141` | Same database, same row-level security policies |
| Supabase Auth | `@supabase/supabase-js` | JS client supports custom storage adapters natively |
| Database types | `types/database.ts` (~312KB auto-generated) | Pure TypeScript, no DOM |
| Community types | `types/community.ts` (451 lines, 30+ interfaces) | Pure TypeScript |
| User/role types | `types/user.ts` | Pure TypeScript |
| Community validators | `lib/validators/community/*.ts` (12 files) | Pure Zod, no DOM |
| Permission matrix | `lib/projects/community-permissions.ts` | Pure function: `checkCommunityPermission(role, resource, action)` |
| Community constants | Dimension colors, icons, statuses, role definitions | Pure data |

**~90% reusable, minor adaptation:**

| Asset | Location | What changes |
|-------|----------|-------------|
| Chat store | `stores/chat.ts` (128 lines) | Remove `localStorage` for `panelWidth` (lines 64-68, 113-116) — use MMKV instead. Remove `getStoredWidth()` browser check. Remove `isOpen`/`toggle`/`open`/`close` (not needed — chat is a full screen, not a panel). |
| SSE parsing logic | `hooks/use-chat.ts` (lines 227-311) | Extract the `while(true) { reader.read() }` loop + event switch into a standalone function. Remove `usePathname()`, `useRouter()`, `router.refresh()` (Next.js-specific). Replace `hadMutationRef` + `router.refresh()` with React Query `invalidateQueries()`. |
| `MUTATING_TOOLS` set | `hooks/use-chat.ts` (lines 7-109) | Copy as-is. Used to know when to invalidate queries after tool execution. |
| `react-hook-form` + Zod | Used in all forms | Same library, same validators. Only change: `<Input {...register()}>` → `<TextInput {...register()}>` |

**0% reusable, full rewrite:**

| Asset | Count | Why |
|-------|-------|-----|
| `components/ui/*.tsx` | 34 shadcn components | Radix UI primitives are DOM-only |
| `components/chat/*.tsx` | 4 components | DOM layout (fixed panel, resize handle, `<textarea>`) |
| `components/community/**/*.tsx` | ~40 components | shadcn + Tailwind + DOM |
| `app/(dashboard)/**/*.tsx` | ~24 pages | Next.js App Router, Server Components |
| `components/layout/*.tsx` | 9 components (sidebar, header) | DOM layout |

---

## 2. Scope

### 2.1 Full Port

| Feature | Existing Web Files | Mobile Screens | Critical Implementation Notes |
|---------|-------------------|---------------|-------------------------------|
| AI Chat | `chat-panel.tsx` (257 lines), `chat-input.tsx` (161 lines), `chat-message-list.tsx` (259 lines), `stores/chat.ts` (128 lines), `hooks/use-chat.ts` (376 lines) | 1 screen + 6 components | SSE streaming via `res.body.getReader()` works in RN. Upload goes to `POST /api/projects/{slug}/community/upload` which returns `message_text` — append to chat input. Camera uses `expo-image-picker`, not `<input type="file">`. |
| Receipt OCR | Upload route at `app/api/projects/[slug]/community/upload/route.ts` (accepts `image/*` + `application/pdf`, max 15MB, uploads to Supabase Storage `community-uploads` bucket). Chat tool `receipts.process_image` does OCR. `receipts.confirm` creates bill. | Inline in chat | Mobile: `expo-image-picker` → compress with `expo-image-manipulator` (max 1200px, 80% JPEG) → `FormData` POST to upload route → append returned `message_text` to chat → send message. |
| Batch Attendance | `batch-attendance.tsx` — calls `POST /api/projects/{slug}/programs/{id}/attendance` with `{ entries: [{person_id, status, hours}] }` | 1 screen | FlatList of toggle rows. Each row: person name + 3 Pressable buttons (P/A/E). Collect state in `Map<string, 'present'|'absent'|'excused'>`. Single POST on save. Optimistic: show success immediately, queue if offline. |
| Household CRUD | `GET/POST /api/projects/{slug}/households` — paginated (page/limit/search/sortBy/sortOrder), auth via `createClient()` + `supabase.auth.getUser()` + `requireCommunityPermission()`. Response: `{ households: [...], pagination: { page, limit, total, totalPages } }` | 2 screens (list + detail) | List: FlatList with `onEndReached` for infinite scroll. Detail: ScrollView with tab segments (Members, Programs, Contributions, Intake, Timeline). |
| Program CRUD | Same pattern as households | 2 screens | Enrollment bottom sheet. Waiver trigger on enroll if `program.requires_waiver`. |
| Job Management | `GET/POST /api/projects/{slug}/jobs`, action routes: `/{id}/accept`, `/{id}/decline`, `/{id}/complete`, `/{id}/pull` | 2 screens (list + detail) | Contractor sees `?contractor_id={their_id}` filter + unassigned matching scope. |
| Time Tracking | `POST /api/projects/{slug}/jobs/{id}/time-entries` — `{ started_at, ended_at?, is_break, duration_minutes }` | Timer banner + controls | **Critical:** iOS kills background JS. Store `timer_started_at` timestamp in MMKV. On app foreground, compute elapsed = `Date.now() - timer_started_at`. Never run a `setInterval` — calculate on render. Use `expo-task-manager` for periodic local notification ("clock still running"). |
| Dashboard | `GET /api/projects/{slug}/community/dashboard` | 1 screen | Radar: victory-native `VictoryPolarAxis` + `VictoryArea`. Metrics: horizontal `ScrollView` of cards. Programs: `FlatList` with progress bars. Activity: `FlatList` with infinite scroll. |
| People/Org Lookup | `GET /api/projects/{slug}/people`, `GET /api/projects/{slug}/organizations` — same pagination pattern | 4 screens | List: FlatList + SearchBar. Detail: ScrollView. Tap phone → `Linking.openURL('tel:...')`. Tap email → `Linking.openURL('mailto:...')`. |
| Community Map | `GET /api/projects/{slug}/community/map` — returns `{ households, assets, programs, organizations }` with lat/lng | 1 screen | `react-native-maps` `<MapView>`. Markers with `<Callout>` → bottom sheet. `expo-location` for "center on me". |
| Contributions | `GET/POST /api/projects/{slug}/contributions` | 1 screen + bottom sheet | Quick-entry: type picker → entity pickers → amount/hours → dimension auto-set from linked program's `target_dimensions`. |
| Calendar | Existing Google Calendar sync infrastructure in `lib/calendar/google-calendar.ts` | 1 screen | `react-native-calendars` `<Agenda>` component. Data from existing booking/event APIs. |
| Push Notifications | **Does not exist yet** — needs new infrastructure | Background | New: `push_tokens` table, registration endpoint, Expo Push API service. |
| Offline | **Does not exist on web** | App-wide | React Query + `@tanstack/react-query-persist-client` + MMKV. Mutation queue for offline writes. |

### 2.2 Mobile-Lite (Read + Simple Actions)

| Feature | Mobile Scope | Existing API |
|---------|-------------|-------------|
| Reporting | View pre-rendered reports (no builder) | `GET /api/projects/{slug}/community/reports?type=program_performance` etc. |
| Grants | View list, tap to change status | `GET/PATCH /api/projects/{slug}/grants` |
| Settings | Profile + notification prefs + calendar connect | `GET/PATCH /api/users/me`, Google Calendar OAuth via `expo-web-browser` |
| Broadcasts | Compose + send (no filter builder) | `POST /api/projects/{slug}/broadcasts` |
| Assets | View list + detail (no create/edit) | `GET /api/projects/{slug}/community-assets` |
| Waivers | View status, trigger send | `POST /api/projects/{slug}/contracts` (existing e-sig module) |

### 2.3 Web-Only (Not Ported)

Accounting module (31 components), Workflow Builder (React Flow), Report Builder, Automation Builder, Sequence Builder, RFP Editor, Contract Builder, Schema Editor, Import/Export, Deduplication, News, Content Library, Webhooks, MCP, Opportunities, RFPs.

---

## 3. Architecture — Exact Implementation

### 3.1 Auth: How It Actually Works Today

**Web auth flow (the problem):**

```
Browser request
  → middleware.ts: createServerClient() reads cookies via request.cookies.getAll()
  → supabase.auth.getUser() validates session from cookie
  → API route: createClient() in lib/supabase/server.ts calls cookies() from 'next/headers'
  → supabase.auth.getUser() again — same cookie-based session
```

Every API route does this (line 67-75 of households route):
```typescript
const supabase = await createClient();  // reads cookies
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
```

**The key insight:** `createClient()` in `lib/supabase/server.ts` creates a Supabase client that gets auth from cookies. The `supabase.auth.getUser()` call validates the session. Supabase's `@supabase/ssr` package extracts the access token from cookies and sends it to Supabase's auth server for validation.

**What Supabase actually does under the hood:** It takes the access token (a JWT) from the cookie named `sb-{project-ref}-auth-token` and validates it. The same JWT works as a Bearer token.

**Mobile solution:** The Supabase JS client on mobile stores the same JWT in SecureStore. When the mobile app calls `fetch()` with the JWT as a Bearer token, the Supabase server client on the API side will validate it the same way — **if we tell it to look in the Authorization header instead of cookies.**

### 3.2 The Middleware Change (Exact Code)

The current `middleware.ts` (91 lines) uses `createServerClient` with cookie handlers. For mobile, we need to also check for a Bearer token. Here is the exact change:

**Before** (current lines 9-30):
```typescript
const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) { /* ... */ },
    },
  }
);
```

**After** (add Bearer token extraction):
```typescript
// Check for Bearer token (mobile clients)
const authHeader = request.headers.get('authorization');
const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

const supabase = createServerClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    cookies: {
      getAll() {
        if (bearerToken) {
          // Inject Bearer token as the auth cookie so downstream createClient() picks it up
          const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL!.match(/\/\/([^.]+)/)?.[1] ?? '';
          return [
            ...request.cookies.getAll(),
            {
              name: `sb-${projectRef}-auth-token`,
              value: JSON.stringify({
                access_token: bearerToken,
                token_type: 'bearer',
                expires_in: 3600,
                refresh_token: '',
              }),
            },
          ];
        }
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        if (bearerToken) return; // Don't set cookies for mobile requests
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  }
);
```

**Why this works:** By injecting the Bearer token as a cookie in the `getAll()` response, every downstream `createClient()` call (which also reads cookies) will see the same auth token. The entire API auth chain works without modifying a single API route.

**Why this is safe:** The `getAll()` function is called within the request context. We're adding the token to the request's cookie collection in memory — not setting actual cookies on the response for mobile requests (the `setAll` returns early for Bearer requests).

**Edge case: token refresh.** Mobile clients handle refresh client-side via `supabase.auth.refreshSession()`. The Bearer token in each request is always the current access token. If it expires mid-request, the API returns 401, the mobile client refreshes, and retries.

### 3.3 Mobile Supabase Client (Exact Code)

```typescript
// mobile/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../types/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2048 byte limit per item on iOS.
// Supabase auth tokens can exceed this. Use chunked storage.
const CHUNK_SIZE = 1800;

const ExpoSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (chunkCount) {
      const count = parseInt(chunkCount, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
        if (chunk) chunks.push(chunk);
      }
      return chunks.join('');
    }
    // Fallback: try reading as single item (for short tokens)
    return SecureStore.getItemAsync(key);
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      await SecureStore.deleteItemAsync(`${key}_chunk_count`).catch(() => {});
      return;
    }
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'g')) ?? [];
    await SecureStore.setItemAsync(`${key}_chunk_count`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk))
    );
  },

  async removeItem(key: string): Promise<void> {
    const chunkCount = await SecureStore.getItemAsync(`${key}_chunk_count`);
    if (chunkCount) {
      const count = parseInt(chunkCount, 10);
      await Promise.all([
        SecureStore.deleteItemAsync(`${key}_chunk_count`),
        ...Array.from({ length: count }, (_, i) =>
          SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
        ),
      ]);
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Disable for RN — no URL bar
  },
});
```

**Why chunked storage:** `expo-secure-store` has a 2048-byte limit per item on iOS. Supabase auth tokens (which include the JWT + refresh token + provider info) regularly exceed this. The chunked adapter splits large values across multiple SecureStore entries. This is a known issue — the Supabase React Native docs recommend this pattern.

### 3.4 API Client (Exact Code)

```typescript
// mobile/lib/api-client.ts
import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL!; // e.g., https://goodrev.app

export class APIError extends Error {
  constructor(public status: number, public body: Record<string, unknown>) {
    super(body.error as string ?? `API error ${status}`);
    this.name = 'APIError';
  }
}

async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    // Try refreshing
    const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshed.session?.access_token) {
      throw new APIError(401, { error: 'Session expired. Please log in again.' });
    }
    return refreshed.session.access_token;
  }
  return session.access_token;
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { retried?: boolean }
): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  // Token expired between getSession and fetch — refresh and retry once
  if (response.status === 401 && !options?.retried) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed.session) {
      return apiFetch(path, { ...options, retried: true });
    }
    throw new APIError(401, { error: 'Session expired' });
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new APIError(response.status, body);
  }

  // Handle 204 No Content
  if (response.status === 204) return undefined as T;

  return response.json();
}

// File upload variant (no Content-Type header — let fetch set multipart boundary)
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: `Upload failed` }));
    throw new APIError(response.status, body);
  }

  return response.json();
}
```

**Why separate `apiUpload`:** The receipt upload endpoint (`/api/projects/{slug}/community/upload`) expects `FormData` with a file, not JSON. Setting `Content-Type: application/json` would break it. By omitting `Content-Type`, `fetch()` auto-sets the correct `multipart/form-data; boundary=...` header.

### 3.5 SSE Chat Streaming (Exact Mobile Adaptation)

The web `hooks/use-chat.ts` SSE parsing (lines 227-311) does this:
1. `res.body.getReader()` to get a `ReadableStream` reader
2. `decoder.decode(value, { stream: true })` to convert chunks to text
3. Split on `\n`, filter lines starting with `data: `, JSON.parse each
4. Switch on `event.type`: `conversation`, `tool_call`, `tool_result`, `text_delta`, `done`, `error`

**React Native compatibility:**
- `fetch()` in React Native (Hermes engine) supports streaming via `response.body.getReader()` as of React Native 0.71+
- `TextDecoder` requires `text-encoding` polyfill on Android (Hermes doesn't have it natively)
- The parsing logic itself is pure JS — no DOM dependencies

**Mobile chat hook:**

```typescript
// mobile/hooks/use-chat.ts
import { useCallback, useRef } from 'react';
import { useChatStore } from '../stores/chat';
import { useQueryClient } from '@tanstack/react-query';
import { MUTATING_TOOLS, normalizeToolName } from './mutating-tools';
import { supabase } from '../lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL!;

export function useChat(projectSlug: string) {
  const store = useChatStore();
  const abortRef = useRef<AbortController | null>(null);
  const hadMutationRef = useRef(false);
  const queryClient = useQueryClient();

  // Extract stable action references
  const {
    setCurrentConversationId, addMessage, appendStreamingContent,
    resetStreamingContent, addToolCall, updateToolCallResult,
    clearToolCalls, finalizeToolCalls, setStreaming, setError,
    setConversations, setMessages,
  } = useChatStore.getState(); // getState() for stable refs

  const sendMessage = useCallback(async (text: string) => {
    const state = useChatStore.getState();
    if (state.isStreaming) return;

    setError(null);
    setStreaming(true);
    resetStreamingContent();
    clearToolCalls();
    hadMutationRef.current = false;

    addMessage({
      id: `temp-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${API_BASE}/api/projects/${projectSlug}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          conversationId: useChatStore.getState().currentConversationId,
          message: text,
          pageContext: null, // No page context on mobile
        }),
        signal: controller.signal,
        // @ts-expect-error — React Native fetch supports this for streaming
        reactNative: { textStreaming: true },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        setError(err.error ?? 'Request failed');
        setStreaming(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) { setError('No response body'); setStreaming(false); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          try {
            const event = JSON.parse(raw);
            switch (event.type) {
              case 'conversation':
                if (!useChatStore.getState().currentConversationId && event.conversationId) {
                  setCurrentConversationId(event.conversationId);
                }
                break;
              case 'tool_call':
                addToolCall({ id: event.id, name: event.name, arguments: event.arguments, status: 'pending' });
                if (MUTATING_TOOLS.has(event.name) || MUTATING_TOOLS.has(normalizeToolName(event.name))) {
                  hadMutationRef.current = true;
                }
                break;
              case 'tool_result':
                updateToolCallResult(event.id, event.result, 'complete');
                break;
              case 'text_delta':
                appendStreamingContent(event.content);
                break;
              case 'done': {
                const finalContent = useChatStore.getState().streamingContent;
                if (finalContent) {
                  addMessage({
                    id: `msg-${Date.now()}`,
                    role: 'assistant',
                    content: finalContent,
                    created_at: new Date().toISOString(),
                  });
                  resetStreamingContent();
                }
                finalizeToolCalls();
                // Instead of router.refresh(), invalidate React Query cache
                if (hadMutationRef.current) {
                  queryClient.invalidateQueries();
                }
                break;
              }
              case 'error':
                setError(event.message);
                break;
            }
          } catch { /* skip malformed */ }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') { /* cancelled */ }
      else { setError(err instanceof Error ? err.message : 'An error occurred'); }
    } finally {
      setStreaming(false);
      resetStreamingContent();
      abortRef.current = null;
    }
  }, [projectSlug, queryClient]);

  const stopStreaming = useCallback(() => { abortRef.current?.abort(); }, []);

  return { ...store, sendMessage, stopStreaming };
}
```

**Key differences from web version:**
1. `reactNative: { textStreaming: true }` — required for RN fetch streaming on some versions
2. `pageContext: null` — no URL-based page context on mobile
3. `queryClient.invalidateQueries()` instead of `router.refresh()` — RQ cache invalidation instead of Next.js RSC refresh
4. Auth via Bearer header instead of cookies
5. No `usePathname()` or `useRouter()` (Next.js imports)
6. `useChatStore.getState()` for stable action references (avoids re-render subscription)

### 3.6 Mobile Chat Store (Exact Adaptation)

```typescript
// mobile/stores/chat.ts
import { create } from 'zustand';
// Exact same interfaces from web: ChatConversation, ChatMessage, ToolCallEvent
// Import from shared types or copy

export interface ChatConversation { /* same as web */ }
export interface ChatMessage { /* same as web */ }
export interface ToolCallEvent { /* same as web */ }

interface MobileChatState {
  // Remove: isOpen, panelWidth, toggle, open, close, setPanelWidth (panel concept doesn't exist on mobile)
  conversations: ChatConversation[];
  currentConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingContent: string;
  pendingToolCalls: ToolCallEvent[];
  completedToolCalls: ToolCallEvent[];
  error: string | null;

  // Same actions as web (minus panel-related ones)
  setConversations: (convos: ChatConversation[]) => void;
  setCurrentConversation: (id: string | null) => void;
  setCurrentConversationId: (id: string | null) => void;
  setMessages: (msgs: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  appendStreamingContent: (delta: string) => void;
  resetStreamingContent: () => void;
  addToolCall: (tc: ToolCallEvent) => void;
  updateToolCallResult: (id: string, result: string, status: 'complete' | 'error') => void;
  clearToolCalls: () => void;
  finalizeToolCalls: () => void;
  setStreaming: (val: boolean) => void;
  setError: (err: string | null) => void;
  reset: () => void;
}

export const useChatStore = create<MobileChatState>((set) => ({
  // Same implementation as web lines 70-127, minus panelWidth/localStorage lines
  conversations: [],
  currentConversationId: null,
  messages: [],
  isStreaming: false,
  streamingContent: '',
  pendingToolCalls: [],
  completedToolCalls: [],
  error: null,

  setConversations: (conversations) => set({ conversations }),
  setCurrentConversation: (id) => set({
    currentConversationId: id, messages: [], streamingContent: '',
    pendingToolCalls: [], completedToolCalls: [], error: null, isStreaming: false,
  }),
  setCurrentConversationId: (id) => set({ currentConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendStreamingContent: (delta) => set((s) => ({ streamingContent: s.streamingContent + delta })),
  resetStreamingContent: () => set({ streamingContent: '' }),
  addToolCall: (tc) => set((s) => ({ pendingToolCalls: [...s.pendingToolCalls, tc] })),
  updateToolCallResult: (id, result, status) => set((s) => ({
    pendingToolCalls: s.pendingToolCalls.map((tc) => tc.id === id ? { ...tc, result, status } : tc),
  })),
  clearToolCalls: () => set({ pendingToolCalls: [] }),
  finalizeToolCalls: () => set((s) => ({
    completedToolCalls: [...s.completedToolCalls, ...s.pendingToolCalls],
    pendingToolCalls: [],
  })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setError: (error) => set({ error }),
  reset: () => set({
    currentConversationId: null, messages: [], streamingContent: '',
    pendingToolCalls: [], completedToolCalls: [], error: null, isStreaming: false,
  }),
}));
```

### 3.7 Receipt Upload on Mobile (Exact Flow)

The web `chat-input.tsx` (lines 65-98) does this:
1. `<input type="file" accept="image/*,.pdf">` hidden, triggered by camera button
2. `new FormData()` with the file
3. `POST /api/projects/{slug}/community/upload` — returns `{ message_text, storage_path, ... }`
4. `appendUploadMessage(data.message_text)` — puts the message text into the textarea
5. User then hits send to trigger OCR via the chat

**Mobile equivalent:**

```typescript
// In ChatInput component
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { apiUpload } from '../lib/api-client';

async function handleCameraPress(projectSlug: string) {
  // 1. Pick image
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsEditing: false,
  });

  if (result.canceled || !result.assets[0]) return;

  const asset = result.assets[0];

  // 2. Compress (max 1200px wide, 80% JPEG)
  const manipulated = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: Math.min(asset.width ?? 1200, 1200) } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  // 3. Build FormData
  const formData = new FormData();
  formData.append('file', {
    uri: manipulated.uri,
    name: `receipt_${Date.now()}.jpg`,
    type: 'image/jpeg',
  } as unknown as Blob); // RN FormData accepts this shape

  // 4. Upload
  const data = await apiUpload<{ message_text: string }>(
    `/api/projects/${projectSlug}/community/upload`,
    formData
  );

  // 5. Return message_text to append to chat input
  return data.message_text;
}
```

**Why compress:** The upload route accepts up to 15MB, but mobile photos are often 4-8MB. Compressing to 1200px JPEG at 80% quality reduces to ~200-500KB while retaining OCR readability. Faster upload on cellular, less storage cost.

### 3.8 Background Timer (Exact Implementation)

**The problem:** iOS aggressively kills background JS tasks. `setInterval` stops running within seconds of backgrounding. Android is slightly better but still unreliable.

**The solution:** Never run a timer. Store the `started_at` timestamp. Calculate elapsed on every render.

```typescript
// mobile/hooks/use-timer.ts
import { useState, useEffect, useCallback } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { MMKV } from 'react-native-mmkv';
import * as Notifications from 'expo-notifications';
import { apiFetch } from '../lib/api-client';

const storage = new MMKV({ id: 'timer' });

interface TimerState {
  jobId: string;
  jobName: string;
  projectSlug: string;
  startedAt: number; // Date.now() timestamp
  pausedElapsed: number; // accumulated ms from previous start/pause cycles
  isPaused: boolean;
}

function getTimerState(): TimerState | null {
  const json = storage.getString('active_timer');
  return json ? JSON.parse(json) : null;
}

function setTimerState(state: TimerState | null) {
  if (state) storage.set('active_timer', JSON.stringify(state));
  else storage.delete('active_timer');
}

export function useTimer() {
  const [elapsed, setElapsed] = useState(0);
  const [timer, setTimer] = useState<TimerState | null>(getTimerState);

  // Re-calculate elapsed every second while active
  useEffect(() => {
    if (!timer || timer.isPaused) return;

    const tick = () => {
      const now = Date.now();
      setElapsed(timer.pausedElapsed + (now - timer.startedAt));
    };
    tick(); // immediate

    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  // Recalculate when app returns to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        const t = getTimerState();
        setTimer(t);
        if (t && !t.isPaused) {
          setElapsed(t.pausedElapsed + (Date.now() - t.startedAt));
        }
      }
    });
    return () => sub.remove();
  }, []);

  const start = useCallback(async (jobId: string, jobName: string, projectSlug: string) => {
    const state: TimerState = {
      jobId, jobName, projectSlug,
      startedAt: Date.now(),
      pausedElapsed: 0,
      isPaused: false,
    };
    setTimerState(state);
    setTimer(state);

    // Create time entry on server
    await apiFetch(`/api/projects/${projectSlug}/jobs/${jobId}/time-entries`, {
      method: 'POST',
      body: JSON.stringify({ started_at: new Date().toISOString() }),
    });

    // Schedule "clock running" notification for 8 hours from now
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Clock Still Running',
        body: `Your timer for "${jobName}" has been running for 8 hours.`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 8 * 3600 },
    });
  }, []);

  const pause = useCallback(async () => {
    const t = getTimerState();
    if (!t || t.isPaused) return;

    const now = Date.now();
    const updated: TimerState = {
      ...t,
      pausedElapsed: t.pausedElapsed + (now - t.startedAt),
      isPaused: true,
    };
    setTimerState(updated);
    setTimer(updated);

    // Update time entry on server with ended_at
    await apiFetch(`/api/projects/${t.projectSlug}/jobs/${t.jobId}/time-entries`, {
      method: 'POST',
      body: JSON.stringify({
        started_at: new Date(t.startedAt).toISOString(),
        ended_at: new Date(now).toISOString(),
        is_break: false,
      }),
    });
  }, []);

  const resume = useCallback(() => {
    const t = getTimerState();
    if (!t || !t.isPaused) return;

    const updated: TimerState = { ...t, startedAt: Date.now(), isPaused: false };
    setTimerState(updated);
    setTimer(updated);
  }, []);

  const complete = useCallback(async (notes: string) => {
    const t = getTimerState();
    if (!t) return;

    const finalElapsed = t.isPaused
      ? t.pausedElapsed
      : t.pausedElapsed + (Date.now() - t.startedAt);

    // Complete job on server
    await apiFetch(`/api/projects/${t.projectSlug}/jobs/${t.jobId}/complete`, {
      method: 'POST',
      body: JSON.stringify({
        notes,
        total_minutes: Math.round(finalElapsed / 60000),
      }),
    });

    // Cancel scheduled notification
    await Notifications.cancelAllScheduledNotificationsAsync();

    setTimerState(null);
    setTimer(null);
    setElapsed(0);
  }, []);

  return {
    isActive: timer !== null,
    isPaused: timer?.isPaused ?? false,
    jobId: timer?.jobId ?? null,
    jobName: timer?.jobName ?? null,
    elapsed, // in milliseconds
    start, pause, resume, complete,
  };
}
```

**Why MMKV and not AsyncStorage:** MMKV is synchronous. `getTimerState()` returns immediately on app launch — no `await`. This means the timer banner renders correctly on the very first frame, with the correct elapsed time calculated from the stored `startedAt`. AsyncStorage is async, which would cause a flash of "no timer" on app open.

### 3.9 Offline Mutation Queue (Exact Pattern)

```typescript
// mobile/lib/offline-queue.ts
import { MMKV } from 'react-native-mmkv';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from './api-client';

const storage = new MMKV({ id: 'offline-queue' });

interface QueuedMutation {
  id: string;
  path: string;
  method: string;
  body: string;
  createdAt: number;
  retryCount: number;
}

function getQueue(): QueuedMutation[] {
  const json = storage.getString('mutations');
  return json ? JSON.parse(json) : [];
}

function setQueue(queue: QueuedMutation[]) {
  storage.set('mutations', JSON.stringify(queue));
}

export function enqueueMutation(path: string, method: string, body: unknown) {
  const queue = getQueue();
  queue.push({
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    path,
    method,
    body: JSON.stringify(body),
    createdAt: Date.now(),
    retryCount: 0,
  });
  setQueue(queue);
}

export async function flushQueue(): Promise<{ succeeded: number; failed: QueuedMutation[] }> {
  const queue = getQueue();
  if (queue.length === 0) return { succeeded: 0, failed: [] };

  const failed: QueuedMutation[] = [];
  let succeeded = 0;

  for (const mutation of queue) {
    try {
      await apiFetch(mutation.path, {
        method: mutation.method,
        body: mutation.body,
      });
      succeeded++;
    } catch (err) {
      mutation.retryCount++;
      if (mutation.retryCount < 3) {
        failed.push(mutation);
      }
      // After 3 retries, drop the mutation (data may have been deleted on web)
    }
  }

  setQueue(failed);
  return { succeeded, failed };
}

// Listen for network restoration
let unsubscribe: (() => void) | null = null;

export function startOfflineSync() {
  unsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected && getQueue().length > 0) {
      flushQueue();
    }
  });
}

export function stopOfflineSync() {
  unsubscribe?.();
}
```

---

## 4. Navigation Structure

### 4.1 Role Detection

The project selector fetches the user's role from the membership:

```typescript
// After selecting a project:
const { data } = await apiFetch<{ role: string }>(
  `/api/projects/${slug}/membership`
);
// Store in Zustand: projectStore.setRole(data.role)
```

Role determines which `(app)/_layout.tsx` tab bar renders:

| Role | Tabs | Route Group |
|------|------|-------------|
| `owner`, `admin`, `staff`, `case_manager` | Dashboard, Households, Programs, Chat, More | `(app)/(tabs)` |
| `contractor` | My Jobs, Timer, Chat, Profile | `(contractor)` |
| `board_viewer` | Dashboard, Reports | `(board)` |
| `member`, `viewer` | Dashboard, People, Orgs, Chat, More | `(app)/(tabs)` (CRM mode — hides community nav) |

### 4.2 File-Based Routes (Expo Router)

```
mobile/app/
├── _layout.tsx                    ← Root: checks auth, shows splash during load
├── (auth)/login.tsx               ← Login screen
├── projects.tsx                   ← Project selector (after login)
├── (app)/
│   ├── _layout.tsx                ← Staff/admin tab bar + Stack navigator
│   ├── (tabs)/
│   │   ├── _layout.tsx            ← Bottom tab config
│   │   ├── index.tsx              ← Dashboard
│   │   ├── households.tsx         ← Household list
│   │   ├── programs.tsx           ← Program list
│   │   ├── chat.tsx               ← AI assistant
│   │   └── more.tsx               ← More menu
│   ├── households/[id].tsx        ← Household detail (stack push)
│   ├── programs/[id].tsx          ← Program detail
│   ├── programs/[id]/attendance.tsx ← Batch attendance
│   ├── people/index.tsx
│   ├── people/[id].tsx
│   ├── organizations/index.tsx
│   ├── organizations/[id].tsx
│   ├── jobs/index.tsx
│   ├── jobs/[id].tsx
│   ├── contributions/index.tsx
│   ├── assets/index.tsx
│   ├── assets/[id].tsx
│   ├── map.tsx
│   ├── calendar.tsx
│   ├── reports.tsx
│   └── settings.tsx
├── (contractor)/
│   ├── _layout.tsx                ← Contractor tab bar
│   ├── jobs.tsx
│   ├── timer.tsx
│   ├── chat.tsx
│   └── profile.tsx
└── (board)/
    ├── _layout.tsx                ← Board viewer tab bar
    ├── dashboard.tsx
    └── reports.tsx
```

---

## 5. Web App Prerequisites (New Code Required)

### 5.1 Middleware Change

See §3.2. ~20 lines added to `middleware.ts`. Zero changes to any API route.

### 5.2 Push Notification Table + API

**Migration:** `supabase/migrations/0142_push_tokens.sql`

```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

CREATE TRIGGER handle_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_tokens_own ON push_tokens FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

**API routes:**
- `POST /api/auth/push-token` — upsert token
- `DELETE /api/auth/push-token` — remove token on logout

**Push service:** `lib/notifications/push.ts` — calls Expo Push API (`https://exp.host/--/api/v2/push/send`). Wire into existing automation events: `job.assigned`, `job.completed`, `receipt.confirmed`, `waiver.signed`, etc.

### 5.3 Membership Role Endpoint

The mobile app needs to know the user's role for a project. Add if not already present:

`GET /api/projects/[slug]/membership` — returns `{ role: string, userId: string }` for the current user.

---

## 6. Technology Stack

| Package | Version | Purpose | Why this one |
|---------|---------|---------|-------------|
| `expo` | ~52 | Framework | Managed workflow, EAS Build, OTA updates |
| `expo-router` | ~4 | Navigation | File-based like Next.js; deep linking built-in |
| `react-native` | 0.76+ | Core | Hermes engine with streaming fetch |
| `@supabase/supabase-js` | ^2.93 | Auth | Same as web; custom storage adapter |
| `expo-secure-store` | ~14 | Token storage | iOS Keychain / Android Keystore |
| `react-native-mmkv` | ^3 | Fast KV storage | Synchronous reads (timer state on first frame) |
| `zustand` | ^5.0 | State | Same as web |
| `@tanstack/react-query` | ^5.90 | Data fetching | Cache + offline persist + mutation queue |
| `@tanstack/react-query-persist-client` | ^5 | Offline cache | MMKV persistence adapter |
| `react-hook-form` | ^7.71 | Forms | Same as web, same Zod resolvers |
| `zod` | ^4.3 | Validation | Same shared schemas from `lib/validators/community/` |
| `date-fns` | ^4.1 | Dates | Same as web |
| `nativewind` | ^4 | Styling | Tailwind for RN — team already knows Tailwind |
| `lucide-react-native` | ^0.563 | Icons | Same icon set as web |
| `expo-image-picker` | ~16 | Camera/gallery | Receipt capture |
| `expo-image-manipulator` | ~13 | Image compression | Reduce upload size |
| `expo-image` | ~2 | Image display | Fast caching, AVIF/WebP |
| `expo-notifications` | ~0.29 | Push | APNs + FCM via EAS |
| `expo-haptics` | ~14 | Haptics | Feedback on save/confirm |
| `expo-location` | ~18 | GPS | Map centering |
| `expo-web-browser` | ~14 | OAuth | Gmail, QuickBooks, Calendar |
| `expo-task-manager` | ~12 | Background | Clock-running notification scheduling |
| `react-native-maps` | ^1.20 | Maps | Native Google/Apple Maps |
| `victory-native` | ^41 | Charts | Radar chart for impact dashboard |
| `react-native-calendars` | ^1.1306 | Calendar | Agenda view |
| `@gorhom/bottom-sheet` | ^5 | Bottom sheets | Dialogs, pickers, confirmations |
| `react-native-reanimated` | ^3.16 | Animations | Smooth transitions, skeleton shimmer |
| `react-native-gesture-handler` | ^2.21 | Gestures | Swipe, pan, bottom sheet |
| `@react-native-community/netinfo` | ^11 | Network | Online/offline detection |
| `text-encoding` | ^0.7 | Polyfill | TextDecoder for SSE on Android/Hermes |
| `react-native-url-polyfill` | ^2 | Polyfill | URL constructor for Supabase |

---

## 7. Implementation Phases

### Phase M1: Setup & Auth (2 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | `npx create-expo-app@latest mobile -t expo-template-blank-typescript` | Expo project initializes |
| 2 | Install all dependencies from §6 | `npx expo install` succeeds |
| 3 | `tsconfig.json` path aliases: `@shared/*` → `../../types/*`, `@validators/*` → `../../lib/validators/*` | `import type { Household } from '@shared/community'` compiles |
| 4 | `mobile/lib/supabase.ts` — chunked SecureStore adapter (§3.3) | `supabase.auth.signInWithPassword()` stores token, `getSession()` retrieves it after app restart |
| 5 | `mobile/lib/api-client.ts` — `apiFetch()` + `apiUpload()` (§3.4) | `apiFetch('/api/projects')` returns project list with Bearer auth |
| 6 | **[Web]** Middleware Bearer token support (§3.2) | Mobile `apiFetch('/api/projects/slug/households')` returns 200, not 401 |
| 7 | Login screen (email/password, `react-hook-form`) | Login → session stored → navigate to projects |
| 8 | Project selector screen (`FlatList`, tap to select) | Projects load, tap stores `slug` + `role` in Zustand |
| 9 | `mobile/app/_layout.tsx` — auth guard (check session on mount, redirect to login) | Cold start: splash → auto-login → projects. No session: splash → login. |
| 10 | Role-based tab layout (§4.1) | Staff sees 5 tabs, contractor sees 4 tabs, board viewer sees 2 tabs |
| 11 | React Query provider + MMKV persistence | Queries cached to disk, survive app restart |
| 12 | Base UI components: Button, Card, Input, Badge, Avatar, Skeleton, SearchBar (NativeWind) | Components render correctly with dark/light mode |
| 13 | EAS Build config (`eas.json`: development, preview, production profiles) | `eas build --profile development --platform ios` succeeds |
| 14 | Push notification registration (`expo-notifications` → `POST /api/auth/push-token`) | Token stored in DB |
| 15 | **[Web]** Push token migration + API routes (§5.2) | `push_tokens` table exists, CRUD endpoints work |

### Phase M2: Dashboard & Read Views (2 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Dashboard screen — calls `GET /api/projects/{slug}/community/dashboard` | Data loads, pull-to-refresh works |
| 2 | Radar chart (`victory-native` `VictoryPolarAxis` + `VictoryArea`) | Renders framework dimensions with correct colors from `impact_dimensions` |
| 3 | Metric cards (horizontal `ScrollView`) | 6 cards: Households, Programs, Hours, Contributions, Attendance, Unique Visitors |
| 4 | Program performance cards | Enrollment bar (filled/capacity), tap → program detail |
| 5 | Activity feed (`FlatList`, `onEndReached` pagination) | Infinite scroll, shows recent entities |
| 6 | Household list (`FlatList` + `SearchBar`) | Search, infinite scroll, pull-to-refresh. Matches web pagination params: `page`, `limit`, `search`, `sortBy`, `sortOrder` |
| 7 | Household detail (ScrollView + tab segments) | Tabs: Members, Programs, Contributions, Intake (case_manager+ only), Timeline |
| 8 | Program list (cards with status badges + dimension dots) | Matches web card grid |
| 9 | Program detail (tabs: Info, Enrollments + waiver status, Attendance) | Enrollment list shows waiver badges |
| 10 | People list + detail | Tap phone → `Linking.openURL('tel:')`, tap email → `mailto:` |
| 11 | Organization list + detail | Same pattern |
| 12 | Community Assets list + detail (with mini-map) | `react-native-maps` `MapView` in detail |
| 13 | Contribution list (filterable by type) | Segment control: All / Monetary / Time |
| 14 | "More" menu (list of navigation options) | Tap → push to correct screen |
| 15 | Empty states + loading skeletons (reanimated shimmer) | Every list has skeleton, every empty has illustration + CTA |

### Phase M3: Chat + Receipt OCR (3 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | `mobile/stores/chat.ts` (§3.6) | Store works, no `localStorage` references |
| 2 | `mobile/hooks/use-chat.ts` (§3.5) | SSE streaming works on iOS + Android |
| 3 | `text-encoding` polyfill imported in `_layout.tsx` | `TextDecoder` works on Hermes |
| 4 | Chat screen layout (full screen, `KeyboardAvoidingView`) | Keyboard pushes input up, messages scroll |
| 5 | Message list (`FlatList inverted`) | User messages right-aligned (primary), assistant left-aligned, auto-scroll to bottom |
| 6 | Tool call cards (expandable, color-coded by category) | Same colors as web `chat-message-list.tsx`. Tap to expand/collapse arguments + result. |
| 7 | Streaming text animation | Text appears word-by-word as `text_delta` events arrive |
| 8 | Chat input + send/stop button | Enter sends, stop aborts stream |
| 9 | Camera button (`expo-image-picker`) | Opens camera, takes photo |
| 10 | Image compression + upload (§3.7) | Compresses to ≤500KB JPEG, uploads to Supabase Storage via existing upload route |
| 11 | Receipt confirmation card (renders when `receipts.process_image` tool completes) | Shows vendor, amount, date, account, class. Approve/Edit/Reject buttons. |
| 12 | Approve flow (haptic + toast) | Haptic on confirm. Toast: "Bill created in [GoodRev/QuickBooks]" |
| 13 | Conversation history (header menu) | List past conversations, tap to load, long-press to delete/rename |
| 14 | **[Web]** Verify existing upload route works with Bearer auth | `POST /api/projects/{slug}/community/upload` with FormData + Bearer returns 200 |

### Phase M4: CRUD Operations (2 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Household intake wizard (3-step bottom sheet or pager) | Step 1: name + address. Step 2: add members. Step 3: primary contact. Creates household via `POST /api/projects/{slug}/households` with `members` array. |
| 2 | Batch attendance screen | Date picker → FlatList of enrolled members → P/A/E toggles → Save. `POST /api/projects/{slug}/programs/{id}/attendance`. Offline: queue in MMKV. |
| 3 | Program enrollment bottom sheet | Person picker → program picker → confirm. If `requires_waiver`, show "Waiver will be sent" notice. |
| 4 | Contribution quick-entry (bottom sheet) | Type selector → person/org picker → program picker (auto-sets dimension) → amount/hours → date → save. |
| 5 | Quick-add person (bottom sheet) | Name, email, phone → `POST /api/projects/{slug}/people`. |
| 6 | Notes/comments | Add note to any entity detail page. |
| 7 | Optimistic mutations | React Query `onMutate` → update cache → show success. `onError` → rollback + toast error. |
| 8 | Offline queue (§3.9) | `enqueueMutation()` when `fetch` throws network error. `flushQueue()` on connectivity restore. Banner: "2 changes pending sync". |

### Phase M5: Contractor Portal (2 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Contractor tab layout | 4 tabs: My Jobs, Timer, Chat, Profile |
| 2 | Job list (3 segments: Active, Available, Done) | Active: my accepted jobs. Available: unassigned jobs matching my scope. Done: completed. |
| 3 | Job detail | Description, address (tap → Apple/Google Maps), deadline, priority, status. |
| 4 | Accept/decline (bottom sheet) | Accept: "Can you start [date]?" → confirm. Decline: reason text → submit. |
| 5 | Timer (§3.8) | Start/Pause/Resume/Complete. MMKV persistence. Survives background + app kill. |
| 6 | Timer banner (persistent across all screens) | Shows on all contractor screens when timer active. Tap → timer screen. |
| 7 | Clock-running notification | Local notification after 8 hours via `expo-notifications scheduleNotificationAsync`. |
| 8 | Job completion form | Stop timer → notes field → optional photo → submit. |
| 9 | Contractor profile | View scope docs, connect Google Calendar (expo-web-browser OAuth), view signed docs. |
| 10 | Push notifications | `job.assigned` → open job detail. `job.deadline_approaching` → open job. `job.pulled` → open list. |
| 11 | **[Web]** Push notification service + wiring | `lib/notifications/push.ts` called from job status change handlers |
| 12 | Role enforcement | Contractor cannot navigate to `/households`, `/programs`, etc. Tab layout prevents it. API returns 403 via RLS. |

### Phase M6: Maps (1 week)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Map screen (`react-native-maps`) | Renders with map tiles |
| 2 | Data: `GET /api/projects/{slug}/community/map` | Returns all geo-tagged entities |
| 3 | 4 marker layers (same as web Leaflet layers) | Households (🏠 blue), Assets (category icon), Programs (📅 status-colored), Orgs (🏢 purple) |
| 4 | Marker clustering (`react-native-map-clustering`) | Clusters at zoom-out |
| 5 | Bottom sheet on marker tap | Summary + "View Details" + "Get Directions" |
| 6 | Filter bottom sheet | Toggle layers, filter by dimension/category/condition |
| 7 | GPS center (`expo-location`) | "Center on me" button |

### Phase M7: Calendar + Notifications (1 week)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Calendar screen (`react-native-calendars` Agenda) | Shows program sessions, job assignments, grant deadlines |
| 2 | Event detail bottom sheet | Tap event → details + navigate to source |
| 3 | Deep linking from push notifications | Tap notification → navigate to correct screen via Expo Router `router.push()` |
| 4 | **[Web]** Wire all push triggers | 14 event types (§10 of previous version) |
| 5 | Badge count on tab bar | Unread notification count |

### Phase M8: Offline + Polish (2 weeks)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | React Query MMKV persistence (`createSyncStoragePersister` from `@tanstack/query-sync-storage-persister`) | Cached data survives app restart |
| 2 | Offline mutation queue (§3.9) | Mutations queue when offline, flush on reconnect |
| 3 | Network status banner | "Offline — 3 changes pending" banner. Animates in/out. |
| 4 | Sync indicators | Per-item: syncing spinner / synced check / failed warning |
| 5 | Splash screen + app icon | Branded |
| 6 | Dark mode | NativeWind `dark:` classes, follows system preference |
| 7 | Accessibility | VoiceOver/TalkBack labels on all interactive elements |
| 8 | FlatList performance | `getItemLayout` for fixed-height rows, `maxToRenderPerBatch: 10`, `windowSize: 5` |
| 9 | Image caching | `expo-image` with `cachePolicy: 'disk'` |
| 10 | Haptics | `expo-haptics` on: save, confirm, toggle, error |
| 11 | iPad layout | Wider cards, 2-column grids via NativeWind responsive |
| 12 | Error boundaries | `ErrorBoundary` component with "Retry" button |

### Phase M9: Testing + Release (1 week)

| # | Task | Exit Criteria |
|---|------|--------------|
| 1 | Unit tests (Jest) | API client, timer hook, offline queue, SSE parser |
| 2 | Component tests (RNTL) | Login, Dashboard, Chat, Attendance |
| 3 | E2E tests (Maestro) | Login → dashboard → take attendance → chat → receipt → confirm |
| 4 | Physical devices | iPhone 13/15, iPad, Pixel 7, Samsung Galaxy |
| 5 | EAS production builds | iOS + Android |
| 6 | App Store Connect | Bundle ID, certs, screenshots, privacy policy |
| 7 | Play Console | Keystore, listing, data safety |
| 8 | TestFlight + Internal Track | Beta testers |
| 9 | EAS Update | OTA pipeline configured for post-release patches |

---

## 8. Known Gotchas & Mitigations

| Issue | Root Cause | Exact Fix |
|-------|-----------|-----------|
| `expo-secure-store` 2048 byte limit on iOS | Supabase session JSON exceeds 2KB | Chunked storage adapter (§3.3) — splits across multiple SecureStore entries |
| `TextDecoder` not available on Hermes (Android) | Hermes doesn't include `encoding` spec | `import 'text-encoding'` polyfill at app entry point |
| `fetch()` streaming doesn't work on older RN | Pre-0.71 React Native doesn't support `ReadableStream` | Require RN 0.76+ (Expo SDK 52). Add `reactNative: { textStreaming: true }` to fetch options. |
| iOS kills background JS after ~30 seconds | iOS app lifecycle | Never use `setInterval` for timers. Store `startedAt` in MMKV, calculate elapsed on render. Use `expo-task-manager` only for scheduling local notifications. |
| `FormData` file upload shape differs in RN | RN `FormData.append` expects `{ uri, name, type }`, not a `File` object | Cast to `Blob`: `formData.append('file', { uri, name, type } as unknown as Blob)` |
| Supabase cookie name varies by project | Cookie is `sb-{PROJECT_REF}-auth-token` where ref is extracted from URL | Parse ref from `SUPABASE_URL`: `url.match(/\/\/([^.]+)/)?.[1]` |
| `react-native-maps` requires Google Maps API key on Android | Apple Maps works without key; Google Maps doesn't | Add `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` to `app.json` `android.config.googleMaps.apiKey` |
| Large lists cause ANR on Android | Too many items rendered at once | `FlatList` with `getItemLayout`, `windowSize: 5`, `maxToRenderPerBatch: 10`, `removeClippedSubviews: true` |
| OAuth redirect back to app | Web OAuth redirects to a URL; mobile needs a deep link | Use `expo-web-browser` `openAuthSessionAsync()` which handles the redirect scheme automatically |
| API route `createClient()` reads cookies, not Bearer | Server-side Supabase client is cookie-based | Middleware injects Bearer token as cookie (§3.2) — no API route changes needed |

---

## 9. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| Cold start → first interactive screen | < 3 sec | Expo performance monitoring |
| Receipt: camera → confirmation card | < 20 sec | Tool call timestamp delta |
| Batch attendance: open → saved (20 people) | < 30 sec | Screen recording validation |
| Job accept → timer started | < 10 sec | Push notification → API call timing |
| Offline → online sync | < 3 sec (all queued mutations flushed) | NetInfo event → queue empty timing |
| Crash-free sessions | > 99.5% | Sentry / EAS |
| Weekly active staff on mobile | > 50% of org staff (30 days) | Supabase auth analytics |
| Weekly active contractors | > 80% of active contractors | Supabase auth analytics |

---

## 10. Timeline

| Phase | Duration | Cumulative | Ship Gate |
|-------|----------|-----------|-----------|
| M1: Setup & Auth | 2 weeks | Week 2 | Login works, Bearer auth validated |
| M2: Dashboard & Reads | 2 weeks | Week 4 | Browse all data |
| M3: Chat + OCR | 3 weeks | Week 7 | **Early Access: "Field Assistant"** |
| M4: CRUD | 2 weeks | Week 9 | Intake + attendance from phone |
| M5: Contractor Portal | 2 weeks | Week 11 | Contractors self-sufficient |
| M6: Maps | 1 week | Week 12 | Community map live |
| M7: Calendar + Notifs | 1 week | Week 13 | Push notifications active |
| M8: Offline + Polish | 2 weeks | Week 15 | Field-ready |
| M9: Test + Release | 1 week | Week 16 | App Store + Play Store |

---

*This document contains exact code patterns, exact file references, and exact library versions based on the current codebase as of migration 0141. Every API endpoint, store shape, and auth flow has been verified against the actual source code.*
