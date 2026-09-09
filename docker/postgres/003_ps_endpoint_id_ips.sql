-- Asterisk PJSIP IP identify realtime (maps carrier source IP → trunk endpoint).
-- Apply: psql -U postgres -d postgres -f docker/postgres/003_ps_endpoint_id_ips.sql

CREATE TABLE IF NOT EXISTS ps_endpoint_id_ips (
	id VARCHAR(40) NOT NULL PRIMARY KEY,
	endpoint VARCHAR(40),
	match VARCHAR(80),
	srv_lookups VARCHAR(40) DEFAULT 'yes',
	match_header VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_ps_endpoint_id_ips_endpoint
	ON ps_endpoint_id_ips (endpoint);
