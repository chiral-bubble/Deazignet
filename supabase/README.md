# Dezignet Supabase Database Setup & Migrations

This directory contains the database schema, security rules, triggers, views, and Row-Level Security (RLS) migrations for Dezignet.

---

## Migration Files

The migrations are sequentially numbered in `/supabase/migrations/`:

### Phase 1: Authentication & Profiles
| File | Purpose |
| :--- | :--- |
| `001_auth_profiles.sql` | Enums (`user_role`, `professional_type`, `credential_status`), `profiles` table, `auth.users` trigger for signup whitelist, role protection. |
| `002_designer_profiles.sql` | `designer_profiles` table, constraints (bio max 600 chars, non-negative numbers), auto-init trigger. |
| `003_portfolio.sql` | `portfolio_projects` & `portfolio_images` tables, foreign keys, indexes, cascades. |
| `004_credentials.sql` | `credentials` table, administrative review field protection trigger, auto-reset to pending upon editing verified credentials. |
| `005_profile_completeness.sql` | Server-side `get_profile_completeness(uuid)` SQL function computing score & checklist. |
| `006_public_views.sql` | Safe security barrier views (`public_designer_profiles`, `public_portfolio`, `public_credentials`) with phone/email exclusion and masked numbers. |
| `007_rls_policies.sql` | Row Level Security enabled on all Phase 1 tables, owner-only checks using `(SELECT auth.uid())`, admin overrides. |
| `phase1_all.sql` | Combined all-in-one Phase 1 migration script. |

### Phase 2: Client Projects & Designer Proposals
| File | Purpose |
| :--- | :--- |
| `008_phase2_enums_settings.sql` | Enums (`project_status`, `payment_type`, `proposal_status`, `plan_tier`), `app_settings`, `plan_limits`, and `designer_profiles.plan` protection trigger. |
| `009_client_profiles_projects.sql` | `client_profiles`, `projects` (with full-text search tsvector & GIN index), `project_milestones`, `project_images`, and lifecycle enforcement triggers. |
| `010_project_rls_views.sql` | Project RLS policies, security-barrier `open_projects` view, and privacy-preserving `client_summaries` view. |
| `011_proposals.sql` | `proposals`, `proposal_milestones`, `proposal_portfolio_items` (max 5), `proposal_events`, `proposal_versions`, and core business logic functions (`submit_proposal`, `update_proposal`, `withdraw_proposal`, `mark_proposal_viewed`, `shortlist_proposal`, `decline_proposal`, `proposal_usage`). |
| `012_proposal_rls.sql` | Proposal RLS policies, `saved_projects`, `saved_designers`, full-text search view on `public_designer_profiles`, and function grants. |
| `008_through_012_phase2_all.sql` | Combined all-in-one Phase 2 migration script for single-click execution. |

---

## How to Apply Phase 2 Migrations

### Recommended: Supabase Dashboard SQL Editor
1. Open your project on Supabase: [https://supabase.com/dashboard/project/hnssctjagfwdfbagpikv/sql](https://supabase.com/dashboard/project/hnssctjagfwdfbagpikv/sql)
2. Click **New query** (the `+` tab).
3. Open `supabase/migrations/008_through_012_phase2_all.sql`.
4. Copy all contents, paste into the query window, and click **Run**.

---

## Phase 2 Database Functions & Typed Error Codes

### `submit_proposal(...)`
Submits a proposal enforcing all 7 platform rules atomically:
- `limit_reached`: Monthly proposal limit exceeded for the designer's plan tier.
- `profile_incomplete`: Profile completeness score is below 60%.
- `already_applied`: Designer already submitted a proposal for this project.
- `project_closed`: Project is not open for proposals or does not exist.
- `invalid_percentages`: Milestone fee percentages do not total 100%.
- `invalid_hourly_fields`: Hourly project proposal lacks positive hourly rate.

### `update_proposal(...)`
Edits a pending proposal before client view:
- `not_editable`: Proposal has already been viewed by client, or status is no longer pending.

### `withdraw_proposal(...)`
Allows designer to withdraw a proposal while in `pending`, `viewed`, or `shortlisted` status.

### Client Simulation Functions
- `mark_proposal_viewed(p_proposal_id)`: Marks proposal viewed and writes timeline event.
- `shortlist_proposal(p_proposal_id)`: Moves proposal to shortlisted.
- `decline_proposal(p_proposal_id, p_reason)`: Declines proposal with explanation.

---

## Seeding & Running Tests

### 1. Seed Phase 2 Data
```bash
npx tsx scripts/seed-phase2.ts
```
Seeds:
- 4 Nigerian clients (`client1@dezignet.test` through `client4@dezignet.test`, password `Password123!`).
- 12 realistic Nigerian architectural projects across Lagos, Abuja, Port Harcourt, and Kano (mix of milestone and hourly, 1 awarded, 1 closed, 2 drafts, 8 open).
- Proposals from test designers in every status (`pending`, `viewed`, `shortlisted`, `declined`, `withdrawn`).

### 2. Run Phase 2 Security & Logic Test Suite
```bash
npx tsx scripts/test-phase2.ts
```
Verifies all 10 security assertions:
1. Base `projects` table direct access lockdown & `open_projects` view isolation.
2. Privacy enforcement in `client_summaries` (no email/phone/address, only initial of surname).
3. Cross-designer proposal isolation (no reading other proposals or pricing).
4. Submission rule validations (`limit_reached`, `profile_incomplete`, `already_applied`, `invalid_percentages`).
5. Direct table mutation denial (must use security definer functions).
6. Proposal edit locking after client view.
7. Cross-client action isolation (clients cannot touch other clients' proposals).
8. Saved projects and saved designers privacy per user.
9. Anonymous request denial across all tables and views.
10. Milestone 100% total validation before a project can open.

### 3. Simulate Client Actions (CLI Helper)
```bash
npx tsx scripts/simulate-client-action.ts view <proposalId>
npx tsx scripts/simulate-client-action.ts shortlist <proposalId>
npx tsx scripts/simulate-client-action.ts decline <proposalId> "Scope not aligned"
```
