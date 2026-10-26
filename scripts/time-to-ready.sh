#!/usr/bin/env bash
# Usage : lancer juste après `docker compose up -d`, avec l'URL à surveiller.
url="${1:?Usage: $0 <url>}"
start=$(date +%s%N)
until [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" = "200" ]; do
  sleep 0.2
done
echo "$url prêt en $(( ($(date +%s%N) - start) / 1000000 )) ms"
