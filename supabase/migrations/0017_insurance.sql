-- Rider insurance details. Lives on emergency_profiles rather than a new
-- table: it's the same one-row-per-user, responder-relevant data the table
-- already holds (a responder choosing a hospital needs the policy and the
-- government/private preference), so it inherits the existing RLS policies
-- and updated_at trigger for free.

alter table public.emergency_profiles
  add column if not exists insurance_provider text,
  add column if not exists insurance_policy_name text,
  -- Free text, not a number: riders write "₹5,00,000", "5L personal
  -- accident", or a plan name, and none of those survive a numeric column.
  add column if not exists insurance_coverage text,
  -- ponytail: an explicit "is it active" flag, not a computed one — a
  -- lapsed policy still has a provider and a policy name, so presence of
  -- those can't stand in for coverage. Upgrade path: replace with
  -- insurance_expires_on date and derive this from it, if riders start
  -- wanting lapse warnings.
  add column if not exists insurance_covered boolean not null default false,
  add column if not exists hospital_preference text
    check (hospital_preference in ('government', 'private'));
