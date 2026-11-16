-- Apply only to the new independent Android database.
ALTER TABLE aimi.users ADD COLUMN android_subject uuid UNIQUE;
ALTER TABLE aimi.users DROP CONSTRAINT users_identity_check;
ALTER TABLE aimi.users ADD CONSTRAINT users_identity_check
 CHECK (num_nonnulls(toss_user_key, dev_subject, toss_anon_key, android_subject) = 1);
COMMENT ON COLUMN aimi.users.android_subject IS 'Supabase Auth subject verified by server; separate from Toss accounts';
