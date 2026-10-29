# Dezignet Supabase Database Setup & Migrations (Phase 1)

This directory contains the database schema, security rules, triggers, views, and Row-Level Security (RLS) migrations for Phase 1 of Dezignet (Authentication, Profiles, Designer Profiles, Portfolio, and Credentials).

---

## Migration Files

The migrations are sequentially numbered in `/supabase/migrations/`:

| File | Purpose |
| :--- | :--- |
| `001_auth_profiles.sql` | Enums (`user_role`, `professional_type`, `credential_status`), `profiles` table, `auth.users` trigger for signup whitelist, role protection. |
| `002_designer_profiles.sql` | `designer_profiles` table, constraints (bio max 600 chars, non-negative numbers), auto-init trigger. |
| `003_portfolio.sql` | `portfolio_projects` & `portfolio_images` tables, foreign keys, indexes, cascades. |
| `004_credentials.sql` | `credentials` table, administrative review field protection trigger, auto-reset to pending upon editing verified credentials. |
| `005_profile_completeness.sql` | Server-side `get_profile_completeness(uuid)` SQL function computing score & checklist. |
| `006_public_views.sql` | Safe security barrier views (`public_designer_profiles`, `public_portfolio`, `public_credentials`) with phone/email exclusion and masked numbers. |
| `007_rls_policies.sql` | Row Level Security enabled on all tables, owner-only checks using `(SELECT auth.uid())`, admin overrides. |
| `phase1_all.sql` | Combined all-in-one migration script for single-click execution in Supabase SQL Editor. |

---

## How to Apply Migrations

### Method 1: Supabase Dashboard SQL Editor (Recommended & Fastest)
1. Open your project on Supabase: [https://supabase.com/dashboard/project/hnssctjagfwdfbagpikv/sql](https://supabase.com/dashboard/project/hnssctjagfwdfbagpikv/sql)
2. Click **New query** (or the `+` tab).
3. Open `supabase/migrations/phase1_all.sql`.
4. Copy all contents, paste into the query window, and click **Run**.

### Method 2: Supabase CLI
If using the Supabase CLI locally:
```bash
# Link your project
supabase link --project-ref hnssctjagfwdfbagpikv

# Push migrations
supabase db push
```

---

## Seeding & Testing Phase 1

Once migrations are applied:

1. **Seed Development Users**:
   ```bash
   npx tsx scripts/seed-phase1.ts
   ```
   This creates:
   - `designer.new@dezignet.test` (Password: `Password123!`) — New designer with empty profile.
   - `designer.complete@dezignet.test` (Password: `Password123!`) — Complete designer with verified credentials and portfolio.
   - `client@dezignet.test` (Password: `Password123!`) — Client user.
   - 12 additional discoverable designers for talent search.

2. **Run Automated Security & Logic Tests**:
   ```bash
   npx tsx scripts/test-phase1.ts
   ```
   Tests RLS isolation, role protection, credential reset triggers, and public view projections.

