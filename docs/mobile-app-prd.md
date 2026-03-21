# GoodRev Mobile — Product Requirements Document

**Version:** 2.0
**Date:** 2026-03-20
**Status:** Draft

---

## 1. Executive Summary

GoodRev Mobile is a **parallel Expo React Native app** that provides a native mobile experience for the GoodRev CRM platform. It is not a rewrite — it is a native client that calls the same Next.js API routes and shares the same Supabase database, auth system, TypeScript types, and Zod validators.

The mobile app targets field staff, contractors, and on-the-go managers who need to interact with CRM and Community Center data away from a desktop. It prioritizes the workflows that are painful on a phone browser but natural on a native app: camera-based receipt capture, GPS-aware maps, background time tracking, push notifications, and offline-capable field data entry.

### Why Native (Not Responsive Web)

The existing Next.js app uses Server Components, cookie-based auth, shadcn/ui (DOM-dependent), Recharts (canvas-based), Leaflet (DOM map), FullCalendar (DOM grid), TipTap (DOM editor), and a fixed sidebar (264px) + header (56px) + chat panel (360-800px resizable) layout. Making this responsive would require rewriting the layout system, replacing every chart/map/editor library, and still wouldn't give us camera, push notifications, background timers, offline support, or app store distribution. A parallel native client is less work and a better product.

### What's Reusable (Zero Rewrite)

| Layer | Reusable? | Notes |
|-------|-----------|-------|
| Supabase DB + RLS + migrations | 100% | Same database, same policies |
| All ~300 API routes | 100% | Called over HTTP from mobile (with Bearer token adapter) |
| Supabase Auth | 100% | JS client works natively in Expo with custom storage |
| TypeScript types (`types/database.ts`, `types/user.ts`, `types/community.ts`) | 100% | Direct import via path alias |
| Zod validators (`lib/validators/`) | 100% | Pure JS, no DOM dependency |
| Permission logic (`lib/projects/community-permissions.ts`) | 100% | Pure function, importable |
| Constants (roles, statuses, dimension colors/icons) | 100% | Pure data |
| `react-hook-form` form logic | 95% | Same library, different `<Input>` components |
| Zustand stores (`stores/`) | 90% | Works in RN; swap `localStorage` → `AsyncStorage` (~5 lines per store) |
| Chat streaming logic (`hooks/use-chat.ts` SSE parsing) | 85% | SSE/fetch works in RN; extract non-DOM logic |
| Business logic in `lib/` (accounting bridge, automation engine, etc.) | 0% | Server-side only — mobile calls API routes, doesn't run this |

### What Must Be Rebuilt (The Actual Work)

| Layer | Count | Why |
|-------|-------|-----|
| UI components (shadcn → native) | ~20 base + ~50 feature-specific | React Native has no DOM |
| Page layouts (Next.js → Expo Router) | ~25 screens | Different routing and layout primitives |
| Navigation (sidebar → tab bar) | 1 system | Mobile uses bottom tabs, not 264px sidebar |
| Charts (Recharts → victory-native) | ~8 chart types | Different rendering engine |
| Maps (Leaflet → react-native-maps) | 1 system | Web map → native map SDK |
| Calendar (FullCalendar → RN calendars) | 1 system | DOM grid → native component |
| Styling (Tailwind CSS → NativeWind) | All components | No raw CSS in RN (NativeWind is closest match) |

**Bottom line:** ~80% of the codebase (backend, types, validators, auth, API) is reused. ~20% (the view layer) is rebuilt. But that 20% is ~100% of the mobile engineering work.

---

## 2. Scope: What Gets Ported

### 2.1 Full Port (Native Mobile Experience)

These features are rebuilt with native UX patterns (bottom sheets, swipe gestures, haptics, camera, GPS).

| Feature | Web Source | Mobile UX | Why Mobile |
|---------|-----------|-----------|-----------|
| **AI Chat Assistant** | `components/chat/chat-panel.tsx` (257 lines, fixed right panel, resizable 360-800px, SSE streaming, tool call cards) | Full-screen chat with native keyboard, camera button, haptic on confirmations | Primary daily interaction; field staff live in chat |
| **Receipt OCR / AP** | Chat tool: `receipts.process_image` → `receipts.confirm` → accounting bridge | Native camera → upload → OCR → confirmation card (Approve/Edit/Reject) | Staff buying supplies in the field |
| **Job Management** | `app/(dashboard)/projects/[slug]/jobs/` (list + detail + time entries) | Job list with priority badges, accept/decline bottom sheet, service address → native maps | Contractors work from phones exclusively |
| **Time Tracking** | `components/community/jobs/time-tracker.tsx` (Start/Pause/Stop/Complete) | Persistent banner timer, background task manager, clock-running local notification | Must work on-site, app backgrounded |
| **Batch Attendance** | `components/community/programs/batch-attendance.tsx` (date picker → member grid → checkboxes → bulk save) | Tap grid (Present/Absent/Excused), optimistic save, works offline | Taken in classrooms at program time |
| **Household Intake** | `components/community/households/new-household-dialog.tsx` (multi-step wizard) | Multi-step wizard with address autocomplete, member quick-add, tablet-optimized | Walk-ins at front desk |
| **Program Enrollments** | Enrollment list in program detail, waiver status badges | Quick-enroll bottom sheet: select person → confirm → waiver auto-triggered | On-site enrollment at events |
| **Dashboard** | `community-dashboard.tsx` (Recharts radar, 6 metric cards, program cards, activity feed) | ScrollView with victory-native radar, metric cards, program bars, pull-to-refresh | Quick health check on the go |
| **People / Org Lookup** | `people-page-client.tsx` (table with search, sort, pagination, bulk actions, column picker, dispositions) | Searchable FlatList with contact cards, tap-to-call/email (no bulk actions, no column picker) | Field reference, quick lookup |
| **Community Map** | Leaflet/react-leaflet with 4 toggleable layers, marker clustering, filter sidebar | react-native-maps with native markers, bottom sheet popups, GPS "center on me" | On-site orientation, directions |
| **Contributions** | `donation-entry.tsx` + `time-log-entry.tsx` (two tab modes, dimension auto-inherit) | Quick-entry form: type selector → amount/hours → auto-tag dimension | Log volunteer hours on-site |
| **Calendar** | FullCalendar day/week/month grid | react-native-calendars day/week agenda view | Daily schedule check |
| **Push Notifications** | None (web has no push) | expo-notifications with deep linking | Job alerts, reminders, approvals |
| **Offline Mode** | None (web requires connection) | React Query persistence + MMKV, mutation queue | Field work with spotty connectivity |

### 2.2 Mobile-Lite (Read-Only or Simplified)

| Feature | Mobile Scope | What's Cut |
|---------|-------------|-----------|
| **Reporting** | View pre-rendered report cards | No report builder, no custom filters, no CSV export |
| **Grants** | View list, update status, view deadlines | No Kanban drag, no outreach, no AI writing |
| **Settings** | Profile, notification prefs, calendar connect | No schema editor, no accounting config, no framework editor |
| **Broadcasts** | Compose text → select audience → send | No custom filter builder |
| **Contracts / Waivers** | View status, trigger "send for signature" | No builder, no PDF editor |
| **Community Assets** | View list + detail with mini-map | No create/edit (use web) |

### 2.3 Web-Only (Not Ported)

| Feature | Why Web-Only |
|---------|-------------|
| **Accounting Module** (31 components) | Complex table-heavy reconciliation workflows |
| **Workflow Builder** (React Flow canvas) | Drag-and-drop visual programming |
| **Report Builder** (custom config) | Complex configuration, wide tables |
| **Automation Builder** | Power-user nested forms |
| **Sequence Builder** | Multi-step email composition |
| **RFP Response Editor** | Long-form document editing |
| **Contract Builder** | PDF generation, signature field placement |
| **Custom Fields Schema Editor** | Admin-only configuration |
| **Import/Export** | CSV file management |
| **Deduplication** | Side-by-side comparison needs wide screen |
| **News Monitoring** | Research tool, passive consumption |
| **Content Library** | File management |
| **Webhook / MCP Management** | Developer/admin tools |
| **Opportunities / RFPs** | Standard CRM; desktop workflow |

---

## 3. Architecture

### 3.1 System Diagram

```
┌──────────────────────────────┐
│       EXPO REACT NATIVE      │
│  ┌────────────────────────┐  │
│  │  Expo Router (Tabs)    │  │
│  │  ├─ Dashboard          │  │
│  │  ├─ Households         │  │
│  │  ├─ Programs           │  │
│  │  ├─ Chat (AI)          │  │
│  │  └─ More...            │  │
│  ├────────────────────────┤  │
│  │  Zustand Stores        │  │       ┌───────────────────────┐
│  │  (shared logic)        │──────────│  NEXT.JS API BACKEND  │
│  ├────────────────────────┤  │       │  ~300 REST endpoints  │
│  │  React Query + MMKV    │  │  HTTP │  ┌─────────────────┐  │
│  │  (cache + offline)     │──────────│  │ Supabase Client │  │
│  ├────────────────────────┤  │       │  │ (server-side)   │  │
│  │  Supabase JS Client    │  │       │  └────────┬────────┘  │
│  │  (direct auth only)    │  │       └───────────┼───────────┘
│  ├────────────────────────┤  │                   │
│  │  expo-secure-store     │  │                   ▼
│  │  expo-notifications    │  │       ┌───────────────────────┐
│  │  expo-camera           │  │       │    SUPABASE (shared)  │
│  │  react-native-maps     │  │       │  PostgreSQL + RLS     │
│  │  expo-task-manager     │  │       │  Auth (email/OAuth)   │
│  │  expo-haptics          │  │       │  Storage (receipts)   │
│  └────────────────────────┘  │       └───────────────────────┘
└──────────────────────────────┘
```

### 3.2 Data Flow

**Read:** Screen → React Query hook → `api.fetch()` (injects Bearer token) → `GET /api/projects/[slug]/entity` → Supabase query → JSON → React Query cache (MMKV) → render.

**Write:** Form → React Query mutation → optimistic cache update → `POST/PATCH /api/...` → on success: invalidate + refetch. On error: rollback.

**Offline:** Mutation fails → queued in MMKV → "Offline — changes will sync" banner → network restored → replayed in order → cache invalidated.

### 3.3 Auth Architecture

**Current web auth:** Cookie-based via `@supabase/ssr`. Middleware (`middleware.ts`) creates server client from cookies, validates with `supabase.auth.getUser()`. API routes create their own client via `createClient()` in `lib/supabase/server.ts`.

**Mobile auth:** Supabase JS client with `expo-secure-store` as custom storage adapter:

```typescript
// mobile/lib/supabase.ts
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      removeItem: (key) => SecureStore.deleteItemAsync(key),
    },
    autoRefreshToken: true,
    persistSession: true,
  },
});
```

**API calls** use `Authorization: Bearer <access_token>`. Requires a small additive change to `middleware.ts` (see §8.1).

**Login flow:**
1. App opens → check SecureStore for existing session
2. Valid → auto-login, navigate to project selector
3. Expired → Supabase auto-refreshes
4. No session → login screen (email/password)
5. Success → session stored in SecureStore automatically
6. Logout → `supabase.auth.signOut()` clears SecureStore

**OAuth (Gmail):** Opens `expo-web-browser`, completes OAuth, deep-links back.

### 3.4 Project Structure

**Flat `/mobile` directory** (not monorepo). Shared code via TypeScript path aliases. Migrate to monorepo later if needed.

```
GoodRevCRM/
├── mobile/                          ← NEW: Expo app
│   ├── app/                         ← Expo Router
│   │   ├── _layout.tsx              ← Root (auth guard)
│   │   ├── (auth)/login.tsx
│   │   ├── (app)/
│   │   │   ├── _layout.tsx          ← Role-based tab navigator
│   │   │   ├── (tabs)/
│   │   │   │   ├── index.tsx        ← Dashboard
│   │   │   │   ├── households.tsx
│   │   │   │   ├── programs.tsx
│   │   │   │   ├── chat.tsx
│   │   │   │   └── more.tsx
│   │   │   ├── households/[id].tsx
│   │   │   ├── programs/[id].tsx
│   │   │   ├── programs/[id]/attendance.tsx
│   │   │   ├── people/{index,[id]}.tsx
│   │   │   ├── organizations/{index,[id]}.tsx
│   │   │   ├── jobs/{index,[id]}.tsx
│   │   │   ├── contributions/index.tsx
│   │   │   ├── assets/{index,[id]}.tsx
│   │   │   ├── map.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── reports.tsx
│   │   │   └── settings.tsx
│   │   └── (contractor)/            ← Contractor-only layout
│   │       ├── _layout.tsx          ← Jobs/Timer/Chat/Profile tabs
│   │       ├── jobs.tsx
│   │       ├── timer.tsx
│   │       ├── chat.tsx
│   │       └── profile.tsx
│   ├── components/
│   │   ├── ui/                      ← ~20 base components
│   │   │   ├── Button.tsx, Card.tsx, Input.tsx, Badge.tsx
│   │   │   ├── Avatar.tsx, Skeleton.tsx, Tabs.tsx
│   │   │   ├── BottomSheet.tsx, SearchBar.tsx, etc.
│   │   ├── chat/                    ← 6 components
│   │   │   ├── ChatScreen.tsx, ChatInput.tsx
│   │   │   ├── ChatMessage.tsx, ToolCallCard.tsx
│   │   │   ├── ReceiptConfirmation.tsx, CameraCapture.tsx
│   │   ├── households/              ← 4 components
│   │   ├── programs/                ← 4 components
│   │   ├── jobs/                    ← 5 components
│   │   ├── dashboard/               ← 4 components
│   │   ├── contributions/           ← 2 components
│   │   ├── map/                     ← 4 components
│   │   └── common/                  ← 5 components
│   ├── lib/
│   │   ├── supabase.ts              ← SecureStore client
│   │   ├── api-client.ts            ← Typed HTTP + Bearer
│   │   ├── query-client.ts          ← React Query + MMKV
│   │   └── notifications.ts         ← Push registration + handlers
│   ├── hooks/                       ← ~10 hooks
│   │   ├── use-auth.ts, use-chat.ts, use-timer.ts
│   │   ├── use-households.ts, use-programs.ts, use-jobs.ts
│   │   ├── use-contributions.ts, use-network.ts, use-project.ts
│   ├── stores/                      ← 3 stores
│   │   ├── auth.ts, project.ts, chat.ts
│   ├── app.json, eas.json, package.json, tsconfig.json
├── app/                             ← EXISTING (unchanged)
├── components/                      ← EXISTING (unchanged)
├── lib/                             ← EXISTING (unchanged)
├── types/                           ← SHARED via path alias
├── supabase/                        ← SHARED migrations
└── package.json                     ← EXISTING (unchanged)
```

---

## 4. Screen Specifications

### 4.1 Navigation (Role-Based Tab Bars)

**Staff / Admin / Owner / Case Manager:**
```
[Dashboard] [Households] [Programs] [Chat] [More]
More → People, Orgs, Assets, Contributions, Jobs, Map, Calendar, Reports, Settings
```

**Contractor:**
```
[My Jobs] [Timer] [Chat] [Profile]
```

**Board Viewer:**
```
[Dashboard] [Reports]
```

### 4.2 Dashboard

**Web:** Recharts radar, 6 metric cards (4-col grid), program cards with enrollment bars, activity feed.

**Mobile:**
```
┌─────────────────────────┐
│ Dashboard         [⟳]   │  pull-to-refresh
├─────────────────────────┤
│  [  Radar Chart       ] │  victory-native polar
│  [Metric] [Metric] →   │  horizontal scroll
│  Programs ──────────    │
│  │ ESL Class    ████░ │ │  enrollment bars
│  │ Food Bank    ███░░ │ │
│  Recent Activity ───    │
│  │ ● New household    │ │  FlatList, infinite scroll
│  │ ● Attendance taken │ │
└─────────────────────────┘
```

### 4.3 Household List + Detail

**Web:** Table with search, sort, pagination, bulk actions, column picker, dispositions.
**Mobile:** Searchable FlatList → card layout. Detail has tabs: Members, Programs, Contributions, Intake (case_manager+), Timeline. [+] opens multi-step intake wizard.

### 4.4 Batch Attendance

**Web:** `batch-attendance.tsx` — date picker → enrolled member grid → checkboxes → bulk save.

**Mobile:**
```
┌─────────────────────────┐
│ ← ESL Class Attendance  │
│  Date: [  Mar 20, 2026 ]│
│  ┌─────────────────────┐│
│  │ Maria M.  [✓][✗][E] ││  tap toggles P/A/E
│  │ Carlos M. [✓][✗][E] ││  green/red/yellow
│  │ James W.  [✓][✗][E] ││
│  └─────────────────────┘│
│  [Mark All Present]     │
│  [    Save (18/25)    ] │  haptic on save
└─────────────────────────┘
```
Works offline — queued for sync.

### 4.5 AI Chat Assistant

**Web:** Fixed right panel (360-800px, z-60, resizable drag handle), `chat-input.tsx` (1-5 row textarea), message bubbles, color-coded expandable tool call cards, SSE streaming.

**Mobile:** Full-screen, no resize, native keyboard, camera button.
```
┌─────────────────────────┐
│ AI Assistant     [≡] [+]│
│  🤖 How can I help?     │
│        User message ──┐ │
│  Tool call card ──────┤ │
│  │ Receipt Confirmation │
│  │ Vendor: Home Depot  │ │
│  │ Amount: $47.23      │ │
│  │ [✓ OK] [✎] [✗]     │ │
├─────────────────────────┤
│ [Message...       ] 📷→ │  camera + send
└─────────────────────────┘
```

**Camera flow:** Tap 📷 → `expo-image-picker` → preview → compress → presigned URL upload to Supabase Storage → send URL in chat message → SSE stream → confirmation card → approve → bill created.

### 4.6 Job Management + Timer (Contractor)

**Web:** Job list, detail, `time-tracker.tsx` (Start/Pause/Stop/Complete).

**Mobile:**
```
┌─────────────────────────┐
│ My Jobs                 │
│ [Active][Available][Done]│
│ ⚡ Fence Repair • 1:23:45│  persistent timer banner
│ ┌───────────────────┐   │
│ │ 🔴 Roof Inspection │   │  priority badge
│ │ 123 Oak St • Mar 22│  │
│ │ [Accept] [Decline] │   │
│ ├───────────────────┤   │
│ │ 🟡 Fence Repair    │   │
│ │ ⏱ 1:23:45 [⏸][⏹]  │   │  inline timer
│ └───────────────────┘   │
└─────────────────────────┘
```

**Background timer:** `expo-task-manager` + MMKV state. Calculate elapsed from `started_at` timestamp (survives app kill). Local notification after X hours.

### 4.7 Community Map

**Web:** Leaflet/react-leaflet, 4 layers, clustering, filter sidebar.
**Mobile:** `react-native-maps`, bottom sheet popups, GPS "center on me", filter bottom sheet.

### 4.8 Contribution Entry

Quick-entry bottom sheet: type selector → person → program (dimension auto-inherited) → amount/hours → save.

---

## 5. Technology Stack

### Core

| Package | Purpose |
|---------|---------|
| `expo` ~52 | Framework (managed workflow) |
| `expo-router` ~4 | File-based navigation |
| `@supabase/supabase-js` ^2.93 | Auth + API (same as web) |
| `expo-secure-store` | Token storage |
| `zustand` ^5.0 | State management (same as web) |
| `@tanstack/react-query` ^5.90 | Data fetching + offline cache |
| `react-hook-form` ^7.71 | Forms (same as web) |
| `zod` ^4.3 | Validation (shared schemas) |
| `date-fns` ^4.1 | Date formatting (same as web) |
| `nativewind` ^4 | Tailwind for RN |
| `lucide-react-native` ^0.563 | Icons (same icon set) |

### Native Modules

| Package | Purpose |
|---------|---------|
| `expo-camera`, `expo-image-picker` | Receipt capture |
| `expo-image` | Fast cached images |
| `expo-notifications` | Push (APNs + FCM) |
| `expo-task-manager` | Background timer |
| `expo-haptics` | Haptic feedback |
| `expo-location` | GPS |
| `expo-file-system` | Local file cache |
| `expo-web-browser` | OAuth flows |
| `react-native-maps` | Native maps |
| `react-native-mmkv` | Fast KV storage |
| `victory-native` | Charts (radar, bar) |
| `react-native-calendars` | Calendar views |
| `react-native-reanimated` | Animations |
| `react-native-gesture-handler` | Gestures |
| `@gorhom/bottom-sheet` | Bottom sheets |

### Build

| Tool | Purpose |
|------|---------|
| `eas-cli` | Build + submit + OTA update |
| `expo-dev-client` | Custom dev builds |
| `maestro` | E2E tests |

---

## 6. Component Mapping: Web → Mobile

### Base UI (shadcn → Native)

| Web (shadcn/Radix) | Mobile | Notes |
|---------------------|--------|-------|
| `<Button>` (CVA) | Pressable + NativeWind | Same variant API |
| `<Card>` | View + NativeWind | Direct port |
| `<Input>` | TextInput wrapper | Focus ring, error state |
| `<Dialog>` | `@gorhom/bottom-sheet` | Dialogs → bottom sheets |
| `<Select>` | Bottom sheet picker | |
| `<Tabs>` | Segment control | |
| `<Badge>`, `<Avatar>`, `<Progress>` | Direct ports | |
| `<Table>` | FlatList + cards | Tables → card lists |
| `<Tooltip>`, `<Popover>` | Dropped or long-press | No hover on touch |
| `<DropdownMenu>` | Action sheet | Platform-native |

### Feature Components

| Web Component | Mobile | Effort |
|---------------|--------|--------|
| `chat-panel.tsx` (257 lines, resize handle) | Full-screen ChatScreen (no resize, + camera) | Medium |
| `chat-message-list.tsx` (259 lines, tool cards) | Inverted FlatList, same card logic | Medium |
| `batch-attendance.tsx` | FlatList toggle rows, haptic save | Medium |
| `new-household-dialog.tsx` | Multi-step screen wizard | Medium |
| `time-tracker.tsx` | TimerControls + TimerBanner + background task | High |
| `organization/person-combobox.tsx` | EntityPicker (bottom sheet + search FlatList) | Medium |
| Data tables (Table + pagination + bulk + columns) | FlatList + cards + infinite scroll | Medium |

---

## 7. API Client

### Typed HTTP Client

All mobile data flows through a typed client with Bearer token injection:

```typescript
class GoodRevAPI {
  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        ...options?.headers,
      },
    });
    if (response.status === 401) {
      await supabase.auth.refreshSession();
      return this.request(path, options); // retry once
    }
    if (!response.ok) throw new APIError(response.status, await response.json());
    return response.json();
  }

  households = {
    list: (slug, params?) => this.request(`/api/projects/${slug}/households?${qs(params)}`),
    get: (slug, id) => this.request(`/api/projects/${slug}/households/${id}`),
    create: (slug, data) => this.request(`...`, { method: 'POST', body: JSON.stringify(data) }),
    update: (slug, id, data) => this.request(`...`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (slug, id) => this.request(`...`, { method: 'DELETE' }),
  };
  programs = { /* same + attendance + enrollments */ };
  jobs = { /* same + accept/decline/complete/pull + timeEntries */ };
  contributions = { /* same */ };
  chat = { stream: async function*(slug, body) { /* SSE parsing */ } };
  dashboard = { get: (slug) => this.request(`/api/projects/${slug}/community/dashboard`) };
  // people, organizations, assets, calendar, reports...
}
```

### React Query Hooks

```typescript
export function useHouseholds(params?) {
  const { slug } = useProject();
  return useQuery({ queryKey: ['households', slug, params], queryFn: () => api.households.list(slug, params) });
}
export function useCreateHousehold() {
  const { slug } = useProject();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.households.create(slug, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['households', slug] }),
  });
}
```

---

## 8. Web App Prerequisites

Changes to the existing Next.js app required before/during Phase M1. All are additive — zero impact on existing web functionality.

### 8.1 Bearer Token Support in Middleware

**File:** `middleware.ts`

Add before cookie-based auth check:
```typescript
const authHeader = request.headers.get('Authorization');
if (authHeader?.startsWith('Bearer ')) {
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  // Set auth context for downstream routes
}
```

### 8.2 Push Notification Infrastructure

**New migration:**
```sql
CREATE TABLE IF NOT EXISTS push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY push_tokens_own ON push_tokens FOR ALL USING (auth.uid() = user_id);
```

**New routes:** `POST/DELETE /api/auth/push-token`, `POST /api/notifications/push`

**New service:** `lib/notifications/push.ts` — wraps Expo Push API. Called from job events, receipt confirmations, waiver completions, etc.

### 8.3 Presigned Upload URL

**New route:** `POST /api/upload/presigned-url`
```
Request: { filename, contentType, purpose: 'receipt' | 'document' | 'photo' }
Response: { uploadUrl, fileUrl, path }
```

---

## 9. Implementation Phases

### Phase M1: Setup & Auth (2 weeks)

**Goal:** App boots, authenticates, shows project list with correct role-based tabs.

| # | Task |
|---|------|
| 1 | Initialize Expo project (SDK 52, Router, TS) |
| 2 | Configure path aliases to `../../types`, `../../lib/validators` |
| 3 | Install all dependencies |
| 4 | Mobile Supabase client (SecureStore) |
| 5 | Typed API client (Bearer auth) |
| 6 | Auth store + hook (login/logout/restore) |
| 7 | Login screen (react-hook-form) |
| 8 | Root layout (auth guard) |
| 9 | Project selector (FlatList) |
| 10 | Project context store (selected project + role) |
| 11 | Role-based tab layout |
| 12 | React Query + MMKV persistence |
| 13 | Base UI components (~10: Button, Card, Input, Badge, Avatar, Skeleton, SearchBar, BottomSheet, Tabs, EmptyState) |
| 14 | EAS Build config (dev + preview) |
| 15 | **[Web]** Bearer token in middleware |
| 16 | Push notification token registration |
| 17 | **[Web]** Push token migration + routes |

### Phase M2: Dashboard & Read Views (2 weeks)

**Goal:** Browse all community data.

| # | Task |
|---|------|
| 1-5 | Dashboard (radar, metrics, programs, activity) |
| 6-7 | Household list + detail (tabs: Members, Programs, Contributions, Intake, Timeline) |
| 8-9 | Program list + detail |
| 10-11 | People list + detail |
| 12-13 | Organization list + detail |
| 14 | Community Assets list + detail |
| 15 | Contribution list |
| 16 | "More" menu |
| 17 | Pull-to-refresh, empty states, skeletons |
| 18 | Entity picker bottom sheet |

### Phase M3: Chat + Receipt OCR (3 weeks)

**Goal:** Full chat with camera-based receipt processing. **Ship as "Field Assistant MVP."**

| # | Task |
|---|------|
| 1 | Chat screen layout |
| 2 | Message list (inverted FlatList, bubbles) |
| 3 | Tool call cards (expandable, color-coded) |
| 4 | Chat input (KeyboardAvoidingView) |
| 5 | SSE streaming hook (adapted from web `use-chat.ts`) |
| 6 | Chat store (messages, streaming, conversations) |
| 7 | Conversation history (list, switch, create) |
| 8 | Camera button (expo-image-picker) |
| 9 | Image upload (compress → presigned URL → Supabase Storage) |
| 10 | **[Web]** Presigned upload API route |
| 11 | Receipt confirmation card (approve/edit/reject) |
| 12 | Haptic feedback |
| 13 | Chat settings (tool toggles) |
| 14 | Streaming text animation |

### Phase M4: CRUD Operations (2 weeks)

**Goal:** Create and edit entities from mobile.

| # | Task |
|---|------|
| 1 | Household intake wizard (multi-step) |
| 2 | Member quick-add (search/create) |
| 3 | Intake form (case_manager+) |
| 4 | Program enrollment bottom sheet |
| 5 | Batch attendance screen (tap grid) |
| 6 | "Mark All Present" + haptic |
| 7 | Contribution quick-entry (donation + time log) |
| 8 | Dimension auto-inherit |
| 9 | Quick-add person |
| 10 | Notes/comments |
| 11 | Waiver trigger on enrollment |
| 12 | Optimistic mutations |
| 13 | Offline mutation queue |

### Phase M5: Contractor Portal (2 weeks)

**Goal:** Contractors manage jobs + time from phone.

| # | Task |
|---|------|
| 1 | Contractor tab layout |
| 2 | Job list (active/available/done) |
| 3 | Job detail |
| 4 | Accept/decline bottom sheet |
| 5 | Timer controls (Start/Pause/Stop/Complete) |
| 6 | Persistent timer banner |
| 7 | Background timer (expo-task-manager) |
| 8 | Clock-running local notification |
| 9 | Job completion form |
| 10 | Contractor profile |
| 11 | Google Calendar OAuth |
| 12 | Push notifications (job events) |
| 13 | **[Web]** Push service + wiring |
| 14 | Service address → native maps |

### Phase M6: Maps & Location (1 week)

Map screen, 4 marker layers, clustering, popups, GPS, filters.

### Phase M7: Calendar & Notifications (1 week)

Calendar (day/agenda), event detail, notification deep linking, all push triggers, badge.

### Phase M8: Offline & Polish (2 weeks)

MMKV persistence, offline queue, network banner, sync indicators, splash/icon, dark mode, accessibility, FlatList tuning, image caching, haptics, tablet layout, error boundaries.

### Phase M9: Testing & Release (1 week)

Unit/component/E2E tests, physical device testing, EAS production builds, App Store/Play Store setup, screenshots, privacy policy, TestFlight/internal track, EAS Update pipeline.

---

## 10. Push Notification Events

| Event | Recipient | Deep Link |
|-------|-----------|-----------|
| `job.assigned` | Contractor | Job detail |
| `job.accepted` / `declined` / `completed` | Assigning staff | Job detail |
| `job.pulled` | Contractor | Job list |
| `job.deadline_approaching` | Contractor | Job detail |
| `job.inaction_warning` | Contractor | Job detail |
| `job.clock_running` | Contractor | Timer |
| `receipt.needs_approval` | Uploading staff | Chat |
| `waiver.signed` | Sending staff | Enrollment |
| `program.session_starting` | Enrolled staff | Program |
| `grant.deadline_approaching` | Assigned staff | Grant |
| `referral.overdue` | Case manager | Referral |

---

## 11. Offline Capabilities

**Works offline:** Browse cached data, take attendance, log hours, start/stop timer, capture receipts, create households (all queued for sync).

**Requires connectivity:** Chat responses (SSE), receipt OCR (server-side), push notifications, map tiles, OAuth flows.

**Sync:** Last-write-wins by timestamp. Mutations replayed in order. Failed replays show Discard/Retry. Global sync banner + per-item badges.

---

## 12. Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Bearer token breaks existing routes | Additive middleware change; cookie auth unchanged |
| iOS kills background timer | expo-task-manager + MMKV state + calculate from `started_at` |
| Unreliable SSE on mobile | Reconnection logic + "retrying" state |
| Offline mutation conflicts | Last-write-wins; conflict UI in V2 |
| App Store rejection | Native UI throughout; privacy manifest |
| FlatList performance | `getItemLayout`, pagination, `windowSize` |
| Shared type drift | Same `types/` dir; CI typecheck |

---

## 13. Success Metrics

| Metric | Target |
|--------|--------|
| Cold start to first action | < 10 sec |
| Receipt capture to confirmation | < 30 sec |
| Batch attendance (20 people) | < 45 sec |
| Job accept to timer start | < 15 sec |
| Offline sync on reconnect | < 5 sec |
| Weekly active staff on mobile | > 50% (30 days post-launch) |
| Weekly active contractors | > 80% |
| Crash-free rate | > 99.5% |

---

## 14. Open Decisions

| # | Decision | Recommendation |
|---|----------|---------------|
| 1 | Flat vs monorepo | Start flat `/mobile`, migrate later |
| 2 | UI library | NativeWind + custom (team knows Tailwind) |
| 3 | Offline storage | MMKV + React Query persist |
| 4 | Map provider | react-native-maps (free) |
| 5 | Charts | victory-native (radar support) |
| 6 | E2E testing | Maestro (YAML, CI-friendly) |
| 7 | Bottom sheets | @gorhom/bottom-sheet |
| 8 | Calendar | react-native-calendars |
| 9 | Error tracking | Sentry |

---

## 15. Timeline

| Phase | Duration | Cumulative | Deliverable |
|-------|----------|-----------|-------------|
| M1: Setup & Auth | 2 weeks | Week 2 | App boots, logs in, shows projects |
| M2: Dashboard & Reads | 2 weeks | Week 4 | Browse all community data |
| M3: Chat + OCR | 3 weeks | Week 7 | **Field Assistant MVP** |
| M4: CRUD | 2 weeks | Week 9 | Intake + attendance from phone |
| M5: Contractor Portal | 2 weeks | Week 11 | Jobs + timer |
| M6: Maps | 1 week | Week 12 | Community map + GPS |
| M7: Calendar + Notifs | 1 week | Week 13 | Push + calendar |
| M8: Offline + Polish | 2 weeks | Week 15 | Field-ready |
| M9: Test + Release | 1 week | Week 16 | App Store + Play Store |

**Total: ~16 weeks.** Accelerated launch: M1-M3 (7 weeks) as "GoodRev Field Assistant."

---

*This PRD is a living document. Update as implementation decisions are made and field feedback is received.*
