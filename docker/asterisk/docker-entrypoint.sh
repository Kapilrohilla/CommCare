#!/bin/sh
set -eu

GEN_DIR=/var/lib/asterisk/generated
TEMPLATE_DIR=/etc/asterisk

mkdir -p "$GEN_DIR"

export ASTERISK_ARI_USER="${ASTERISK_ARI_USER:-commcare}"
export ASTERISK_ARI_PASSWORD="${ASTERISK_ARI_PASSWORD:?ASTERISK_ARI_PASSWORD is required}"
export ASTERISK_AMI_USERNAME="${ASTERISK_AMI_USERNAME:-commcare}"
export ASTERISK_AMI_SECRET="${ASTERISK_AMI_SECRET:?ASTERISK_AMI_SECRET is required}"
export ASTERISK_DB_HOST="${ASTERISK_DB_HOST:-db}"
export ASTERISK_DB_NAME="${ASTERISK_DB_NAME:-postgres}"
export ASTERISK_DB_USER="${ASTERISK_DB_USER:-postgres}"
export ASTERISK_DB_PASSWORD="${ASTERISK_DB_PASSWORD:?ASTERISK_DB_PASSWORD is required}"
export ASTERISK_DB_PORT="${ASTERISK_DB_PORT:-5432}"

render() {
	template="$1"
	output="$2"
	if command -v envsubst >/dev/null 2>&1; then
		envsubst < "$template" > "$output"
	else
		sed \
			-e "s|\${ASTERISK_ARI_USER}|${ASTERISK_ARI_USER}|g" \
			-e "s|\${ASTERISK_ARI_PASSWORD}|${ASTERISK_ARI_PASSWORD}|g" \
			-e "s|\${ASTERISK_AMI_USERNAME}|${ASTERISK_AMI_USERNAME}|g" \
			-e "s|\${ASTERISK_AMI_SECRET}|${ASTERISK_AMI_SECRET}|g" \
			-e "s|\${ASTERISK_DB_HOST}|${ASTERISK_DB_HOST}|g" \
			-e "s|\${ASTERISK_DB_NAME}|${ASTERISK_DB_NAME}|g" \
			-e "s|\${ASTERISK_DB_USER}|${ASTERISK_DB_USER}|g" \
			-e "s|\${ASTERISK_DB_PASSWORD}|${ASTERISK_DB_PASSWORD}|g" \
			-e "s|\${ASTERISK_DB_PORT}|${ASTERISK_DB_PORT}|g" \
			"$template" > "$output"
	fi
	chmod 640 "$output"
}

render "$TEMPLATE_DIR/ari-user.conf.template" "$GEN_DIR/ari-user.conf"
render "$TEMPLATE_DIR/manager-user.conf.template" "$GEN_DIR/manager-user.conf"
render "$TEMPLATE_DIR/res_pgsql.conf.template" "$GEN_DIR/res_pgsql.conf"

exec /usr/sbin/asterisk -f -U root -G root
