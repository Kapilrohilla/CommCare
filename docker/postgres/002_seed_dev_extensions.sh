#!/bin/bash
set -euo pipefail

# Dev seed SIP extensions 101/102 — passwords from ASTERISK_DEV_EXT_* env (docker/asterisk/.env).
EXT101_PASSWORD="${ASTERISK_DEV_EXT_101_PASSWORD:-devpass101}"
EXT102_PASSWORD="${ASTERISK_DEV_EXT_102_PASSWORD:-devpass102}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
INSERT INTO ps_auths (id, auth_type, username, password)
VALUES
	('101-auth', 'userpass', '101', '${EXT101_PASSWORD}'),
	('102-auth', 'userpass', '102', '${EXT102_PASSWORD}')
ON CONFLICT (id) DO UPDATE SET password = EXCLUDED.password;

INSERT INTO ps_aors (id, max_contacts, remove_existing)
VALUES
	('101-aor', 3, 'yes'),
	('102-aor', 3, 'yes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ps_endpoints (id, transport, aors, auth, callerid)
VALUES
	('101', 'transport-udp', '101-aor', '101-auth', 'Extension 101 <101>'),
	('102', 'transport-udp', '102-aor', '102-auth', 'Extension 102 <102>')
ON CONFLICT (id) DO NOTHING;
EOSQL
