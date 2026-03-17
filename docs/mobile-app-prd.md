# GoodRev CRM — Mobile App PRD

**Version:** 1.0
**Date:** 2026-03-17
**Status:** Draft

---

## 1. Executive Summary

This PRD defines a **cross-platform mobile application** (iOS + Android) for GoodRev CRM, built with **React Native + Expo**. The mobile app provides field-ready access to both Standard CRM and Community Project types, prioritizing the workflows that happen away from a desk: intake at community centers, door-to-door outreach, on-site asset inspections, contribution logging, call/meeting notes, and pipeline updates.

The mobile app consumes the **existing Next.js API routes** as its backend — no new server infrastructure is required. Shared TypeScript code (types, validators, stores) is extracted into a monorepo `packages/shared` workspace, reused by both web and mobile.

---

## 2. Goals & Non-Goals

### Goals

- Deliver a native-feeling app on both iOS and Android from a single codebase
- Enable field workers, volunteers, and sales reps to work offline-capable and on-the-go
- Reuse existing API routes, Zod validators, TypeScript types, and Zustand stores
- Support both project types: Standard CRM and Community Center
- Ship a useful MVP in 8–10 weeks with phased feature rollout
- Maintain feature parity for core CRUD operations (create, read, update)
- Provide push notifications for tasks, mentions, and automation triggers

### Non-Goals (v1)

- Full admin/settings management (use web app)
- Custom report builder (use web app; mobile shows pre-built dashboards)
- Workflow/automation editor (use web app)
- MCP server or chat agent (web only for v1)
- Contract template editing or e-signature builder (web only)
- Self-service volunteer portal (future enhancement)
- Offline-first with full sync (v1 is online-first with selective caching)

---

## 3. Architecture

### 3.1 Monorepo Structure

```
GoodRevCRM/
├── apps/
│   ├── web/                  ← existing Next.js app (moved)
│   └── mobile/               ← new Expo/React Native app
├── packages/
│   └── shared/
│       ├── types/            ← from types/ (database.ts, etc.)
│       ├── validators/       ← from lib/validators/
│       ├── stores/           ← from stores/ (Zustand)
│       ├── constants/        ← capital colors, icons, enums
│       └── utils/            ← pure utility functions
├── package.json              ← workspace root (Turborepo)
├── turbo.json
└── ...
```

### 3.2 Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Framework | **Expo SDK 53+** | Managed workflow, OTA updates, EAS Build for app store submission |
| Navigation | **Expo Router v4** | File-based routing (familiar from Next.js), deep linking |
| UI Components | **NativeWind v4** (Tailwind for RN) | Reuse Tailwind class knowledge from web app |
| Component Library | **React Native Paper** or **Tamagui** | Accessible, themeable native components |
| State Management | **Zustand** | Same stores as web, zero changes needed |
| Server State | **TanStack React Query** | Same query/mutation patterns as web |
| Auth | **Supabase JS + expo-secure-store** | Supabase auth with secure token storage |
| Maps | **react-native-maps** | Native MapView for Community Map (Google Maps on Android, Apple Maps on iOS) |
| Forms | **React Hook Form + Zod** | Same form logic as web |
| Icons | **Lucide React Native** | Same icon set as web |
| Camera | **expo-camera** | Asset condition photos, document capture |
| Location | **expo-location** | Auto-fill coordinates for intake, asset logging |
| Notifications | **expo-notifications** | Push notifications via Expo Push Service |
| Secure Storage | **expo-secure-store** | Auth tokens, API keys |
| Image Handling | **expo-image-picker** | Photo capture and selection |
| Haptics | **expo-haptics** | Native feedback for interactions |
| Charts | **react-native-chart-kit** or **Victory Native** | Dashboard visualizations |

### 3.3 API Communication

The mobile app calls the **existing Next.js API routes** over HTTPS:

```
Mobile App  →  https://goodrevcrm.com/api/projects/[slug]/...  →  Supabase
```

- **Authentication**: Supabase auth session token sent as `Authorization: Bearer <token>` header
- **No new API routes needed** for v1 — existing REST endpoints cover all CRUD operations
- **API client module**: Thin wrapper around `fetch` with auth header injection, error handling, and retry logic
- **Response caching**: TanStack Query handles cache invalidation and background refetching

### 3.4 Authentication Flow

```
1. App opens → check expo-secure-store for stored session
2. If valid session → navigate to project list
3. If no session → show login screen
4. Login screen offers:
   a. Google OAuth → expo-auth-session → Supabase auth callback
   b. Magic link (email) → Supabase sends link → deep link back to app
5. On success → store session in expo-secure-store → navigate to projects
6. Token refresh handled by Supabase JS client automatically
```

---

## 4. Screens & Features

### 4.1 Shared Screens (Both Project Types)

#### Login / Onboarding
- Google OAuth sign-in button
- Magic link email input
- Brief onboarding carousel for first-time users (3 slides, skippable)

#### Project Selector
- List of user's projects with type badge (CRM / Community)
- Pull-to-refresh
- Last-accessed project opens by default

#### Dashboard
- Adapts based on project type (see 4.2 and 4.3)
- Key metrics cards (scrollable horizontal)
- Recent activity feed (infinite scroll)
- Quick-action FAB (floating action button): + New Person, + New Contribution/Opportunity

#### People
- Searchable, filterable list with avatar, name, org/household
- Pull-to-refresh, infinite scroll
- Person detail: tabs for Info, Activity, Notes, Relationships
- Edit inline or via edit screen
- Tap phone number → native dialer; tap email → compose

#### Organizations
- Searchable list with logo/initials, name, type
- Org detail: tabs for Info, People, Activity, Notes
- Edit screen

#### Notes & Activity Timeline
- Unified timeline on all entity detail screens
- Add note with text + optional photo attachment
- Voice-to-text input for quick notes (native speech recognition)

#### Tasks
- Task list with filters: my tasks, overdue, upcoming
- Quick-create from any entity detail screen
- Swipe to complete
- Push notification for due/overdue tasks

#### Notifications
- Push notification center
- Tap notification → deep link to relevant entity
- Badge count on app icon

#### Settings (Minimal)
- Profile (name, avatar)
- Notification preferences (toggle by type)
- Default project selection
- Logout
- App version / support link

---

### 4.2 Standard CRM Screens

#### Opportunities
- Pipeline board view (horizontal swipe between stages) or list view (toggle)
- Opportunity detail: value, stage, probability, linked org/person, notes
- Drag card to change stage (long-press + drag)
- Quick-create with minimal fields

#### Calls
- Call log list (recent calls)
- Tap-to-call from person/org detail
- Post-call note prompt (after call ends, prompt to log outcome)
- Call outcome selector: connected, voicemail, no answer, etc.

#### Email (Read-Only v1)
- View Gmail-synced email threads on person/org detail
- Tap to open in Gmail app for composing
- Full compose in v2

#### Sequences (Read-Only v1)
- View active sequences and enrollment status
- Pause/resume enrollments
- Full management in v2

#### Contracts (Sign Only v1)
- View contract status
- Share signing link via native share sheet
- View signed PDFs

---

### 4.3 Community Project Screens

#### Community Dashboard
- Capital Health Radar Chart (7-axis, interactive)
- Key metrics: Households, Active Programs, Volunteer Hours, Contributions
- Capital trend sparklines
- Mini community map preview (tap to expand)

#### Households
- Searchable list with household name, address, member count
- Household detail: members list, contribution history, program enrollments, notes
- **Quick Intake Flow** (optimized for field use):
  1. Household name + address (with GPS auto-fill option)
  2. Add members (name, role in household)
  3. Mark primary contact
  4. Optional: needs assessment (configurable custom fields)
  5. Optional: enroll in program immediately
  6. Save → appears on map automatically
- Edit household and members inline

#### Contributions
- List view with filters: type, capital, status, date range
- Capital-colored badges on each row
- **Quick-Log Contribution** (< 3 taps for common types):
  - Select type (monetary / in-kind / volunteer hours / grant / service)
  - Enter value or hours
  - Select capital type (color-coded buttons)
  - Link donor (person/org/household search)
  - Link recipient or program (optional)
  - Save
- Contribution detail with all fields and linked entities

#### Programs
- Card list with status badge, capital dots, enrollment fraction
- Program detail: info, enrollment list, contribution history
- Quick-enroll: search person/household → add to program
- Mark enrollment complete/withdrawn with swipe

#### Community Assets
- List with category icon, condition badge (color-coded)
- Asset detail: info, location mini-map, steward, condition history
- **Field Inspection Mode**:
  1. Open asset from list or tap marker on map
  2. Update condition (excellent/good/fair/poor picker)
  3. Take photo with expo-camera
  4. Add note describing condition
  5. GPS auto-confirms you're on-site
  6. Save → condition history updated

#### Community Map
- Full-screen native map (react-native-maps)
- Layer toggles: Households, Assets, Programs, Organizations
- Markers use same icon/color system as web
- Cluster markers at low zoom
- Tap marker → bottom sheet with entity summary + "View Details" link
- Current location button (center on user's GPS)
- Useful for: door-to-door outreach, asset inspections, identifying coverage gaps

#### Relationships
- View on person detail screen under Relationships tab
- Add relationship: select person B, choose type, add notes
- Visual list grouped by type

#### Events / Bookings (v1 Read-Only)
- Calendar view of upcoming events
- Event detail with facility, time, organizer
- Full booking management in v2

---

## 5. Offline Capabilities (v1)

v1 is **online-first** with selective caching to handle spotty connectivity:

| Feature | Offline Behavior |
|---------|-----------------|
| Previously viewed lists | Cached, viewable offline (TanStack Query cache) |
| Entity detail pages | Cached if previously loaded |
| Create contribution | Queued locally, synced when online |
| Create note | Queued locally, synced when online |
| Quick intake (household) | Queued locally, synced when online |
| Update asset condition | Queued locally, synced when online |
| Maps | Cached tiles; markers require online |
| Search | Requires online |
| Photos | Stored locally, uploaded on reconnect |

**Offline queue** implementation:
- Pending mutations stored in `expo-secure-store` or AsyncStorage
- On reconnect: queue processed in order with conflict detection
- Badge indicator showing "X changes pending sync"
- Manual "Sync Now" button in settings

---

## 6. Push Notifications

Using **Expo Push Notifications** + a lightweight push endpoint on the existing API:

| Notification Type | Trigger | Deep Link |
|------------------|---------|-----------|
| Task due | Task due date reached | Task detail |
| Task assigned | Task assigned to user | Task detail |
| New contribution | Contribution created for your program | Contribution detail |
| Program enrollment | New enrollment in your program | Program enrollment list |
| Intake completed | New household registered (for directors) | Household detail |
| Referral follow-up | Service referral needs follow-up | Contribution detail |
| Opportunity stage change | Deal moved stages (CRM) | Opportunity detail |
| Automation triggered | Automation action completed | Related entity |

**Implementation:**
1. New API route: `POST /api/push/register` — stores Expo push token per user/device
2. New DB table: `push_tokens` (user_id, token, device_name, created_at)
3. Push dispatch function called from existing automation engine + API routes
4. Respect user notification preferences (stored in app, synced to DB)

---

## 7. Navigation Structure

### Standard CRM Project

```
Tab Bar:
  Dashboard    People    Opportunities    More

More Menu:
  Organizations
  Calls
  Tasks
  Email
  Sequences
  Contracts
  Notifications
  Settings
```

### Community Project

```
Tab Bar:
  Dashboard    Households    Contribute    Map    More

More Menu:
  People
  Organizations
  Programs
  Community Assets
  Tasks
  Notifications
  Settings
```

- **Contribute** tab opens the Quick-Log Contribution flow directly (most common action)
- Tab bar uses icons matching the web sidebar icons
- Active tab highlighted with brand color

---

## 8. Design System

### Shared with Web

- **Colors**: Same Tailwind palette via NativeWind
- **Capital colors**: Same 7-capital color/icon mapping (Green/Leaf, Purple/Palette, etc.)
- **Typography**: System fonts (SF Pro on iOS, Roboto on Android) — no custom font loading needed
- **Icons**: Lucide React Native (same icon names as web)
- **Spacing**: 4px grid system (matching Tailwind's spacing scale)

### Mobile-Specific Patterns

| Pattern | Implementation |
|---------|---------------|
| Pull-to-refresh | On all list screens |
| Infinite scroll | Paginated API calls, append on scroll |
| Swipe actions | Swipe-to-complete on tasks, swipe-to-call on people |
| Bottom sheets | Entity previews from map markers, quick actions |
| FAB (Floating Action Button) | Primary create action per screen |
| Haptic feedback | On stage changes, completions, swipe actions |
| Skeleton screens | Loading states for lists and detail pages |
| Toast notifications | Sonner-style toasts via `react-native-toast-message` |
| Dark mode | Follows system preference; uses same dark palette as web |

---

## 9. Security

| Concern | Mitigation |
|---------|-----------|
| Token storage | `expo-secure-store` (Keychain on iOS, Keystore on Android) |
| API communication | HTTPS only; certificate pinning in production build |
| Session expiry | Supabase auto-refresh; force re-auth if refresh fails |
| Biometric lock | Optional biometric unlock (Face ID / fingerprint) via `expo-local-authentication` |
| Data at rest | Offline cache encrypted via OS-level encryption (enabled by default on modern devices) |
| RLS enforcement | Same Supabase RLS policies — mobile uses same auth tokens as web |
| Sensitive fields | Needs assessment data never cached offline; cleared on logout |
| Jailbreak/root detection | Warn user; optionally disable offline storage on compromised devices |

---

## 10. Performance Targets

| Metric | Target |
|--------|--------|
| App cold start | < 2 seconds |
| Screen transition | < 300ms |
| List load (first 20 items) | < 1 second |
| Map render with 500 markers | < 2 seconds |
| Quick-log contribution | < 3 taps + value entry |
| Household intake flow | < 2 minutes (matching web target) |
| Offline queue sync | < 5 seconds for 10 queued items |
| App bundle size (iOS) | < 50 MB |
| App bundle size (Android) | < 40 MB |

---

## 11. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Unit tests | Vitest | Shared validators, stores, utils |
| Component tests | React Native Testing Library | Screen components, form logic |
| Integration tests | Detox or Maestro | Critical flows: login, intake, contribution logging |
| E2E (CI) | EAS Build + Maestro Cloud | Smoke tests on each PR |
| Beta testing | Expo EAS Update | OTA updates to TestFlight (iOS) and Internal Testing (Android) |
| Device testing | BrowserStack or physical devices | Top 5 iOS + top 5 Android devices |

---

## 12. Deployment & Distribution

### Build Pipeline

```
Code Push → GitHub Actions → EAS Build → App Store / Play Store
                          ↘ EAS Update → OTA patch (no store review)
```

| Stage | Tool | Notes |
|-------|------|-------|
| CI | GitHub Actions | Lint, typecheck, unit tests on every PR |
| Build | EAS Build | Cloud builds for iOS + Android |
| OTA Updates | EAS Update | JS-only changes pushed without store review |
| iOS Distribution | TestFlight → App Store | Apple review required for native changes |
| Android Distribution | Internal Testing → Play Store | Google review required for native changes |
| Beta Channel | Expo Dev Client | Internal testing builds with dev tools |

### Environment Configuration

```
.env.development    → local API (http://localhost:3000)
.env.staging        → staging API (https://staging.goodrevcrm.com)
.env.production     → production API (https://goodrevcrm.com)
```

---

## 13. Implementation Phases

### Phase 1: Foundation (Weeks 1–2)

- Set up monorepo with Turborepo (move web app to `apps/web/`)
- Extract shared packages (types, validators, stores, constants)
- Create Expo app in `apps/mobile/`
- Configure NativeWind, React Query, Zustand
- Implement auth flow (Google OAuth + Supabase)
- Build project selector screen
- Set up EAS Build + CI pipeline

**Deliverable**: App that authenticates and shows project list

### Phase 2: Core Shared Screens (Weeks 3–4)

- Dashboard screen (basic metrics cards + activity feed)
- People list + detail + edit
- Organizations list + detail + edit
- Notes/timeline on all detail screens
- Tasks list + create + complete
- Push notification registration

**Deliverable**: Functional CRM with people, orgs, and tasks

### Phase 3: Standard CRM Features (Weeks 5–6)

- Opportunities pipeline board + list + detail
- Tap-to-call + post-call note logging
- Email thread view (read-only)
- Sequence enrollment view (read-only)
- Contract status view + share signing link
- CRM-specific dashboard metrics

**Deliverable**: Usable mobile CRM for sales teams

### Phase 4: Community Project Features (Weeks 7–8)

- Households list + detail + quick intake flow
- Contributions list + quick-log flow
- Programs list + detail + enrollment management
- Community Assets list + detail + field inspection mode
- Relationships on person detail
- Community dashboard with capital radar chart
- GPS auto-fill for addresses and coordinates

**Deliverable**: Usable mobile app for community center staff

### Phase 5: Map + Polish (Weeks 9–10)

- Community Map with all layers and markers
- Map marker tap → bottom sheet previews
- Offline queue for contributions, notes, intake
- Dark mode
- Haptic feedback, skeleton screens, pull-to-refresh
- Performance optimization and device testing
- App store submission preparation (screenshots, metadata)

**Deliverable**: Production-ready app submitted to stores

### Phase 6: Post-Launch (Ongoing)

- Biometric lock
- Voice-to-text notes
- Full email compose
- Sequence management
- Event/booking management
- Barcode/QR scanning for asset tracking
- Accessibility audit and improvements
- Tablet/iPad optimized layouts

---

## 14. Shared Code Reuse Estimate

| Module | Web | Mobile | Shared | Reuse % |
|--------|-----|--------|--------|---------|
| TypeScript types | ✓ | ✓ | `packages/shared/types` | 100% |
| Zod validators | ✓ | ✓ | `packages/shared/validators` | 100% |
| Zustand stores | ✓ | ✓ | `packages/shared/stores` | 90% |
| Constants (capitals, enums) | ✓ | ✓ | `packages/shared/constants` | 100% |
| Pure utility functions | ✓ | ✓ | `packages/shared/utils` | 95% |
| React hooks (data fetching) | ✓ | ✓ | Adapted (fetch → RN) | 70% |
| UI components | ✓ | ✗ | None (different primitives) | 0% |
| API routes (backend) | ✓ | Consumed | Stays in `apps/web` | N/A |
| Navigation/routing | ✓ | ✗ | None (Expo Router) | 0% |

**Overall**: ~50–60% of non-UI TypeScript code is directly reusable.

---

## 15. API Changes Required

The existing API is largely sufficient. Minimal additions needed:

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `/api/push/register` | POST | Register Expo push token | Phase 2 |
| `/api/push/unregister` | POST | Remove push token on logout | Phase 2 |
| Modify existing mutation endpoints | — | Call push dispatch after mutations | Phase 2 |

**New table:**

```sql
CREATE TABLE push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  device_name TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);
```

---

## 16. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Monorepo migration breaks web app | High | Do migration in isolated branch; run full test suite before merge; keep web app functional throughout |
| React Native map performance with many markers | Medium | Marker clustering; limit visible markers to viewport; lazy load layers |
| Expo managed workflow limitations | Medium | Eject to bare workflow only if native modules require it; Expo SDK 53 covers most needs |
| App store review delays | Medium | Submit early; use EAS Update for JS-only patches; maintain compliance from day one |
| Offline sync conflicts | Medium | Last-write-wins for v1; conflict resolution UI in v2; warn users when offline |
| NativeWind Tailwind parity gaps | Low | Fallback to StyleSheet for unsupported utilities; NativeWind v4 covers 90%+ of Tailwind |
| Auth token refresh on mobile backgrounding | Low | Supabase JS handles refresh; test on both platforms for edge cases |
| GPS/location permission denials | Low | Graceful fallback to manual address entry; explain value in permission prompt |

---

## 17. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| App store rating | ≥ 4.5 stars | App Store Connect / Play Console |
| Field intake completion rate | ≥ 90% started → saved | Analytics event tracking |
| Contribution quick-log time | < 30 seconds | Analytics timing |
| Daily active users (after 3 months) | ≥ 40% of web DAU | Supabase auth logs |
| Crash-free rate | ≥ 99.5% | Expo/Sentry crash reporting |
| Offline queue success rate | ≥ 99% synced without error | Sync success/failure logging |
| Push notification opt-in | ≥ 70% of mobile users | Expo push token registration rate |
| App cold start time | < 2 seconds (p95) | Performance monitoring |

---

## 18. Open Questions

1. **App name**: "GoodRev" or "GoodRev CRM" or something distinct for community use?
2. **App store accounts**: Are Apple Developer ($99/yr) and Google Play ($25 one-time) accounts set up?
3. **Branding**: Do we need a separate app icon/splash for community vs. CRM, or one unified app?
4. **Self-service portal**: Should volunteers be able to log their own hours in the mobile app, or staff-only for v1?
5. **Tablet support**: Prioritize iPad/Android tablet layouts, or phone-first for v1?
6. **Analytics SDK**: Mixpanel, Amplitude, PostHog, or Expo's built-in analytics?
7. **Crash reporting**: Sentry (already popular in RN ecosystem) or Expo's built-in?

---

*This PRD is a living document. Update as architecture decisions are finalized and user testing feedback comes in.*
