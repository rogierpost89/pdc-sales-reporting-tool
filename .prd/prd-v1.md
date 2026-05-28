---
version: 1
status: built
date: 2026-05-28
author: Rogier
previous: none
---

# PDC Sales Reporting Tool — PRD v1

## 1. Problem

The commercial team at Spirited Union manually extracts, consolidates, and cleans sales and activity data from three disconnected platforms every week: Exact Online (wholesale invoicing and revenue), WooCommerce (both D2C e-commerce and B2B wholesale via the PDC website), and Pipedrive (account manager activities and pipeline). This process is time-consuming, error-prone, and produces reports too slowly to act on. Brand partners receive no live visibility into their own performance data and rely on manually produced summaries. Without a unified reporting layer, commercial decisions are made on stale data, and brand relationships lack the transparency partners increasingly expect.

---

## 2. Solution

A web-based sales intelligence platform that ingests data from Exact Online, WooCommerce, and Pipedrive — via manual CSV/Excel upload now, live API connections later — and transforms it into a single unified data model. Four AI ingestion agents (one per source, plus a general-purpose fallback) handle parsing and normalisation automatically, eliminating manual column mapping. The platform serves three roles: an admin dashboard with full commercial metrics and filters; an account manager view showing their own activity performance by brand; and a brand partner portal with real-time access to their brand's data and self-serve report downloads. Scheduled reports (weekly, monthly, quarterly, annual) are generated automatically as styled web documents — in Spirited Union branding with each partner's logo — and made available for partners to save as PDF directly from their portal. At the end of every month and quarter, brand partners receive an automated email notification inviting them to log in and view their latest report. Admin and account managers can upload field images tagged to a brand under a dedicated "Highlights from the Field" section, which appears in the partner portal and in report documents.

---

## 3. Scope

| This PRD covers | This PRD does NOT cover |
|---|---|
| Manual CSV/Excel upload for all three data sources | Live API connections to Exact Online, WooCommerce, Pipedrive |
| AI ingestion agents per data source | AI-generated narrative commentary or insights |
| Unified data model in Convex | Mobile app or native clients |
| Internal admin dashboard with filters | Public-facing marketing pages |
| Account manager read-only activity view | Account managers editing or correcting ingested data |
| Highlights from the Field — admin and account managers upload images tagged to a brand, displayed in the partner portal and reports | Multi-language support |
| Brand partner portal with real-time data + field highlights | Custom report builder for ad-hoc queries |
| Scheduled report generation (weekly/monthly/quarterly/annual) | White-labelled portals per brand partner |
| Branded web report documents with PDF save | Granular permissions beyond the three defined roles |
| Automated monthly and quarterly email notifications to brand partners (with field highlights preview) | SMS or in-app push notifications |
| Role-based access control (admin, account manager, brand partner) | Sales forecasting (Phase 2) |

---

## 4. Architecture

### Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router) |
| Database + backend | Convex |
| Authentication + roles | Clerk |
| AI ingestion agents | Claude API (Anthropic SDK) |
| Email notifications | Resend |
| UI | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |

### Component structure

```
src/
├── app/
│   ├── dashboard/          # Admin — full metrics, uploads, highlights
│   ├── account/            # Account manager — activity view + highlight uploads
│   ├── partner/            # Brand partner portal — data, reports, highlights
│   └── api/                # Webhook receivers, email triggers
├── components/
│   ├── ingestion/          # Upload UI, source selector, progress states
│   ├── dashboard/          # Metric cards, filters, charts
│   ├── reports/            # Styled report document, PDF save button
│   ├── highlights/         # Upload form, image grid
│   └── email/              # Email templates (Resend + React Email)
convex/
├── schema.ts               # Unified data model
├── agents/                 # Ingestion agent actions (Exact, Pipedrive, WC, Manual)
├── ingestion.ts            # File handling, agent dispatch
├── reports.ts              # Report generation, snapshot logic
├── highlights.ts           # Image upload, brand tagging
├── notifications.ts        # Scheduled email triggers
└── crons.ts                # Weekly/monthly/quarterly/annual schedules
```

### Data model

| Table | Key fields |
|---|---|
| `users` | role (admin / account_manager / brand_partner), brand association |
| `brands` | name, logo URL, partner email(s) |
| `sales_data` | source, channel, brand, SKU, volume, revenue, date |
| `activities` | brand, account manager, type (call / tasting / event / bartender training), count, week |
| `deals` | brand, stage, value, probability, date |
| `uploads` | source, file URL, status, agent used, parsed at |
| `reports` | brand, period (weekly/monthly/quarterly/annual), snapshot data, created at |
| `highlights` | brand, image URL, caption, uploaded by, date |
| `notifications` | brand, type, sent at, report reference |

### AI ingestion agents

Each agent is a Convex action triggered on file upload. It receives the raw file, reads headers and structure, maps fields to the unified data model, and writes normalised records to the relevant Convex tables.

| Agent | Triggered by | Writes to |
|---|---|---|
| Exact Agent | Exact Online CSV upload | `sales_data` (wholesale) |
| WooCommerce Agent | WooCommerce CSV upload | `sales_data` (D2C + B2B wholesale) |
| Pipedrive Agent | Pipedrive CSV upload | `activities`, `deals` |
| Manual Agent | Any unrecognised CSV/Excel | Infers mapping, writes to best-fit tables |

### Data flow

```
File upload (admin)
      ↓
Agent dispatch (Convex action → Claude API)
      ↓
Normalised data → Convex tables
      ↓
┌─────────────────────────────────────┐
│                                     │
Admin dashboard        Brand partner portal
(full metrics)         (brand-filtered, no margins)
                              │
                       Report document
                       (branded web page
                        + field highlights)
                              │
                       "Save as PDF" (browser)
                              │
              Monthly/quarterly email → Resend
              (notification + highlights preview)
```

### Scheduled jobs

| Job | Frequency | Action |
|---|---|---|
| Weekly snapshot | Every Monday 08:00 | Creates internal report record — admin only, no partner notification |
| Monthly notification | Last day of month | Generates monthly report + sends email to brand partners via Resend |
| Quarterly notification | End of Q | Generates quarterly report + sends email to brand partners via Resend |
| Annual snapshot | 1 Jan | Creates annual report record — available in portal, no email |

---

## 5. Success Metrics

| Metric | Target |
|---|---|
| Time to generate a brand partner report | Under 30 seconds from data upload to report available |
| AI ingestion agent accuracy | Correct field mapping on first pass for known sources (Exact, Pipedrive, WooCommerce) |
| Brand partner email open rate | Tracked via Resend — baseline established in first quarter |
| Brand partner portal logins after notification | At least one login per partner per notification sent |
| Manual upload to dashboard data visible | Under 2 minutes end-to-end |
| Highlights uploaded per month | At least one per brand per account manager |
| Zero data bleed between brands | Brand partners see only their own data — verified in testing |

---

## 6. Out of Scope

- Live API connections to Exact Online, WooCommerce, and Pipedrive (Phase 2)
- Sales forecasting and weighted pipeline analysis (Phase 2)
- AI-generated narrative commentary or written insights
- Account managers editing or correcting ingested data
- Custom ad-hoc report builder
- White-labelled portals per brand partner
- Mobile app or native clients
- Multi-language support
- SMS or push notifications
- Public-facing marketing pages
- Granular permissions beyond the three defined roles (admin, account manager, brand partner)

---

## 7. Dependencies & Risks

| Dependency / Risk | Impact | Mitigation |
|---|---|---|
| Clerk — authentication provider | Auth failure blocks all three portals | Clerk has 99.99% SLA; fallback to magic link login if OAuth fails |
| Resend — transactional email | Partner notifications not delivered | Resend delivery logs monitored; failed sends retried automatically |
| Claude API — ingestion agents | Agent fails to parse an unusual file format | Manual Agent acts as fallback; admin notified of mapping errors with raw file preserved |
| Convex — database and scheduled jobs | Cron jobs miss a scheduled run | Convex retries failed functions automatically; admin dashboard shows last successful run timestamp |
| Manual CSV/Excel quality | Inconsistent headers or formatting breaks ingestion | AI agents handle variation; unresolvable files flagged for admin review rather than silently failing |
| Phase 2 API migration | Historical manual data must merge cleanly with live API data | Unified data model designed from day one to accept both sources; source field on every record tracks origin |
| COGS / margin data exposure | Brand partners must never see internal margin data | Enforced at the Convex query level, not just the UI — brand partner queries structurally exclude those fields |

---

## 8. Privacy & Security

- **Role enforcement at the data layer** — Convex queries for brand partner sessions structurally exclude margin, COGS, and other brands' data. The UI reflects this, but the restriction is not UI-dependent.
- **Brand isolation** — every record in `sales_data`, `activities`, `highlights`, and `reports` carries a `brandId`. Brand partner sessions are scoped to their `brandId` only.
- **Clerk handles all authentication** — no passwords stored in Convex. Brand partners are invited via email; account managers are provisioned by admin.
- **File uploads** — raw CSV/Excel files are stored in Convex file storage, accessible only to admin. Agents process them server-side; raw files are never exposed to brand partners or account managers.
- **Email notifications** — sent via Resend using brand partner email addresses stored in the `brands` table. No marketing use; unsubscribe link included per GDPR requirement.
- **GDPR** — platform stores personal data (names, emails, order data). Data is held within EU-compliant infrastructure (Vercel EU region, Convex EU deployment). Retention policy to be defined before launch.
