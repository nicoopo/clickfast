/* global createGame */
const GAME_DURATION = 5000;
// Même hôte que la page, port 3000 : l'API est appelée par le navigateur, pas par nginx.
const API_URL = `${location.protocol}//${location.hostname || 'localhost'}:3000`;

const clickBtn = document.getElementById('click-btn');
const restartBtn = document.getElementById('restart-btn');
const scoreEl = document.getElementById('score');
const timerEl = document.getElementById('timer');
const messageEl = document.getElementById('message');
const usernameEl = document.getElementById('username');
const leaderboardEl = document.getElementById('leaderboard');

let game = createGame(GAME_DURATION);

clickBtn.addEventListener('click', () => {
  const firstClick = !game.started();
  if (!game.click()) return;
  scoreEl.textContent = game.score();
  if (firstClick) tick();
});

restartBtn.addEventListener('click', () => {
  game = createGame(GAME_DURATION);
  scoreEl.textContent = '0';
  timerEl.textContent = (GAME_DURATION / 1000).toFixed(1);
  messageEl.textContent = '';
  clickBtn.disabled = false;
  restartBtn.hidden = true;
});

function tick() {
  if (game.isFinished()) return endGame();
  timerEl.textContent = (game.remaining() / 1000).toFixed(1);
  requestAnimationFrame(tick);
}

async function endGame() {
  const score = game.score();
  timerEl.textContent = '0.0';
  clickBtn.disabled = true;
  restartBtn.hidden = false;
  messageEl.textContent = `Terminé ! ${score} clics.`;

  const username = usernameEl.value.trim();
  if (!username) {
    messageEl.textContent += ' (pas de pseudo, score non enregistré)';
    return;
  }
  try {
    const res = await fetch(`${API_URL}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, score }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
    messageEl.textContent += ' Score enregistré.';
  } catch (err) {
    messageEl.textContent += ` Score non enregistré : ${err.message}`;
  }
  loadLeaderboard();
}

async function loadLeaderboard() {
  try {
    const res = await fetch(`${API_URL}/scores`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const scores = await res.json();
    leaderboardEl.replaceChildren(...scores.map((s) => {
      const li = document.createElement('li');
      li.textContent = `${s.username} : ${s.score}`;
      return li;
    }));
  } catch {
    leaderboardEl.innerHTML = '<li>Classement indisponible</li>';
  }
}

loadLeaderboard();
