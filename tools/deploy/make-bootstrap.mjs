import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const folder = new URL('../../supabase/migrations/', import.meta.url);
let sql = `-- AIMI: Run ONCE in the SQL Editor of your NEW Supabase project.
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
`;
for (const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort()) {
 const migration = await readFile(new URL(name,folder),'utf8');
 const checksum = createHash('sha256').update(migration).digest('hex');
 sql += `\n-- ${name}\n${migration}\nINSERT INTO aimi.schema_migrations(name,checksum) VALUES ('${name}','${checksum}');\n`;
}
sql += `
GRANT USAGE ON SCHEMA aimi TO aimi_api;
GRANT SELECT ON aimi.schema_migrations, aimi.reward_policies TO aimi_api;
GRANT SELECT,INSERT,UPDATE,DELETE ON aimi.users,aimi.sessions,aimi.ep_wallets,aimi.ep_ledger,aimi.daily_reward_claims,aimi.idempotency_requests TO aimi_api;
-- Retired demo stores are not part of the independent application's runtime privileges.
REVOKE ALL ON aimi.test_demo_stores FROM aimi_api;
SELECT username AS database_user, password AS database_password FROM aimi_setup_credentials;
COMMIT;
`;
await writeFile(new URL('../../docs/ANDROID_NEW_DATABASE.sql',import.meta.url), sql);
console.log('New-project-only SQL generated; no real credentials are stored in the file.');
