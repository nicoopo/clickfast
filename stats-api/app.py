import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import psycopg

TABLE = "scores"
COL_USERNAME = "username"
COL_SCORE = "score"

REQUIRED = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
missing = [name for name in REQUIRED if not os.environ.get(name)]
if missing:
    sys.exit(f"Variables d'environnement manquantes : {', '.join(missing)}")

DSN = dict(
    host=os.environ["DB_HOST"],
    port=int(os.environ.get("DB_PORT", "5432")),
    user=os.environ["DB_USER"],
    password=os.environ["DB_PASSWORD"],
    dbname=os.environ["DB_NAME"],
    connect_timeout=3,
)


def get_stats():
    with psycopg.connect(**DSN) as conn:
        exists = conn.execute("SELECT to_regclass(%s)", (TABLE,)).fetchone()[0]
        if exists is None:
            return {"best_score": 0, "games_played": 0, "distinct_players": 0}
        best, games, players = conn.execute(
            f"SELECT COALESCE(MAX({COL_SCORE}), 0), COUNT(*), COUNT(DISTINCT {COL_USERNAME}) FROM {TABLE}"
        ).fetchone()
        return {"best_score": best, "games_played": games, "distinct_players": players}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/health":
            return self.reply(200, {"status": "ok"})
        if self.path != "/stats":
            return self.reply(404, {"error": "route inconnue"})
        try:
            self.reply(200, get_stats())
        except psycopg.Error as err:
            print(f"GET /stats : {err}", file=sys.stderr)
            self.reply(503, {"error": "Base de données indisponible"})

    def reply(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    print(f"stats-api sur le port {port}", flush=True)
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
