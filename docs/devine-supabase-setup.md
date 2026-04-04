# Devine Supabase Setup (Dedicated Project)

This document describes the minimum, safe steps to stand Devine up on its own Supabase project.
It explicitly avoids touching any other project and does not require resets.

## Required Supabase Environment Variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- (Optional) `SUPABASE_SERVICE_ROLE_KEY`
- (Optional) `DATABASE_URL` (for psql or automated SQL tooling)

## Canonical SQL Sources in This Repo
- Schema: `C:\Users\Robin\Documents\Devine\supabase\schema.sql`
- Seed data: `C:\Users\Robin\Documents\Devine\supabase\seed-devine.sql`

## Important Note About Migrations
Legacy migrations from an unrelated project must not be applied to Devine.
Use `schema.sql` and `seed-devine.sql` as the authoritative setup scripts.

## Exact Setup Order (No Resets)
1. Create a **new dedicated** Supabase project for Devine.
2. In Supabase SQL Editor, run `schema.sql` (entire file).
3. In Supabase SQL Editor, run `seed-devine.sql`.
4. In the Devine app environment, set:
   - `NEXT_PUBLIC_SUPABASE_URL` (from the new Devine project)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from the new Devine project)
   - `SUPABASE_SERVICE_ROLE_KEY` (optional, only if needed)
   - `DATABASE_URL` (optional, only for SQL tooling)

## Minimal Manual Verification Checklist
- Auth works: create a user and sign in.
- Dashboard loads without errors.
- Create a Program.
- Create a Course, Module, Assignment, and Reading.
- Program audit page loads and shows requirement blocks.
- Seeded courses appear as expected (if seed was run).
- Submissions and critiques can be created.

## Separation Safety Checklist
- Verify the Supabase URL and anon key belong to the **new Devine** project.
- Confirm no other project is referenced in any `.env` or runtime config.
- Do not run `supabase db reset` or any destructive commands.
