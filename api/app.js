const express = require('express');
const client = require('prom-client');

async function initDb(pool) {
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

function createMetrics() {
  const register = new client.Registry();
  client.collectDefaultMetrics({ register });
  const labelNames = ['method', 'route', 'status'];
  return {
    register,
    requests: new client.Counter({
      name: 'http_requests_total',
      help: 'Nombre total de requetes HTTP servies',
      labelNames,
      registers: [register],
    }),
    duration: new client.Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duree des requetes HTTP en secondes',
      labelNames,
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
      registers: [register],
    }),
    scoresRecorded: new client.Counter({
      name: 'scores_recorded_total',
      help: 'Nombre de scores enregistres depuis le demarrage',
      registers: [register],
    }),
  };
}

function createApp(pool) {
  const metrics = createMetrics();
  const app = express();

  app.use((req, res, next) => {
    const stop = metrics.duration.startTimer();
    res.on('finish', () => {
      // La route déclarée (/api/scores/:id), jamais l'URL réelle : un id en label ferait exploser Prometheus.
      const route = req.route ? req.baseUrl + req.route.path : 'unmatched';
      const labels = { method: req.method, route, status: res.statusCode };
      metrics.requests.inc(labels);
      stop(labels);
    });
    next();
  });

  app.use(express.json({ limit: '1kb' }));
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Une base coupée donne un 503 exploitable, jamais un plantage ni une requête pendue.
  const withDb = (handler) => async (req, res) => {
    try {
      await initDb(pool);
      await handler(req, res);
    } catch (err) {
      console.error(`${req.method} ${req.originalUrl} :`, err.message);
      res.status(503).json({ error: 'Base de données indisponible' });
    }
  };

  // Un id qui n'est pas un entier ne peut correspondre à aucun score : 404, pas 500.
  const parseId = (raw) => (/^\d+$/.test(raw) ? Number(raw) : null);

  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', metrics.register.contentType);
    res.send(await metrics.register.metrics());
  });

  app.post('/api/scores', (req, res, next) => {
    const { username, score } = req.body || {};
    if (typeof username !== 'string' || !username.trim() || username.trim().length > 30) {
      return res.status(400).json({ error: 'username requis (1 à 30 caractères)' });
    }
    // 5 secondes de clics : au-delà de 200, c'est un script, pas un humain.
    if (!Number.isInteger(score) || score < 0 || score > 200) {
      return res.status(400).json({ error: 'score doit être un entier entre 0 et 200' });
    }
    next();
  }, withDb(async (req, res) => {
    const { rows } = await pool.query(
      'INSERT INTO scores (username, score) VALUES ($1, $2) RETURNING id, username, score',
      [req.body.username.trim(), req.body.score],
    );
    metrics.scoresRecorded.inc();
    res.status(201).json(rows[0]);
  }));

  app.get('/api/scores', withDb(async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, username, score FROM scores ORDER BY score DESC, created_at ASC LIMIT 10',
    );
    res.json(rows);
  }));

  app.get('/api/scores/:id', withDb(async (req, res) => {
    const id = parseId(req.params.id);
    const { rows } = id === null ? { rows: [] }
      : await pool.query('SELECT id, username, score FROM scores WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'score introuvable' });
    res.json(rows[0]);
  }));

  app.delete('/api/scores/:id', withDb(async (req, res) => {
    const id = parseId(req.params.id);
    const { rowCount } = id === null ? { rowCount: 0 }
      : await pool.query('DELETE FROM scores WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'score introuvable' });
    res.sendStatus(204);
  }));

  app.use((req, res) => res.status(404).json({ error: 'route inconnue' }));

  return app;
}

module.exports = { createApp, initDb };
