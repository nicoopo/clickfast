#!/usr/bin/env bash
# Un peu de charge sur l'API de scores, pour que les panneaux Grafana ne soient pas plats.
# Usage : ./scripts/charge-api.sh [secondes] [url]   (défaut : 120 s sur http://localhost:3000)
DURATION="${1:-120}"
URL="${2:-http://localhost:3000}"
END=$(( $(date +%s) + DURATION ))
while [ "$(date +%s)" -lt "$END" ]; do
  curl -s "$URL/api/scores" > /dev/null
  curl -s -X POST "$URL/api/scores" \
    -H 'Content-Type: application/json' \
    -d '{"username":"charge","score":137}' > /dev/null
  curl -s "$URL/api/scores/inexistant" > /dev/null   # pour peupler les 404
  sleep 0.2
done
