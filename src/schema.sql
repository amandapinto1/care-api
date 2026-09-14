CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE care_profiles (
  id UUID PRIMARY KEY,
  owner_account_id UUID NOT NULL REFERENCES accounts(id),
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TYPE care_role AS ENUM ('responsible', 'accompanied', 'caregiver', 'additional_responsible');

CREATE TABLE care_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  care_profile_id UUID NOT NULL REFERENCES care_profiles(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  role care_role NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'revoked', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (care_profile_id, account_id)
);

CREATE INDEX care_relationships_access_index ON care_relationships (care_profile_id, account_id, status);

CREATE TABLE sensitive_records (id UUID PRIMARY KEY, care_profile_id UUID NOT NULL REFERENCES care_profiles(id), category TEXT NOT NULL, encrypted_payload JSONB NOT NULL, key_reference TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE consent_records (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id), purpose TEXT NOT NULL CHECK (purpose IN ('account', 'health_routine', 'notifications', 'profile_photo', 'shared_care')), policy_version TEXT NOT NULL, granted_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ);
CREATE TABLE data_subject_requests (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), account_id UUID NOT NULL REFERENCES accounts(id), request_type TEXT NOT NULL CHECK (request_type IN ('export', 'correction', 'deletion')), status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ);
CREATE TABLE audit_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_account_id UUID NOT NULL REFERENCES accounts(id), care_profile_id UUID REFERENCES care_profiles(id), action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, prior_version TEXT, resulting_version TEXT, rationale TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE FUNCTION prevent_audit_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit events are append-only'; END; $$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();