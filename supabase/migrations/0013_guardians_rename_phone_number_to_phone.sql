-- Reverts an untracked "0011_guardians_table" migration (applied directly
-- against the database, never committed here) that renamed
-- guardians.phone to guardians.phone_number. Every consumer — the
-- notify-guardians edge function's `select("name, phone")`, the app's
-- Guardian type / useGuardians hook, GuardianFormScreen — expects `phone`,
-- and the rename was never reflected in any of them. That mismatch is what
-- was causing notify-guardians to 500 (Postgres: column "phone" does not
-- exist) on every invocation, and silently broke guardian add/edit in the
-- app too (writes/reads against a column that no longer existed).
alter table public.guardians rename column phone_number to phone;
