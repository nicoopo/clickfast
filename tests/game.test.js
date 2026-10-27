const { createGame } = require('../web/game');

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => { t += ms; } };
}

describe('compteur de clics', () => {
  test('le score part de 0', () => {
    expect(createGame().score()).toBe(0);
  });

  test('chaque clic incrémente le score', () => {
    const game = createGame();
    game.click();
    game.click();
    game.click();
    expect(game.score()).toBe(3);
  });
});

describe('chrono de 5 secondes', () => {
  test('le chrono ne démarre qu’au premier clic', () => {
    const clock = fakeClock();
    const game = createGame(5000, clock.now);
    clock.advance(10000);
    expect(game.started()).toBe(false);
    expect(game.remaining()).toBe(5000);
    expect(game.click()).toBe(true);
  });

  test('les clics comptent tant que les 5 s ne sont pas écoulées', () => {
    const clock = fakeClock();
    const game = createGame(5000, clock.now);
    game.click();
    clock.advance(4999);
    expect(game.click()).toBe(true);
    expect(game.score()).toBe(2);
  });

  test('passé 5 s, le compteur ne bouge plus', () => {
    const clock = fakeClock();
    const game = createGame(5000, clock.now);
    game.click();
    clock.advance(5000);
    expect(game.isFinished()).toBe(true);
    expect(game.click()).toBe(false);
    expect(game.score()).toBe(1);
  });

  test('le temps restant ne descend jamais sous 0', () => {
    const clock = fakeClock();
    const game = createGame(5000, clock.now);
    game.click();
    clock.advance(60000);
    expect(game.remaining()).toBe(0);
  });
});
