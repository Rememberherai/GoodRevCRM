# GoodRev CRM — Master TODO List

**Project:** GoodRev CRM v2.3  
**Start Date:** ___________  
**Target Completion:** 28 weeks from start

---

## Verification Commands

Run after EVERY completed task:

```bash
# Quick check (run after every task)
npm run verify

# What 'verify' runs (defined in package.json):
# 1. TypeScript check (no emit)
# 2. ESLint
# 3. Build (catches runtime issues)
# 4. Tests

# Manual equivalent:
npm run typecheck && npm run lint && npm run build && npm run test
```

**Rule:** Never move to next task until verify passes. If it fails, fix before proceeding.

---

## Legend

- [ ] Task not started
- [~] In progress
- [x] Complete + verified
- [!] Blocked
- ⚠️ Requires key/secret
- 🔒 Security-sensitive
- 🧪 Needs test coverage

---

# Phase 0: Project Setup (Week 1)

## 0.1 Initialize Project

- [ ] Create new Next.js 15 project with App Router
  ```bash
  npx create-next-app@latest goodrev-crm --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
  cd goodrev-crm
  ```
  **Verify:** `npm run build` ✓

- [ ] Configure TypeScript strict mode
  ```json
  // tsconfig.json
  {
    "compilerOptions": {
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitReturns": true,
      "noFallthroughCasesInSwitch": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```
  **Verify:** `npm run typecheck` ✓

- [ ] Set up ESLint with strict rules
  ```bash
  npm install -D @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react-hooks
  ```
  **Verify:** `npm run lint` ✓

- [ ] Create package.json scripts
  ```json
  {
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "eslint . --ext .ts,.tsx",
      "typecheck": "tsc --noEmit",
      "test": "vitest run",
      "test:watch": "vitest",
      "verify": "npm run typecheck && npm run lint && npm run build && npm run test",
      "db:migrate": "supabase db push",
      "db:types": "supabase gen types typescript --project-id $SUPABASE_PROJECT_ID > types/database.ts"
    }
  }
  ```
  **Verify:** `npm run verify` ✓

- [ ] Install core dependencies
  ```bash
  npm install @supabase/supabase-js @supabase/ssr zustand @tanstack/react-query zod react-hook-form @hookform/resolvers next-themes sonner lucide-react date-fns
  ```
  **Verify:** `npm run typecheck` ✓

- [ ] Install dev dependencies
  ```bash
  npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
  ```
  **Verify:** `npm run test` (should pass with 0 tests) ✓

- [ ] Install shadcn/ui
  ```bash
  npx shadcn@latest init
  # Select: New York style, Zinc color, CSS variables: yes
  ```
  **Verify:** `npm run build` ✓

- [ ] Add essential shadcn components
  ```bash
  npx shadcn@latest add button input label card dialog alert-dialog dropdown-menu select textarea switch tabs badge skeleton toast form separator avatar tooltip popover command sheet table
  ```
  **Verify:** `npm run typecheck` ✓

## 0.2 Project Structure

- [ ] Create folder structure
  ```
  app/
  ├── (auth)/
  │   ├── login/
  │   └── callback/
  ├── (dashboard)/
  │   ├── layout.tsx
  │   └── projects/
  │       └── [slug]/
  ├── api/
  │   ├── webhooks/
  │   └── track/
  └── layout.tsx
  components/
  ├── ui/           (shadcn)
  ├── forms/
  ├── data/
  └── layout/
  lib/
  ├── supabase/
  ├── utils/
  └── validators/
  hooks/
  stores/
  types/
  ```
  **Verify:** `npm run build` ✓

- [ ] Create base types file (`types/index.ts`)
  ```typescript
  export type EntityType = 'organization' | 'person' | 'opportunity' | 'rfp';
  
  export interface BaseEntity {
    id: string;
    project_id: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }
  ```
  **Verify:** `npm run typecheck` ✓

## 0.3 Environment Setup

- [ ] Create `.env.example`
  ```bash
  # Supabase
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
  
  # OpenRouter
  OPENROUTER_API_KEY=sk-or-v1-xxx
  
  # App
  NEXT_PUBLIC_APP_URL=http://localhost:3000
  ```
  **Verify:** File exists, no real secrets ✓

- [ ] Create `.env.local` (do NOT commit)
  ```bash
  cp .env.example .env.local
  # Fill in real values
  ```
  **Verify:** `.gitignore` includes `.env.local` ✓

- [ ] Create environment validation (`lib/env.ts`) 🔒
  ```typescript
  import { z } from 'zod';
  
  const envSchema = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    OPENROUTER_API_KEY: z.string().startsWith('sk-or-'),
  });
  
  export const env = envSchema.parse(process.env);
  ```
  **Verify:** `npm run build` (fails if env missing) ✓

## 0.4 Theme System

- [ ] Configure Tailwind for theming (`tailwind.config.ts`)
  **Verify:** `npm run build` ✓

- [ ] Create CSS variables (`app/globals.css`)
  - Light mode variables
  - Dark mode variables
  **Verify:** `npm run build` ✓

- [ ] Create ThemeProvider (`providers/theme-provider.tsx`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create ThemeToggle component (`components/theme-toggle.tsx`)
  **Verify:** `npm run verify` ✓

- [ ] Add ThemeProvider to root layout
  **Verify:** `npm run dev` → toggle works in browser ✓

## 0.5 Vitest Setup

- [ ] Create Vitest config (`vitest.config.ts`)
  ```typescript
  import { defineConfig } from 'vitest/config';
  import react from '@vitejs/plugin-react';
  import path from 'path';
  
  export default defineConfig({
    plugins: [react()],
    test: {
      environment: 'jsdom',
      setupFiles: ['./tests/setup.ts'],
      globals: true,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './'),
      },
    },
  });
  ```
  **Verify:** `npm run test` ✓

- [ ] Create test setup (`tests/setup.ts`)
  ```typescript
  import '@testing-library/jest-dom';
  import { vi } from 'vitest';
  
  // Mock next/navigation
  vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
  }));
  ```
  **Verify:** `npm run test` ✓

- [ ] Create first test (`tests/smoke.test.ts`)
  ```typescript
  import { describe, it, expect } from 'vitest';
  
  describe('Smoke Test', () => {
    it('should pass', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```
  **Verify:** `npm run test` → 1 passed ✓

---

# Phase 1: Supabase Foundation (Week 2)

## 1.1 Supabase Client Setup

- [ ] Create Supabase browser client (`lib/supabase/client.ts`)
  ```typescript
  import { createBrowserClient } from '@supabase/ssr';
  import type { Database } from '@/types/database';
  
  export function createClient() {
    return createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  ```
  **Verify:** `npm run typecheck` ✓

- [ ] Create Supabase server client (`lib/supabase/server.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create Supabase admin client (`lib/supabase/admin.ts`) 🔒
  **Verify:** `npm run typecheck` ✓

## 1.2 Database Migrations — Core Tables

- [ ] Migration 001: users table
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ALTER TABLE users ENABLE ROW LEVEL SECURITY;
  ```
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 002: projects table
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 003: project_memberships table
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 004: projects RLS policies
  **Verify:** `npm run db:migrate` ✓

- [ ] Regenerate TypeScript types
  ```bash
  npm run db:types
  ```
  **Verify:** `npm run typecheck` ✓

## 1.3 Database Migrations — Entity Tables

- [ ] Migration 005: organizations table (with custom_fields JSONB)
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 006: people table (with custom_fields JSONB)
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 007: person_organizations junction table
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 008: opportunities table (with custom_fields JSONB)
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 009: rfps table (with custom_fields JSONB)
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 010: RLS for all entity tables
  **Verify:** `npm run db:migrate` ✓

- [ ] Regenerate TypeScript types
  **Verify:** `npm run typecheck` ✓

## 1.4 Database Migrations — Custom Fields System

- [ ] Migration 011: custom_field_definitions table
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 012: schema_audit_log table
  **Verify:** `npm run db:migrate` ✓

- [ ] Migration 013: remove_custom_field_data function
  **Verify:** `npm run db:migrate` ✓

- [ ] Regenerate TypeScript types
  **Verify:** `npm run typecheck` ✓

---

# Phase 2: Authentication (Week 3)

## 2.1 Auth Setup

- [ ] Configure Google OAuth in Supabase dashboard ⚠️
  **Verify:** Auth settings saved ✓

- [ ] Create auth callback route (`app/auth/callback/route.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create login page (`app/(auth)/login/page.tsx`)
  **Verify:** `npm run verify` ✓

- [ ] Create auth middleware (`middleware.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create user sync trigger (Migration 014)
  **Verify:** `npm run db:migrate` ✓

## 2.2 Auth Components

- [ ] Create `useAuth` hook (`hooks/use-auth.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create AuthProvider (`providers/auth-provider.tsx`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create UserMenu component (`components/layout/user-menu.tsx`)
  **Verify:** `npm run verify` ✓

## 2.3 Auth Tests 🧪

- [ ] Write auth flow tests (`tests/auth/auth.test.ts`)
  **Verify:** `npm run test` → all pass ✓

---

# Phase 3: Project Management (Week 4)

## 3.1 Project CRUD

- [ ] Create project types (`types/project.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create project validators (`lib/validators/project.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create project API routes
  - `app/api/projects/route.ts` (GET, POST)
  - `app/api/projects/[slug]/route.ts` (GET, PATCH, DELETE)
  **Verify:** `npm run verify` ✓

- [ ] Create project store (`stores/project.ts`)
  **Verify:** `npm run typecheck` ✓

## 3.2 Project UI

- [ ] Create project list page (`app/(dashboard)/projects/page.tsx`)
  **Verify:** `npm run verify` ✓

- [ ] Create project card component
  **Verify:** `npm run verify` ✓

- [ ] Create new project modal
  **Verify:** `npm run verify` ✓

- [ ] Create project layout (`app/(dashboard)/projects/[slug]/layout.tsx`)
  **Verify:** `npm run verify` ✓

- [ ] Create project sidebar navigation
  **Verify:** `npm run verify` ✓

## 3.3 Project Tests 🧪

- [ ] Write project CRUD tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 4: Organizations Module (Weeks 5-6)

## 4.1 Organizations CRUD

- [ ] Create organization types (`types/organization.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create organization validators (`lib/validators/organization.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create organizations API routes
  **Verify:** `npm run verify` ✓

- [ ] Create `useOrganizations` hook
  **Verify:** `npm run typecheck` ✓

## 4.2 Organizations UI

- [ ] Create organizations list page
  **Verify:** `npm run verify` ✓

- [ ] Create organizations data table
  **Verify:** `npm run verify` ✓

- [ ] Create organization detail page
  **Verify:** `npm run verify` ✓

- [ ] Create organization form (system + custom fields)
  **Verify:** `npm run verify` ✓

## 4.3 Custom Fields Integration

- [ ] Create `useCustomFields` hook
  **Verify:** `npm run typecheck` ✓

- [ ] Create DynamicField component (all 15 field types)
  **Verify:** `npm run verify` ✓

- [ ] Create DynamicFields wrapper
  **Verify:** `npm run verify` ✓

- [ ] Integrate custom fields into organization form
  **Verify:** `npm run verify` ✓

## 4.4 Organizations Tests 🧪

- [ ] Write organization CRUD tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 5: People Module (Week 7)

## 5.1 People CRUD

- [ ] Create people types
  **Verify:** `npm run typecheck` ✓

- [ ] Create people validators
  **Verify:** `npm run typecheck` ✓

- [ ] Create people API routes
  **Verify:** `npm run verify` ✓

- [ ] Create `usePeople` hook
  **Verify:** `npm run typecheck` ✓

## 5.2 People UI

- [ ] Create people list page
  **Verify:** `npm run verify` ✓

- [ ] Create people data table
  **Verify:** `npm run verify` ✓

- [ ] Create person detail page
  **Verify:** `npm run verify` ✓

- [ ] Create person form (with custom fields)
  **Verify:** `npm run verify` ✓

- [ ] Create person-organization linking UI
  **Verify:** `npm run verify` ✓

## 5.3 People Tests 🧪

- [ ] Write people CRUD tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 6: Opportunities Module (Week 8)

## 6.1 Opportunities CRUD

- [ ] Create opportunity types
  **Verify:** `npm run typecheck` ✓

- [ ] Create opportunity validators
  **Verify:** `npm run typecheck` ✓

- [ ] Create opportunities API routes
  **Verify:** `npm run verify` ✓

- [ ] Create `useOpportunities` hook
  **Verify:** `npm run typecheck` ✓

## 6.2 Opportunities UI

- [ ] Create opportunities list page
  **Verify:** `npm run verify` ✓

- [ ] Create pipeline view (Kanban)
  **Verify:** `npm run verify` ✓

- [ ] Create opportunity detail page
  **Verify:** `npm run verify` ✓

- [ ] Create opportunity form (with custom fields)
  **Verify:** `npm run verify` ✓

## 6.3 Opportunities Tests 🧪

- [ ] Write opportunity CRUD tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 7: RFPs Module (Week 9)

## 7.1 RFPs CRUD

- [ ] Create RFP types
  **Verify:** `npm run typecheck` ✓

- [ ] Create RFP validators
  **Verify:** `npm run typecheck` ✓

- [ ] Create RFPs API routes
  **Verify:** `npm run verify` ✓

- [ ] Create `useRfps` hook
  **Verify:** `npm run typecheck` ✓

## 7.2 RFPs UI

- [ ] Create RFPs list page
  **Verify:** `npm run verify` ✓

- [ ] Create RFP calendar view
  **Verify:** `npm run verify` ✓

- [ ] Create RFP detail page
  **Verify:** `npm run verify` ✓

- [ ] Create RFP form (with custom fields)
  **Verify:** `npm run verify` ✓

## 7.3 RFPs Tests 🧪

- [ ] Write RFP CRUD tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 8: Schema Manager (Weeks 10-11)

## 8.1 Schema Manager API

- [ ] Create field definition types
  **Verify:** `npm run typecheck` ✓

- [ ] Create field definition validators
  **Verify:** `npm run typecheck` ✓

- [ ] Create schema API routes
  - GET/POST fields
  - PATCH/DELETE individual field
  **Verify:** `npm run verify` ✓

## 8.2 Schema Manager UI

- [ ] Create schema manager page (`settings/schema`)
  **Verify:** `npm run verify` ✓

- [ ] Create field list component (system + custom)
  **Verify:** `npm run verify` ✓

- [ ] Create add/edit field modal
  **Verify:** `npm run verify` ✓

- [ ] Create delete field confirmation modal (type "DELETE field_name")
  **Verify:** `npm run verify` ✓

## 8.3 Schema Manager Tests 🧪

- [ ] Write schema manager tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 9: OpenRouter Integration (Weeks 12-13)

## 9.1 OpenRouter Client

- [ ] Create OpenRouter client (`lib/openrouter/client.ts`) ⚠️
  **Verify:** `npm run typecheck` ✓

- [ ] Create structured output helper
  **Verify:** `npm run typecheck` ✓

- [ ] Create research prompt builder
  **Verify:** `npm run typecheck` ✓

## 9.2 Research API

- [ ] Create research types
  **Verify:** `npm run typecheck` ✓

- [ ] Create research API routes (run, history)
  **Verify:** `npm run verify` ✓

## 9.3 Research UI

- [ ] Create research panel component
  **Verify:** `npm run verify` ✓

- [ ] Create research results review UI
  **Verify:** `npm run verify` ✓

## 9.4 Research with Custom Fields

- [ ] Integrate custom fields into research prompts (dynamic JSON schema)
  **Verify:** `npm run verify` ✓

- [ ] Create apply research results function (system → columns, custom → JSONB)
  **Verify:** `npm run verify` ✓

## 9.5 Research Tests 🧪

- [ ] Write research integration tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 10: FullEnrich Integration (Week 14)

## 10.1 FullEnrich Client

- [ ] Create FullEnrich client ⚠️
  **Verify:** `npm run typecheck` ✓

## 10.2 Enrichment API

- [ ] Create enrichment_jobs table (Migration 020)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create enrichment API routes
  **Verify:** `npm run verify` ✓

- [ ] Create webhook handler
  **Verify:** `npm run verify` ✓

## 10.3 Enrichment UI

- [ ] Create enrich button for people
  **Verify:** `npm run verify` ✓

- [ ] Create bulk enrich functionality
  **Verify:** `npm run verify` ✓

## 10.4 Enrichment Tests 🧪

- [ ] Write enrichment tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 11: Gmail Integration (Weeks 15-17)

## 11.1 Gmail OAuth

- [ ] Configure Google Cloud OAuth ⚠️
  **Verify:** Credentials created ✓

- [ ] Create Gmail OAuth routes (connect, callback)
  **Verify:** `npm run verify` ✓

- [ ] Create gmail_connections table (Migration 021)
  **Verify:** `npm run db:migrate` ✓

## 11.2 Gmail Service

- [ ] Create Gmail service (`lib/gmail/service.ts`)
  **Verify:** `npm run typecheck` ✓

- [ ] Create send email function
  **Verify:** `npm run typecheck` ✓

- [ ] Create tracking injection (pixel, link wrapping)
  **Verify:** `npm run typecheck` ✓

## 11.3 Email Tracking

- [ ] Create sent_emails table (Migration 022)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create email_events table (Migration 023)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create tracking endpoints (open, click)
  **Verify:** `npm run verify` ✓

## 11.4 Gmail UI

- [ ] Create Gmail connection settings
  **Verify:** `npm run verify` ✓

- [ ] Create send email modal
  **Verify:** `npm run verify` ✓

## 11.5 Gmail Tests 🧪

- [ ] Write Gmail integration tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 12: Email Sequences (Weeks 18-20)

## 12.1 Sequences Database

- [ ] Create sequences table (Migration 024)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create sequence_steps table (Migration 025)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create sequence_enrollments table (Migration 026)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create signatures table (Migration 027)
  **Verify:** `npm run db:migrate` ✓

## 12.2 Sequences API

- [ ] Create sequences API routes
  **Verify:** `npm run verify` ✓

- [ ] Create steps API routes
  **Verify:** `npm run verify` ✓

- [ ] Create enrollments API routes
  **Verify:** `npm run verify` ✓

## 12.3 AI Email Generation

- [ ] Create email generation prompts
  **Verify:** `npm run typecheck` ✓

- [ ] Create variable resolution system
  **Verify:** `npm run typecheck` ✓

- [ ] Create AI generation function
  **Verify:** `npm run verify` ✓

## 12.4 Sequence Execution

- [ ] Create sequence processor job
  **Verify:** `npm run typecheck` ✓

- [ ] Create reply detection job
  **Verify:** `npm run typecheck` ✓

- [ ] Create rate limiter (Redis/Upstash)
  ```bash
  npm install @upstash/redis
  ```
  **Verify:** `npm run verify` ✓

## 12.5 Sequences UI

- [ ] Create sequences list page
  **Verify:** `npm run verify` ✓

- [ ] Create sequence builder (steps, variables, AI)
  **Verify:** `npm run verify` ✓

- [ ] Create enrollment modal
  **Verify:** `npm run verify` ✓

- [ ] Create sequence analytics view
  **Verify:** `npm run verify` ✓

## 12.6 Sequences Tests 🧪

- [ ] Write sequence tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 13: Dashboard (Week 21)

## 13.1 Dashboard API

- [ ] Create dashboard stats RPC function (Migration 030)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create dashboard API route
  **Verify:** `npm run verify` ✓

## 13.2 Dashboard UI

- [ ] Create dashboard page
  **Verify:** `npm run verify` ✓

- [ ] Create pipeline widget
  **Verify:** `npm run verify` ✓

- [ ] Create tasks widget
  **Verify:** `npm run verify` ✓

- [ ] Create RFP deadlines widget
  **Verify:** `npm run verify` ✓

- [ ] Create research health widget
  **Verify:** `npm run verify` ✓

- [ ] Create activity feed widget
  **Verify:** `npm run verify` ✓

## 13.3 Dashboard Tests 🧪

- [ ] Write dashboard tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 14: Tasks System (Week 22)

## 14.1 Tasks Database

- [ ] Create tasks table (Migration 031)
  **Verify:** `npm run db:migrate` ✓

## 14.2 Tasks API

- [ ] Create tasks API routes
  **Verify:** `npm run verify` ✓

## 14.3 Tasks UI

- [ ] Create tasks list page
  **Verify:** `npm run verify` ✓

- [ ] Create task form modal
  **Verify:** `npm run verify` ✓

- [ ] Create task quick-add from entity pages
  **Verify:** `npm run verify` ✓

## 14.4 Tasks Tests 🧪

- [ ] Write tasks tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 15: Global Search (Week 23)

## 15.1 Search Database

- [ ] Create global_search function (Migration 032)
  **Verify:** `npm run db:migrate` ✓

## 15.2 Search API

- [ ] Create search API route
  **Verify:** `npm run verify` ✓

## 15.3 Search UI

- [ ] Create command palette (⌘K)
  **Verify:** `npm run verify` ✓

- [ ] Create search results component
  **Verify:** `npm run verify` ✓

## 15.4 Search Tests 🧪

- [ ] Write search tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 16: Notes System (Week 23)

## 16.1 Notes Database

- [ ] Create notes table (Migration 033)
  **Verify:** `npm run db:migrate` ✓

## 16.2 Notes API

- [ ] Create notes API routes
  **Verify:** `npm run verify` ✓

## 16.3 Notes UI

- [ ] Create notes panel for entity pages
  **Verify:** `npm run verify` ✓

- [ ] Create note editor
  **Verify:** `npm run verify` ✓

## 16.4 Notes Tests 🧪

- [ ] Write notes tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 17: Tags System (Week 24)

## 17.1 Tags Database

- [ ] Create tags + entity_tags tables (Migration 034)
  **Verify:** `npm run db:migrate` ✓

## 17.2 Tags API

- [ ] Create tags API routes
  **Verify:** `npm run verify` ✓

## 17.3 Tags UI

- [ ] Create tag badge component
  **Verify:** `npm run verify` ✓

- [ ] Create tag input/selector
  **Verify:** `npm run verify` ✓

- [ ] Create tag management settings
  **Verify:** `npm run verify` ✓

## 17.4 Tags Tests 🧪

- [ ] Write tags tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 18: Email Templates (Week 24)

## 18.1 Templates Database

- [ ] Create email_templates table (Migration 035)
  **Verify:** `npm run db:migrate` ✓

## 18.2 Templates API

- [ ] Create templates API routes
  **Verify:** `npm run verify` ✓

## 18.3 Templates UI

- [ ] Create templates list page
  **Verify:** `npm run verify` ✓

- [ ] Create template editor
  **Verify:** `npm run verify` ✓

- [ ] Create template picker in send email modal
  **Verify:** `npm run verify` ✓

## 18.4 Templates Tests 🧪

- [ ] Write templates tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 19: Notifications (Week 25)

## 19.1 Notifications Database

- [ ] Create notifications table (Migration 036)
  **Verify:** `npm run db:migrate` ✓

- [ ] Create notification_preferences table (Migration 037)
  **Verify:** `npm run db:migrate` ✓

## 19.2 Notifications API

- [ ] Create notifications API routes
  **Verify:** `npm run verify` ✓

- [ ] Create notification trigger functions
  **Verify:** `npm run verify` ✓

## 19.3 Notifications UI

- [ ] Create notification bell component
  **Verify:** `npm run verify` ✓

- [ ] Create notifications dropdown
  **Verify:** `npm run verify` ✓

- [ ] Create notification preferences settings
  **Verify:** `npm run verify` ✓

## 19.4 Notifications Tests 🧪

- [ ] Write notifications tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 20: CSV Import (Week 26)

## 20.1 Import Database

- [ ] Create import_jobs table (Migration 038)
  **Verify:** `npm run db:migrate` ✓

## 20.2 Import API

- [ ] Create import API routes
  ```bash
  npm install papaparse
  npm install -D @types/papaparse
  ```
  **Verify:** `npm run verify` ✓

## 20.3 Import UI

- [ ] Create import wizard (upload, map, preview)
  **Verify:** `npm run verify` ✓

- [ ] Create column mapper component
  **Verify:** `npm run verify` ✓

## 20.4 Import Tests 🧪

- [ ] Write import tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 21: Duplicate Detection (Week 26)

## 21.1 Duplicate Detection Database

- [ ] Create duplicate detection functions (Migration 039)
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```
  **Verify:** `npm run db:migrate` ✓

## 21.2 Duplicate Detection API

- [ ] Create duplicate check API routes
  **Verify:** `npm run verify` ✓

## 21.3 Duplicate Detection UI

- [ ] Create duplicate warning modal
  **Verify:** `npm run verify` ✓

- [ ] Integrate into create forms
  **Verify:** `npm run verify` ✓

## 21.4 Duplicate Detection Tests 🧪

- [ ] Write duplicate detection tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 22: Activities System (Week 27)

## 22.1 Activities Database

- [ ] Create activities table (Migration 040)
  **Verify:** `npm run db:migrate` ✓

## 22.2 Activities Integration

- [ ] Create activity logging helper
  **Verify:** `npm run typecheck` ✓

- [ ] Add activity logging to all CRUD operations
  **Verify:** `npm run verify` ✓

## 22.3 Activities UI

- [ ] Create activity timeline component
  **Verify:** `npm run verify` ✓

## 22.4 Activities Tests 🧪

- [ ] Write activities tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 23: Settings (Week 27)

## 23.1 Settings Pages

- [ ] Create settings layout
  **Verify:** `npm run verify` ✓

- [ ] Create general settings page
  **Verify:** `npm run verify` ✓

- [ ] Create team members page
  **Verify:** `npm run verify` ✓

- [ ] Create API keys settings
  **Verify:** `npm run verify` ✓

- [ ] Create Gmail connection settings
  **Verify:** `npm run verify` ✓

- [ ] Create notification preferences
  **Verify:** `npm run verify` ✓

## 23.2 Settings Tests 🧪

- [ ] Write settings tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 24: Security Audit (Week 28)

## 24.1 RLS Audit 🔒

- [ ] Verify RLS on ALL tables
  ```sql
  SELECT tablename FROM pg_tables 
  WHERE schemaname = 'public' AND rowsecurity = false;
  -- Must return 0 rows
  ```
  **Verify:** Query returns empty ✓

- [ ] Test RLS policies manually
  **Verify:** Manual testing passed ✓

## 24.2 Input Validation Audit 🔒

- [ ] Verify Zod validation on ALL API routes
  **Verify:** Code review complete ✓

- [ ] Verify no raw SQL (parameterized only)
  **Verify:** Code review complete ✓

## 24.3 Secret Management Audit 🔒

- [ ] Verify no secrets in client code
  **Verify:** No client exposure ✓

- [ ] Verify .env.local in .gitignore
  **Verify:** Checked ✓

## 24.4 Security Tests 🧪

- [ ] Write security tests
  **Verify:** `npm run test` → all pass ✓

---

# Phase 25: Performance & Polish (Week 28)

## 25.1 Performance Audit

- [ ] Run Lighthouse audit
  **Verify:** Score > 90 ✓

- [ ] Add loading states everywhere
  **Verify:** Manual review complete ✓

- [ ] Add error boundaries
  **Verify:** `npm run verify` ✓

## 25.2 UX Polish

- [ ] Verify all forms have validation messages
  **Verify:** Manual review ✓

- [ ] Verify all destructive actions have confirmations
  **Verify:** Manual review ✓

- [ ] Verify all empty states designed
  **Verify:** Manual review ✓

- [ ] Verify dark mode everywhere
  **Verify:** Manual testing ✓

- [ ] Verify responsive design
  **Verify:** Manual testing ✓

## 25.3 Final Verification

- [ ] Run full test suite
  ```bash
  npm run verify
  ```
  **Verify:** All checks pass ✓

- [ ] Run production build
  ```bash
  npm run build && npm run start
  ```
  **Verify:** Production build works ✓

---

# Deployment Checklist

- [ ] All tests passing
- [ ] TypeScript errors: 0
- [ ] ESLint errors: 0
- [ ] Build succeeds
- [ ] Environment variables set in hosting
- [ ] Supabase production project ready
- [ ] Migrations run on production
- [ ] OAuth redirect URLs updated
- [ ] Deploy to Vercel
- [ ] Verify production works
- [ ] Set up error monitoring

---

# Completion Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Project Setup | ⏳ |
| 1 | Supabase Foundation | ⏳ |
| 2 | Authentication | ⏳ |
| 3 | Project Management | ⏳ |
| 4 | Organizations | ⏳ |
| 5 | People | ⏳ |
| 6 | Opportunities | ⏳ |
| 7 | RFPs | ⏳ |
| 8 | Schema Manager | ⏳ |
| 9 | OpenRouter | ⏳ |
| 10 | FullEnrich | ⏳ |
| 11 | Gmail | ⏳ |
| 12 | Sequences | ⏳ |
| 13 | Dashboard | ⏳ |
| 14 | Tasks | ⏳ |
| 15 | Global Search | ⏳ |
| 16 | Notes | ⏳ |
| 17 | Tags | ⏳ |
| 18 | Email Templates | ⏳ |
| 19 | Notifications | ⏳ |
| 20 | CSV Import | ⏳ |
| 21 | Duplicate Detection | ⏳ |
| 22 | Activities | ⏳ |
| 23 | Settings | ⏳ |
| 24 | Security Audit | ⏳ |
| 25 | Polish & Deploy | ⏳ |

---

**Total Tasks:** ~250
**Total Weeks:** 28
**Golden Rule:** `npm run verify` must pass after EVERY task.

---

*Fix it before you move on.*
