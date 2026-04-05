# Devine Live Verification Note

Date:
Environment: live Devine Supabase project

## Schema application
- Applied `supabase/schema.sql` in live SQL Editor: YES / NO
- Errors during apply: NONE / [describe exactly]

## Object verification
### Functions
- `create_thesis_project_with_milestones`: PRESENT / MISSING
- `private.enforce_thesis_course`: PRESENT / MISSING

### Trigger
- `thesis_projects_course_guard`: PRESENT / MISSING

## Thesis admin smoke
- Open `/admin/thesis`: PASS / FAIL
- Create RSYN 720 thesis project via UI: PASS / FAIL
- Canonical milestones auto-created in correct order: PASS / FAIL
- Duplicate active thesis project blocked: PASS / FAIL
- Non-RSYN-720 scope blocked: PASS / FAIL

## Thesis truth smoke
- Editable thesis core fields behave correctly: PASS / FAIL
- Freeform status editing unavailable: PASS / FAIL
- Derived status displays correctly: PASS / FAIL
- Final milestones blocked without final-locked submission: PASS / FAIL

## Review-link smoke
- Create review link via UI: PASS / FAIL
- Plaintext token shown once: PASS / FAIL
- Logged-out review route renders packet only: PASS / FAIL
- No mutation/admin path reachable from review mode: PASS / FAIL
- Revoked link fails closed: PASS / FAIL

## Warnings
- Multiple lockfile warning still present during build: YES / NO
- Other warnings: NONE / [describe exactly]

## Conclusion
- Live DB and app behavior aligned: YES / NO
- Thesis governance operational without SQL: YES / NO
- Review-link issuance operational without SQL: YES / NO
