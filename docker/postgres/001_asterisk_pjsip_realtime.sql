-- Asterisk PJSIP realtime tables (CommCare writes; Asterisk reads — no pjsip reload per extension).
-- Apply: psql -U postgres -d postgres -f docker/postgres/001_asterisk_pjsip_realtime.sql

CREATE TABLE IF NOT EXISTS ps_auths (
	id VARCHAR(40) NOT NULL PRIMARY KEY,
	auth_type VARCHAR(40) DEFAULT 'userpass',
	username VARCHAR(40),
	password VARCHAR(80),
	nonce_lifetime INTEGER DEFAULT 32
);

CREATE TABLE IF NOT EXISTS ps_aors (
	id VARCHAR(40) NOT NULL PRIMARY KEY,
	max_contacts INTEGER DEFAULT 3,
	remove_existing VARCHAR(40) DEFAULT 'yes',
	default_expiration INTEGER DEFAULT 3600
);

CREATE TABLE IF NOT EXISTS ps_endpoints (
	id VARCHAR(40) NOT NULL PRIMARY KEY,
	transport VARCHAR(40) DEFAULT 'transport-udp',
	aors VARCHAR(200),
	auth VARCHAR(40),
	context VARCHAR(40) DEFAULT 'from-internal',
	disallow VARCHAR(200) DEFAULT 'all',
	allow VARCHAR(200) DEFAULT 'ulaw,alaw,gsm',
	direct_media VARCHAR(40) DEFAULT 'no',
	rtp_symmetric VARCHAR(40) DEFAULT 'yes',
	force_rport VARCHAR(40) DEFAULT 'yes',
	rewrite_contact VARCHAR(40) DEFAULT 'yes',
	callerid VARCHAR(100),
	media_use_received_transport VARCHAR(40) DEFAULT 'yes'
);

-- Dev seed extensions: see 002_seed_dev_extensions.sh (env-driven passwords)
