# GoodRev CRM — Product Overview

**The AI-native revenue operations platform built for teams that close complex deals.**

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 + React 19 (TypeScript, App Router) |
| **Database** | Supabase (PostgreSQL) with Row Level Security |
| **Auth** | Supabase Auth (OAuth, session cookies) |
| **State** | TanStack Query 5 + Zustand 5 |
| **AI** | OpenRouter (Claude 3.5 Sonnet, GPT-4o, Gemini Pro, Llama 3.1) |
| **UI** | Radix UI + Tailwind CSS 4 + Recharts 3 |
| **Validation** | Zod 4 (31 schema modules) |

---

## Core CRM

- **Multi-project workspaces** with role-based access (owner / admin / member / viewer)
- **Organizations & People** — full contact and company management with many-to-many relationships
- **Opportunities pipeline** — stage-based deal tracking with value, probability, and close dates
- **Custom fields** — define per-project schemas with dynamic field types
- **Global search** — full-text search across every entity in a project
- **Activity log** — complete audit trail of every create, update, and delete
- **Tags & labels** — flexible categorization across all entities
- **Bulk operations** — mass update, tag, and manage records at scale

---

## AI-Powered Intelligence

- **Deep research** — one-click AI research on any organization or contact, with results you can apply directly to records
- **Contact discovery** — find new contacts matching target roles using LLM-powered web research
- **RFP question extraction** — upload an RFP PDF and automatically parse it into structured questions
- **RFP response generation** — generate draft answers using your content library as context
- **Content restructuring** — LLM-powered reorganization of uploaded documents into reusable library sections
- **Email sequence generation** — auto-generate multi-step outreach sequences
- **Usage tracking** — full visibility into AI token consumption by feature and model

---

## Email & Sequences

- **Gmail OAuth integration** — connect per-user Gmail accounts for native send and sync
- **Inbound email sync** — pull emails from Gmail and match them to CRM contacts
- **Pixel tracking** — track opens, clicks, bounces, and replies on every outbound email
- **Email sequences** — multi-step automated outreach with configurable delays (minutes to weeks)
- **Stop-on-reply** — sequences pause automatically when a prospect responds
- **Template variables** — dynamic field interpolation (name, company, custom fields) in every email
- **Email analytics** — open rate, click rate, reply rate, and per-contact engagement history

---

## Workflow Automation

A full event-driven automation engine with:

- **31 trigger types** — entity CRUD, pipeline stage changes, email events, task completion, meeting outcomes, news alerts, and time-based conditions (inactivity, overdue, approaching close dates)
- **13 action types** — create tasks, update fields, change stages, assign owners, send emails, enroll in sequences, add/remove tags, fire webhooks, run AI research, and more
- **Conditional logic** — 10 comparison operators with multi-condition AND evaluation, including custom field support
- **Safety guardrails** — chain depth limiting (max 3 levels), 60-second cooldowns, execution logging, and dry-run testing

---

## RFP Management

- **RFP intake** — create and track RFPs through a full status lifecycle
- **PDF parsing** — extract text from uploaded RFP documents
- **Question extraction** — AI-powered parsing of RFP questions from unstructured documents
- **Content library** — maintain a searchable library of reusable response sections
- **Bulk generation** — generate answers to multiple RFP questions in a single pass
- **Question comments** — collaborate on answers with threaded comments
- **Print view** — formatted export-ready RFP response layout

---

## News & Competitive Intelligence

- **Keyword tracking** — define keywords per project and monitor news across the web
- **Article feed** — automated article fetching via EventRegistry with deduplication
- **Entity matching** — link articles to organizations in your CRM automatically
- **Sentiment analysis** — surface positive and negative coverage
- **Token budgeting** — track and control news API usage

---

## Data Enrichment & Import

- **FullEnrich integration** — enrich contacts with phone numbers, emails, and LinkedIn profiles
- **EPA ECHO import** — pull wastewater treatment facility data directly from the EPA database
- **CSV / XLSX / JSON export** — export any entity list in multiple formats
- **Bulk import** — import contacts, organizations, and opportunities from files

---

## Collaboration

- **Project memberships** — invite team members with granular role permissions
- **Entity comments** — threaded discussions on any organization, person, opportunity, or RFP
- **Task management** — create, assign, and track tasks linked to any entity
- **Meeting records** — log meetings with attendees, notes, and structured outcomes
- **Follow-up tracking** — surface overdue and upcoming follow-up activities

---

## Analytics & Reporting

- **Dashboard tiles** — calls, emails, conversations, meetings booked and attended
- **Opportunity funnel** — visualize pipeline stages with value breakdowns
- **RFP funnel** — track proposal status distribution
- **Conversion metrics** — monthly won / lost / open rates
- **Revenue metrics** — closed won, expected value, average deal size
- **Email performance** — aggregate and per-contact engagement analytics
- **AI usage dashboard** — token consumption by feature and model

---

## Security & Architecture

- **Row Level Security** on every table — project-level data isolation enforced at the database layer
- **Role-based access control** — owner, admin, member, viewer with per-project scoping
- **SSRF protection** on outbound webhooks
- **53 idempotent database migrations** — production-ready schema evolution
- **Service role separation** — admin operations isolated from user-facing queries
- **Protected fields** — automation engine prevents mutation of system fields

---

## By the Numbers

| Metric | Count |
|--------|-------|
| API endpoints | 121 |
| Database migrations | 53 |
| Custom hooks | 19 |
| Zustand stores | 10 |
| Zod validators | 31 |
| Automation trigger types | 31 |
| Automation action types | 13 |
| Supported LLM models | 6 |
| UI component directories | 35+ |

---

*Built with Next.js 16, React 19, Supabase, and a multi-model AI backbone. Designed for teams running complex B2B sales cycles who need intelligence, automation, and control in one platform.*
