#!/bin/bash
# Rebuild and restart application containers only.
# Infrastructure must already be running:
#   docker compose -f docker/docker-compose.infra.yaml up -d
set -euo pipefail

docker compose -f docker/docker-compose.yaml down --remove-orphans
docker compose -f docker/docker-compose.yaml build --no-cache
docker compose -f docker/docker-compose.yaml up -d
