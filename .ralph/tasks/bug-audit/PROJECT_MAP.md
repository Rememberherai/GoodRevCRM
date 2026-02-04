# GoodRevCRM Project Map

## Stack
- **Framework**: Next.js 16.1.6 + React 19.2.3 (App Router)
- **Database**: Supabase (PostgreSQL with RLS)
- **Auth**: Supabase Auth (cookie-based sessions via @supabase/ssr)
- **Validation**: Zod 4.3.6
- **State**: Zustand 5.0.10 + React Query 5.90.20
- **Testing**: Vitest 4.0.18
- **UI**: Radix UI + Tailwind CSS 4

## Directory Structure

```
GoodRevCRM/
├── app/                           # Next.js App Router
│   ├── (auth)/                    # Auth pages (login, callback)
│   ├── (dashboard)/               # Dashboard pages
│   │   ├── projects/page.tsx      # Projects list
│   │   ├── projects/[slug]/       # Project-scoped pages
│   │   │   ├── people/            # CRM contacts
│   │   │   ├── organizations/     # Companies
│   │   │   ├── opportunities/     # Sales deals
│   │   │   ├── rfps/              # RFP management
│   │   │   ├── sequences/         # Email sequences
│   │   │   ├── content-library/   # Template library
│   │   │   ├── search/            # Global search
│   │   │   └── settings/          # Project + automation settings
│   │   └── settings/page.tsx      # User-level settings
│   └── api/                       # ~100 API route files
│       ├── cron/process-sequences/ # Cron: sequence + automation processing
│       ├── gmail/                  # Gmail integration (10 routes)
│       │   ├── callback/           # OAuth callback
│       │   ├── connect/            # Initiate OAuth
│       │   ├── connections/        # List connections
│       │   ├── disconnect/         # Revoke connection
│       │   ├── sync/{status,toggle,trigger}/ # Sync operations
│       │   ├── test/               # Connection test
│       │   └── webhook/            # Gmail push notifications
│       ├── notifications/          # User notifications (4 routes)
│       ├── projects/               # Project mgmt + ~85 project-scoped routes
│       │   ├── route.ts            # List/create projects
│       │   └── [slug]/             # All project-scoped resources
│       │       ├── activity/       # Activity log + follow-ups
│       │       ├── analytics/      # Analytics
│       │       ├── automations/    # Automation CRUD + test + executions
│       │       ├── bulk/           # Bulk operations
│       │       ├── content-library/# Content library CRUD + search + upload
│       │       ├── dashboard/      # Dashboard
│       │       ├── drafts/         # Email drafts
│       │       ├── email/          # Send, inbox, history, thread
│       │       ├── enrich/         # Contact enrichment
│       │       ├── epa-import/     # EPA ECHO import
│       │       ├── export/         # Data export
│       │       ├── import/         # Data import
│       │       ├── invitations/    # Team invitations
│       │       ├── meetings/       # Meeting CRUD + status
│       │       ├── members/        # Team members
│       │       ├── notes/          # Notes CRUD
│       │       ├── opportunities/  # Opportunity CRUD
│       │       ├── organizations/  # Org CRUD + add-contacts + discover
│       │       ├── people/         # People CRUD
│       │       ├── reports/        # Reporting
│       │       ├── research/       # AI research + apply
│       │       ├── research-settings/ # Research config
│       │       ├── rfps/           # RFP CRUD + questions + export + stats
│       │       ├── schema/         # Custom field definitions + reorder
│       │       ├── search/         # Global search
│       │       ├── sequences/      # Sequence CRUD + enrollment + steps + generate
│       │       ├── settings/       # Project settings + custom-roles
│       │       ├── tags/           # Tag CRUD + assign
│       │       ├── tasks/          # Task CRUD
│       │       ├── templates/      # Email templates + versions
│       │       ├── upload-logo/    # Project logo upload
│       │       ├── webhooks/       # Outbound webhook CRUD + test + deliveries
│       │       └── widgets/        # Dashboard widgets
│       ├── track/                  # Email tracking (unauthenticated)
│       │   ├── click/              # Click tracking + redirect
│       │   └── open/               # Open tracking pixel
│       ├── user/                   # User profile + settings
│       └── webhooks/fullenrich/    # Inbound FullEnrich webhook
├── components/                    # ~155 React components (32 directories)
│   ├── ui/                        # Base UI (buttons, forms, dialogs, etc.)
│   ├── automations/               # Automation builder UI
│   ├── organizations/             # Org components
│   ├── people/                    # Contact components
│   ├── opportunities/             # Deal components
│   ├── rfps/                      # RFP components
│   ├── sequences/                 # Sequence builder + wizard + enrollment
│   ├── gmail/                     # Gmail integration UI
│   └── [20+ more feature dirs]
├── hooks/                         # 12 React hooks
├── lib/                           # 49 library files
│   ├── automations/               # Automation engine (4 files)
│   │   ├── engine.ts              # Core event processing + loop detection
│   │   ├── actions.ts             # 13+ action handlers
│   │   ├── conditions.ts          # Condition evaluation
│   │   └── time-triggers.ts       # Time-based trigger processing
│   ├── gmail/                     # Gmail integration
│   │   ├── oauth.ts               # Google OAuth flow
│   │   ├── service.ts             # Email sending + tracking
│   │   ├── sync.ts                # Email sync
│   │   └── contact-matcher.ts     # Contact matching
│   ├── sequences/                 # Sequence processing
│   │   ├── processor.ts           # Enrollment processor
│   │   └── variables.ts           # Template variable substitution
│   ├── supabase/                  # Supabase clients
│   │   ├── admin.ts               # Service role (bypasses RLS)
│   │   ├── server.ts              # SSR client + service client
│   │   └── client.ts              # Browser client
│   ├── validators/                # 27 Zod validator files
│   ├── openrouter/                # AI integration (client, prompts, structured-output)
│   ├── epa-echo/                  # EPA ECHO API client
│   ├── fullenrich/                # FullEnrich API client
│   ├── pdf/                       # PDF text extraction
│   ├── env.ts                     # Environment validation
│   ├── utils.ts                   # Shared utilities
│   └── debug.ts                   # Debug helpers
├── providers/                     # React context providers (auth, theme, enrichment)
├── stores/                        # 9 Zustand stores
├── supabase/migrations/           # 46 SQL migration files (0001-0046)
├── tests/                         # 28 test directories (Vitest)
├── types/                         # 29 TypeScript type definition files
├── middleware.ts                  # Next.js middleware (auth redirect)
└── CLAUDE.md                      # Project instructions

## File Counts
- API route files: ~100
- Component files: ~155
- Library files: ~49
- Type definition files: ~29
- Validator files: ~27
- Hook files: 12
- Store files: 9
- Migration files: 46
- Test directories: 28
- Total application lines: ~85,500

## Security-Critical Files

### Files Using Admin Client (bypass RLS):
- `lib/supabase/admin.ts` — centralized admin client factory
- `lib/supabase/server.ts` — createServiceClient helper
- `lib/automations/engine.ts` — local createAdminClient (line 20)
- `lib/automations/actions.ts` — local createAdminClient
- `lib/automations/time-triggers.ts` — local createAdminClient
- `lib/gmail/service.ts` — local createAdminClient
- `lib/sequences/processor.ts` — local createAdminClient
- `lib/sequences/variables.ts` — local createAdminClient
- `app/api/track/click/route.ts` — local createAdminClient
- `app/api/track/open/route.ts` — local createAdminClient
- `app/api/webhooks/fullenrich/route.ts` — local createAdminClient

### Unauthenticated Endpoints:
- `app/api/track/click/route.ts` — email click tracking
- `app/api/track/open/route.ts` — email open pixel
- `app/api/cron/process-sequences/route.ts` — cron (auth optional!)
- `app/api/webhooks/fullenrich/route.ts` — webhook (signature optional!)
- `app/api/gmail/webhook/route.ts` — Gmail push
- `app/api/gmail/callback/route.ts` — OAuth callback

### Standard Auth Pattern (project-scoped routes):
```typescript
const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

const { data: project } = await supabase
  .from('projects')
  .select('id')
  .eq('slug', slug)
  .is('deleted_at', null)
  .single();
if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
```

## Useful Glob Patterns

| Target | Glob |
|--------|------|
| All API routes | `app/api/**/route.ts` |
| Project-scoped routes | `app/api/projects/[slug]/**/route.ts` |
| Gmail routes | `app/api/gmail/**/route.ts` |
| Tracking routes | `app/api/track/*/route.ts` |
| Inbound webhooks | `app/api/webhooks/**/route.ts` |
| Automation lib | `lib/automations/*.ts` |
| Gmail lib | `lib/gmail/*.ts` |
| Sequence lib | `lib/sequences/*.ts` |
| All validators | `lib/validators/*.ts` |
| Supabase clients | `lib/supabase/*.ts` |
| All stores | `stores/*.ts` |
| All hooks | `hooks/*.ts` |
| All types | `types/*.ts` |
| All migrations | `supabase/migrations/*.sql` |
| All providers | `providers/*.tsx` |
| OpenRouter | `lib/openrouter/*.ts` |
| FullEnrich | `lib/fullenrich/*.ts` |
| EPA ECHO | `lib/epa-echo/*.ts` |
