// Tests d'intégration : ils parlent à un vrai PostgreSQL (DB_* dans l'environnement).
const request = require('supertest');
const { Pool } = require('pg');
const { createApp, initDb } = require('../app');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});
const app = createApp(pool);

beforeAll(() => initDb(pool));
// Chaque test repart d'une table vide : deux passages d'affilée donnent le même résultat.
beforeEach(() => pool.query('TRUNCATE scores RESTART IDENTITY'));
afterAll(() => pool.end());

test('un score enregistré se relit par son id, à l’identique', async () => {
  const created = await request(app).post('/api/scores').send({ username: 'alice', score: 42 });
  expect(created.status).toBe(201);

  const read = await request(app).get(`/api/scores/${created.body.id}`);
  expect(read.status).toBe(200);
  expect(read.body).toEqual({ id: created.body.id, username: 'alice', score: 42 });
});

test('un score inexistant donne un 404 propre', async () => {
  const res = await request(app).get('/api/scores/999999');
  expect(res.status).toBe(404);
  expect(res.body.error).toBeDefined();
});

test.each([
  ['username manquant', { score: 10 }],
  ['score négatif', { username: 'bob', score: -1 }],
  ['score non entier', { username: 'bob', score: 'beaucoup' }],
])('corps invalide (%s) : 400, et rien en base', async (_, body) => {
  const res = await request(app).post('/api/scores').send(body);
  expect(res.status).toBe(400);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM scores');
  expect(rows[0].n).toBe(0);
});

test('un score supprimé disparaît du classement', async () => {
  const kept = await request(app).post('/api/scores').send({ username: 'garde', score: 10 });
  const gone = await request(app).post('/api/scores').send({ username: 'efface', score: 99 });

  expect((await request(app).delete(`/api/scores/${gone.body.id}`)).status).toBe(204);

  const board = await request(app).get('/api/scores');
  expect(board.body.map((s) => s.id)).toEqual([kept.body.id]);
  expect((await request(app).delete(`/api/scores/${gone.body.id}`)).status).toBe(404);
});

describe('/metrics', () => {
  const count = (text, labels) => {
    const line = text.split('\n').find((l) => l.startsWith(`http_requests_total{${labels}}`));
    return line ? Number(line.split(' ').pop()) : 0;
  };

  test('répond en texte brut, et 3 appels font +3 exactement', async () => {
    const before = await request(app).get('/metrics');
    expect(before.headers['content-type']).toMatch(/^text\/plain/);
    const labels = 'method="GET",route="/api/scores",status="200"';
    const start = count(before.text, labels);

    for (let i = 0; i < 3; i++) await request(app).get('/api/scores');

    const after = await request(app).get('/metrics');
    expect(count(after.text, labels)).toBe(start + 3);
  });

  test('les 404 sont comptés, et un id ne devient jamais un label', async () => {
    await request(app).get('/route/inconnue');
    await request(app).get('/api/scores/123456');
    const { text } = await request(app).get('/metrics');
    expect(count(text, 'method="GET",route="unmatched",status="404"')).toBeGreaterThan(0);
    expect(count(text, 'method="GET",route="/api/scores/:id",status="404"')).toBeGreaterThan(0);
    expect(text).not.toContain('route="/api/scores/123456"');
  });
});
