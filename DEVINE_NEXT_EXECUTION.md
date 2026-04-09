# Devine College Core — Next Execution

Live database convergence. No new features until this is done.

## SQL Run Order

Paste each block into the Supabase SQL Editor and run in order.
Each block is idempotent. Safe to run more than once.

**SQL Editor:** https://supabase.com/dashboard/project/svaszepvxchsrzqwadii/sql

1. `supabase/convergence-block-1-tables.sql` — Creates 6 missing tables + current_course_id column
2. `supabase/convergence-block-2-functions.sql` — Creates private schema, thesis functions, triggers, RLS policies
3. `supabase/convergence-block-3-seed.sql` — Seeds Term 1, term courses, enrollment state, assignment schedule, THEO 510 Module 4

## Verification

After all 3 blocks succeed, paste and run `supabase/convergence-verify.sql`.

Expected results:

| check_name | expected |
|---|---|
| academic_terms (current) | 1 |
| term_courses | 2 |
| term_assignment_schedule | >0 |
| thesis_projects (table exists) | 0 |
| thesis_milestones (table exists) | 0 |
| review_links (table exists) | 0 |
| submission_evaluations (pre-existing) | 0 |
| concepts (pre-existing) | 0 |
| program_members.current_course_id | PHIL 501 |
| term_1_courses | HIST 520, PHIL 501 |
| theo510_module4_readings | 3 |
| private_schema_exists | YES |

## Post-SQL Smoke Test

After verification passes:

1. Open the app locally (`npm run dev`)
2. Sign in as robinhowley@icloud.com
3. Check dashboard — should show Term 1 with PHIL 501 + HIST 520, not "No active term"
4. Check /term/review — should render the Term Review Packet with real dates
5. Check /programs/{id}/research — should render Research Register (thesis tables exist, 0 projects)
6. Check /admin/review-links — should show the review link admin (not the "Configuration Required" message)

## Service Role Key

The external review system and admin operations require SUPABASE_SERVICE_ROLE_KEY.

1. Go to https://supabase.com/dashboard/project/svaszepvxchsrzqwadii/settings/api
2. Copy the **service_role** key (the secret one, not the anon key)
3. Set it in `.env.local`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=<paste here>
   ```
4. Restart the dev server
5. If deployed to Vercel: add the same key as an environment variable in the Vercel dashboard

Without this key, the review token pages return 404 and the admin review-links page shows a configuration-required message.

## What This Unblocks

After convergence + service role key:
- Student portal shows live term data
- Term review packet renders with real schedule
- Admin thesis governance is operational
- External review link system is functional
- Review packet pages render with live institutional truth
