const { Pool } = require('pg');
const { createApp } = require('./app');

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

const port = Number(process.env.PORT || 3000);
const server = createApp(pool).listen(port, () => console.log(`API scores sur le port ${port}`));

// En PID 1 dans un conteneur, Node ignore SIGTERM par défaut : Kubernetes attendait alors
// 30 s avant de le tuer. On termine les requêtes en cours, puis on sort proprement.
process.on('SIGTERM', () => {
  console.log('SIGTERM reçu, arrêt propre');
  server.close(() => pool.end().finally(() => process.exit(0)));
});
