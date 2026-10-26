const express = require('express');
const { Pool } = require('pg');

const REQUIRED = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Variables d'environnement manquantes : ${missing.join(', ')}`);
  process.exit(1);
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  connectionTimeoutMillis: 3000,
});
// Sans ce handler, une base tuée fait crasher le process via un client inactif.
pool.on('error', (err) => console.error('Connexion Postgres perdue :', err.message));

async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS scores (
    id SERIAL PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

const app = express();
app.use(express.json({ limit: '1kb' }));
app.use((req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.post('/scores', async (req, res) => {
  const { username, score } = req.body || {};
  if (typeof username !== 'string' || !username.trim() || username.trim().length > 30) {
    return res.status(400).json({ error: 'username requis (1 à 30 caractères)' });
  }
  // 5 secondes de clics : au-delà de 200, c'est un script, pas un humain.
  if (!Number.isInteger(score) || score < 0 || score > 200) {
    return res.status(400).json({ error: 'score doit être un entier entre 0 et 200' });
  }
  try {
    await initDb();
    const { rows } = await pool.query(
      'INSERT INTO scores (username, score) VALUES ($1, $2) RETURNING id, username, score',
      [username.trim(), score],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('POST /scores :', err.message);
    res.status(503).json({ error: 'Base de données indisponible' });
  }
});

app.get('/scores', async (req, res) => {
  try {
    await initDb();
    const { rows } = await pool.query(
      'SELECT username, score FROM scores ORDER BY score DESC, created_at ASC LIMIT 10',
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /scores :', err.message);
    res.status(503).json({ error: 'Base de données indisponible' });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`API scores sur le port ${port}`));
