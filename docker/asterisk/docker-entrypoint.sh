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
export ASTERISK_EXTERNAL_IP="${ASTERISK_EXTERNAL_IP:-}"
export ASTERISK_LOCAL_NET="${ASTERISK_LOCAL_NET:-10.0.0.0/8}"

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

render_with_nat() {
	template="$1"
	output="$2"

	if [ -n "$ASTERISK_EXTERNAL_IP" ]; then
		EXTERNAL_MEDIA="external_media_address=${ASTERISK_EXTERNAL_IP}"
		EXTERNAL_SIGNALING="external_signaling_address=${ASTERISK_EXTERNAL_IP}"
		LOCAL_NET="local_net=${ASTERISK_LOCAL_NET}"
		RTP_EXTERNADDR_LINE="externaddr=${ASTERISK_EXTERNAL_IP}"
	else
		EXTERNAL_MEDIA=""
		EXTERNAL_SIGNALING=""
		LOCAL_NET=""
		RTP_EXTERNADDR_LINE=""
	fi

	sed \
		-e "s|@EXTERNAL_MEDIA@|${EXTERNAL_MEDIA}|g" \
		-e "s|@EXTERNAL_SIGNALING@|${EXTERNAL_SIGNALING}|g" \
		-e "s|@LOCAL_NET@|${LOCAL_NET}|g" \
		-e "s|@RTP_EXTERNADDR_LINE@|${RTP_EXTERNADDR_LINE}|g" \
		"$template" > "$output"
	chmod 640 "$output"
}

render "$TEMPLATE_DIR/ari-user.conf.template" "$GEN_DIR/ari-user.conf"
render "$TEMPLATE_DIR/manager-user.conf.template" "$GEN_DIR/manager-user.conf"
render "$TEMPLATE_DIR/res_pgsql.conf.template" "$GEN_DIR/res_pgsql.conf"
render_with_nat "$TEMPLATE_DIR/pjsip.conf.template" "$GEN_DIR/pjsip.conf"
render_with_nat "$TEMPLATE_DIR/rtp.conf.template" "$GEN_DIR/rtp.conf"

exec /usr/sbin/asterisk -f -U root -G root
