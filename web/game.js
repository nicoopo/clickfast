// Logique pure du jeu, sans DOM : chargée par le navigateur et par Jest.
function createGame(duration = 5000, now = () => Date.now()) {
  let score = 0;
  let startTime = null;

  const remaining = () => (startTime === null ? duration : Math.max(0, duration - (now() - startTime)));
  const isFinished = () => startTime !== null && remaining() === 0;

  return {
    click() {
      if (isFinished()) return false;
      if (startTime === null) startTime = now();
      score++;
      return true;
    },
    score: () => score,
    remaining,
    isFinished,
    started: () => startTime !== null,
  };
}

if (typeof module !== 'undefined') module.exports = { createGame };
