#!/bin/bash
# Rebuild and restart application containers only (app + asterisk-cdr-worker).
# Infrastructure (commcare-infra project) is not affected.
#
# Start infra once:
#   docker compose -f docker/docker-compose.infra.yaml up -d
set -euo pipefail

docker compose -f docker/docker-compose.yaml up -d --build --force-recreate
