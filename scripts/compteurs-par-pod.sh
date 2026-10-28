#!/bin/sh
# Interroge /metrics de chaque pod todo-api directement, en contournant le Service,
# pour voir qui a vraiment reçu la charge.
for pod in $(kubectl get pods -n todo -l app=todo-api -o name); do
  kubectl port-forward -n todo "$pod" 3001:3000 > /dev/null 2>&1 &
  PF_PID=$!
  sleep 1
  echo "== $pod =="
  curl -s localhost:3001/metrics | grep 'http_requests_total{method="GET",route="/api/scores"'
  kill "$PF_PID"
done
