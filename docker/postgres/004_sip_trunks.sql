-- CommCare SIP trunk business tables (also created via TypeORM synchronize when enabled).
-- Apply: psql -U postgres -d postgres -f docker/postgres/004_sip_trunks.sql

DO $$ BEGIN
	CREATE TYPE sip_trunk_auth_mode AS ENUM ('ip', 'credentials');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sip_trunks (
	id UUID PRIMARY KEY,
	tenant_id UUID NOT NULL,
	name VARCHAR(128) NOT NULL,
	auth_mode sip_trunk_auth_mode NOT NULL,
	username VARCHAR(80),
	password VARCHAR(128),
	enabled BOOLEAN NOT NULL DEFAULT TRUE,
	pjsip_endpoint_id VARCHAR(40) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sip_trunks_tenant_id ON sip_trunks (tenant_id);

CREATE TABLE IF NOT EXISTS sip_trunk_identify_ips (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	trunk_id UUID NOT NULL REFERENCES sip_trunks (id) ON DELETE CASCADE,
	match VARCHAR(80) NOT NULL,
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT uq_sip_trunk_identify_ips_trunk_match UNIQUE (trunk_id, match)
);

CREATE INDEX IF NOT EXISTS idx_sip_trunk_identify_ips_trunk_id
	ON sip_trunk_identify_ips (trunk_id);
