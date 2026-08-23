#!/bin/bash
# Force create and build the docker images  and start container
docker compose -f docker/docker-compose.yaml down --remove-orphans
docker compose -f docker/docker-compose.yaml build --no-cache
docker compose -f docker/docker-compose.yaml up -d