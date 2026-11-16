-- AIMI: Run ONCE in the SQL Editor of your NEW Supabase project.
-- All operations are one transaction. Existing AIMI installations are refused.
-- The final result contains a NEW database password. Keep it private; enter only in Render.
BEGIN;
DO $$ BEGIN
 IF to_regclass('aimi.users') IS NOT NULL OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
  RAISE EXCEPTION 'AIMI already exists. Stop and use versioned migrations instead.';
 END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS aimi;
CREATE TABLE aimi.schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TEMP TABLE aimi_setup_credentials (username text, password text) ON COMMIT DROP;
INSERT INTO aimi_setup_credentials VALUES ('aimi_api', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''));
DO $$ DECLARE generated_password text; BEGIN
 SELECT password INTO generated_password FROM aimi_setup_credentials;
 EXECUTE format('CREATE ROLE aimi_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', generated_password);
END $$;

-- 202611080001_foundation.sql
-- Server-only schema: intentionally excluded from the default public Data API.
CREATE TABLE aimi.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  toss_user_key text UNIQUE,
  dev_subject text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((toss_user_key IS NULL) <> (dev_subject IS NULL))
);
CREATE TABLE aimi.sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES aimi.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON aimi.sessions(user_id);
CREATE INDEX sessions_expiry_idx ON aimi.sessions(expires_at);
CREATE TABLE aimi.ep_wallets (
  user_id uuid PRIMARY KEY REFERENCES aimi.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aimi.ep_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES aimi.users(id) ON DELETE CASCADE,
  event_key text NOT NULL,
  delta integer NOT NULL CHECK (delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  rule_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_key)
);
CREATE TABLE aimi.daily_reward_claims (
  user_id uuid NOT NULL REFERENCES aimi.users(id) ON DELETE CASCADE,
  local_date date NOT NULL,
  reward_type text NOT NULL CHECK (reward_type IN ('attendance', 'tip')),
  ledger_id uuid NOT NULL UNIQUE REFERENCES aimi.ep_ledger(id),
  PRIMARY KEY (user_id, local_date, reward_type)
);
CREATE TABLE aimi.idempotency_requests (
  user_id uuid NOT NULL REFERENCES aimi.users(id) ON DELETE CASCADE,
  request_key text NOT NULL,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, request_key)
);
CREATE TABLE aimi.reward_policies (
  version text PRIMARY KEY,
  attendance integer NOT NULL CHECK (attendance > 0),
  tip integer NOT NULL CHECK (tip > 0),
  development_only boolean NOT NULL DEFAULT true
);
-- UX example amounts; production claims are blocked until a reviewed policy exists.
INSERT INTO aimi.reward_policies VALUES ('development-v1', 5, 3, true);
REVOKE ALL ON SCHEMA aimi FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA aimi FROM PUBLIC, anon, authenticated;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611080001_foundation.sql','fe0883929e3cd77fde5d241a6d7e5d6c2d60561d7146f9e7caf948eca3daa329');

-- 202611080002_prototype.sql
-- Prototype v1 aggregate. Wallet/ledger remain the existing source of truth.
-- Apply using the established migration runner, not the runtime DB account.
CREATE TABLE aimi.prototype_states (
 user_id uuid PRIMARY KEY REFERENCES aimi.users(id) ON DELETE CASCADE,
 state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
 friend_code text NOT NULL UNIQUE,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON aimi.prototype_states FROM PUBLIC, anon, authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON aimi.prototype_states TO aimi_api;
 END IF;
END $$;
-- JSON aggregates are intentionally a v1 persistence boundary. No public Data API.
-- Evolving this into normalized play/attempt/job tables requires a new migration.
CREATE TABLE aimi.toss_connections (
 user_id uuid PRIMARY KEY REFERENCES aimi.users(id) ON DELETE CASCADE,
 sealed text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON aimi.toss_connections FROM PUBLIC,anon,authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
 GRANT SELECT,INSERT,UPDATE,DELETE ON aimi.toss_connections TO aimi_api;
END IF; END $$;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611080002_prototype.sql','ff8bdf3659ce4339c116db446a648f5b893708161022bd97f3a9034747355166');

-- 202611080003_ai_usage.sql
CREATE TABLE aimi.ai_daily_usage (
 local_date date PRIMARY KEY,
 calls integer NOT NULL CHECK(calls>=0)
);
REVOKE ALL ON aimi.ai_daily_usage FROM PUBLIC,anon,authenticated;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
 GRANT SELECT,INSERT,UPDATE ON aimi.ai_daily_usage TO aimi_api;
END IF; END $$;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611080003_ai_usage.sql','9e3721c0f7f728a029528cc8a314bb41fc43c9f18ed3b4df0662f9fdf7d24eea');

-- 202611090004_reward_policy_v2.sql
-- User-approved EP policy: attendance3 + tip1 + games20 + challenge15 =39/day.
-- Historical wallets, claims and ledger entries are not reset or repriced.
INSERT INTO aimi.reward_policies(version, attendance, tip, development_only)
VALUES ('aimi-economy-v2', 3, 1, false)
ON CONFLICT (version) DO NOTHING;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611090004_reward_policy_v2.sql','3b99a21318e7c5d1fab4970b52a3541c9dce46752cd3c8b9bf14ba59c73d5cac');

-- 202611090005_reward_policy_v3.sql
-- Coin collection policy: attendance3 + tip1 + games15 + challenge15 =34/day.
INSERT INTO aimi.reward_policies(version, attendance, tip, development_only)
VALUES ('aimi-economy-v3', 3, 1, false)
ON CONFLICT (version) DO NOTHING;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611090005_reward_policy_v3.sql','423ccb78f8cd7eb8104fa92b4ef85d031c0b6fef148bbe012ecda6a0c8610701');

-- 202611110006_daily_content.sql
-- Server-only content publication boundary. Preview remains distinct from approval.
CREATE TABLE aimi.content_releases (
  version text PRIMARY KEY,
  day_id text NOT NULL,
  rule_version text NOT NULL,
  review_status text NOT NULL CHECK(review_status IN ('preview','approved','retired')),
  manifest jsonb NOT NULL CHECK(jsonb_typeof(manifest)='object'),
  target_storage_key text NOT NULL,
  target_url text NOT NULL,
  asset_sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE aimi.daily_programs (
  version text PRIMARY KEY,
  program jsonb NOT NULL CHECK(jsonb_typeof(program)='object'),
  release_versions jsonb NOT NULL CHECK(jsonb_typeof(release_versions)='array'),
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_daily_program ON aimi.daily_programs(active) WHERE active;
ALTER TABLE aimi.content_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE aimi.daily_programs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aimi.content_releases,aimi.daily_programs FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
  GRANT SELECT ON aimi.content_releases,aimi.daily_programs TO aimi_api;
  CREATE POLICY api_content_reader ON aimi.content_releases FOR SELECT TO aimi_api USING(true);
  CREATE POLICY api_program_reader ON aimi.daily_programs FOR SELECT TO aimi_api USING(true);
 END IF;
END $$;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611110006_daily_content.sql','25cf55c69d1008f58302c857ac4b2ade1b3a8823079c1ddcba3fc2014975f8b4');

-- 202611110007_test_demo.sql
-- Shared UI test data only. No production user/wallet foreign keys or writes.
CREATE TABLE aimi.test_demo_stores (
 id text PRIMARY KEY,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 epoch uuid NOT NULL DEFAULT gen_random_uuid(),
 starts_at timestamptz,
 ends_at timestamptz,
 ai_calls jsonb NOT NULL DEFAULT '[]'::jsonb,
 last_reset_at timestamptz NOT NULL DEFAULT '1970-01-01',
 CHECK(jsonb_typeof(state)='object'),
 CHECK(jsonb_typeof(ai_calls)='array')
);
ALTER TABLE aimi.test_demo_stores ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON aimi.test_demo_stores FROM PUBLIC,anon,authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='aimi_api') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON aimi.test_demo_stores TO aimi_api;
  CREATE POLICY api_test_demo ON aimi.test_demo_stores FOR ALL TO aimi_api USING(true) WITH CHECK(true);
 END IF;
END $$;

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611110007_test_demo.sql','d72bbb9e0348cfac8c5a9c5886030a23e6870158baf814e88cae094e36b9c8a7');

-- 202611120008_anonymous_auth.sql
-- Keep internal user UUIDs and all existing wallet/social/game foreign keys.
-- Anonymous identities are server-verified and HMACed; never store the SDK code.
ALTER TABLE aimi.users ADD COLUMN toss_anon_key text UNIQUE;
ALTER TABLE aimi.users DROP CONSTRAINT users_check;
ALTER TABLE aimi.users ADD CONSTRAINT users_identity_check
  CHECK (num_nonnulls(toss_user_key, dev_subject, toss_anon_key) = 1);
COMMENT ON COLUMN aimi.users.toss_anon_key IS
  'HMAC-SHA256 of the server-exchanged app-scoped anonKey; not a public friend code';
-- Existing aimi_api table grants cover the added column. No public Data API grants.

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611120008_anonymous_auth.sql','6f37b71c0f0a690c0dbca3fbdce17312878b377a2f9a6418ec19abe885446fa3');

-- 202611160001_android_identity.sql
-- Apply only to the new independent Android database.
ALTER TABLE aimi.users ADD COLUMN android_subject uuid UNIQUE;
ALTER TABLE aimi.users DROP CONSTRAINT users_identity_check;
ALTER TABLE aimi.users ADD CONSTRAINT users_identity_check
 CHECK (num_nonnulls(toss_user_key, dev_subject, toss_anon_key, android_subject) = 1);
COMMENT ON COLUMN aimi.users.android_subject IS 'Supabase Auth subject verified by server; separate from Toss accounts';

INSERT INTO aimi.schema_migrations(name,checksum) VALUES ('202611160001_android_identity.sql','970f0bfc85c41bbf061e1a8b398625e84879545cff82a7018e5aeac156be11c9');

GRANT USAGE ON SCHEMA aimi TO aimi_api;
GRANT SELECT ON aimi.schema_migrations, aimi.reward_policies TO aimi_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON aimi.users,aimi.sessions,aimi.ep_wallets,aimi.ep_ledger,aimi.daily_reward_claims,aimi.idempotency_requests TO aimi_api;
-- Retired demo stores are not part of the independent application's runtime privileges.
REVOKE ALL ON aimi.test_demo_stores FROM aimi_api;
SELECT username AS database_user, password AS database_password FROM aimi_setup_credentials;
COMMIT;
