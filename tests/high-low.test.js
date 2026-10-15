import test from 'node:test';
import assert from 'node:assert/strict';
import { createHighLow, choicesFor, isCorrect, drawCard, MAX_PAYOUT, MAX_MULTIPLIER } from '../src/games/high-low/engine.js';
import { createPlayerStore, MAX_BALANCE } from '../src/store.js';

function table(sequence, balance = 10000) {
  let index = 0;
  const player = createPlayerStore({ getItem: () => JSON.stringify({ balance }), setItem() {} });
  const game = createHighLow(player, { draw: () => ({ rank: sequence[index++ % sequence.length], suit: '♠' }) });
  return { game, player };
}

test('displayed odds exactly match every possible rank outcome, including extremes', () => {
  for (let previous = 1; previous <= 13; previous++) {
    for (const direction of ['high', 'low']) {
      const count = Array.from({ length: 13 }, (_, i) => i + 1).filter((next) => isCorrect(previous, next, direction)).length;
      assert.equal(choicesFor(previous)[direction].count, count);
      assert.ok(count > 0 && count < 13);
    }
  }
  assert.equal(isCorrect(1, 1, 'high'), false);
  assert.equal(isCorrect(1, 1, 'low'), true);
  assert.equal(isCorrect(13, 13, 'high'), true);
  assert.equal(isCorrect(13, 13, 'low'), false);
  assert.equal(isCorrect(7, 7, 'high'), true);
  assert.equal(isCorrect(7, 7, 'low'), true);
});

test('uniform random draw rejects the incomplete bucket and maps all 52 cards', () => {
  let calls = 0;
  const rng = { getRandomValues(buffer) { buffer[0] = calls++ ? 0 : 2 ** 32 - 1; } };
  assert.deepEqual(drawCard(rng), { rank: 1, suit: '♠' });
  assert.equal(calls, 2);
  const cards = new Set();
  for (let i = 0; i < 52; i++) {
    const result = drawCard({ getRandomValues(buffer) { buffer[0] = i; } });
    cards.add(result.rank + result.suit);
  }
  assert.equal(cards.size, 52);
});

test('invalid stakes, insufficient funds and repeated starts never take extra chips', () => {
  const { game, player } = table([7], 100);
  for (const bet of [0, -1, 9, 10.5, 5001, NaN, Infinity, '100', 101]) {
    assert.equal(typeof game.start(bet), 'string');
    assert.equal(player.getState().balance, 100);
  }
  assert.equal(game.predict('high'), 'Najpierw rozpocznij grę.');
  assert.equal(game.start(100), null);
  assert.equal(player.getState().balance, 0);
  assert.equal(typeof game.start(100), 'string');
  assert.equal(typeof game.predict('unknown'), 'string');
  assert.equal(game.getState().wins, 0);
});

test('a streak uses the published combined probability and pays once with integer rounding', () => {
  const { game, player } = table([7, 10, 4]);
  game.start(100);
  assert.equal(typeof game.cashout(), 'string');
  assert.equal(game.predict('high'), null);
  assert.equal(player.getState().balance, 9900);
  assert.equal(game.getState().wins, 1);
  assert.ok(Math.abs(game.getState().multiplier - .99 * 13 / 7) < 1e-10);
  assert.equal(game.predict('low'), null);
  assert.ok(Math.abs(game.getState().multiplier - .99 * 13 * 13 / (7 * 10)) < 1e-10);
  assert.equal(game.getState().availablePayout, 239);
  assert.equal(game.cashout(), null);
  assert.equal(player.getState().balance, 10139);
  assert.equal(game.getState().payout, 239);
  game.cashout(); game.close(); game.predict('high');
  assert.equal(player.getState().balance, 10139);
});

test('a wrong prediction loses the whole uncollected streak', () => {
  const { game, player } = table([7, 10, 11]);
  game.start(100); game.predict('high'); game.predict('low');
  assert.equal(game.getState().outcome, 'lose');
  assert.equal(game.getState().payout, 0);
  assert.equal(player.getState().balance, 9900);
  game.close(); game.cashout();
  assert.equal(player.getState().balance, 9900);
});

test('same-card calls at A and K have probability 1/13 and correct payouts', () => {
  for (const [rank, direction] of [[1, 'low'], [13, 'high']]) {
    const { game, player } = table([rank]);
    game.start(100); game.predict(direction); game.cashout();
    assert.equal(game.getState().payout, 1287);
    assert.equal(player.getState().balance, 11187);
  }
});

test('skips are free, preserve multiplier and hit count, and stop at 52 in a round', () => {
  const { game, player } = table([7]);
  game.skip(); assert.equal(player.getState().balance, 10000);
  game.start(100); game.predict('high');
  const multiplier = game.getState().multiplier;
  for (let i = 0; i < 52; i++) assert.equal(game.skip(), null);
  assert.equal(typeof game.skip(), 'string');
  assert.equal(game.getState().skips, 52);
  assert.equal(game.getState().multiplier, multiplier);
  assert.equal(game.getState().wins, 1);
  assert.equal(player.getState().balance, 9900);
});

test('closing before a prediction refunds the stake, and closing after wins cashes out once', () => {
  const unplayed = table([7]);
  unplayed.game.start(100); unplayed.game.skip(); unplayed.game.close(); unplayed.game.close();
  assert.equal(unplayed.player.getState().balance, 10000);
  assert.equal(unplayed.game.getState().outcome, 'cancelled');
  const won = table([7, 10]);
  won.game.start(100); won.game.predict('high'); won.game.close(); won.game.close();
  assert.equal(won.player.getState().balance, 10083);
});

test('multiplier and payout caps automatically settle the winning series', () => {
  const { game, player } = table([13]);
  game.start(1000);
  for (let i = 0; i < 3; i++) game.predict('high');
  assert.equal(game.getState().outcome, 'limit');
  assert.equal(game.getState().multiplier, MAX_MULTIPLIER);
  assert.equal(game.getState().payout, MAX_PAYOUT);
  assert.equal(player.getState().balance, 1009000);
});

test('cashout respects the wallet limit without overflow', () => {
  const { game, player } = table([7, 10], MAX_BALANCE - 10);
  game.start(100); game.predict('high'); game.cashout();
  assert.equal(player.getState().balance, MAX_BALANCE);
  assert.equal(game.getState().payout, 110);
});

test('failed credit leaves the cashout retryable without double payment', () => {
  const real = table([7, 10]);
  let blocked = true;
  const wallet = { ...real.player, credit: (amount) => blocked ? false : real.player.credit(amount) };
  const game = createHighLow(wallet, { draw: (() => { let n = 0; return () => ({ rank: n++ ? 10 : 7, suit: '♥' }); })() });
  game.start(100); game.predict('high');
  assert.equal(typeof game.cashout(), 'string');
  assert.equal(game.getState().phase, 'playing');
  blocked = false;
  assert.equal(game.cashout(), null);
  assert.equal(real.player.getState().balance, 10083);
});

test('snapshots cannot change cards or streak history, and a reset cancels the old series', () => {
  const { game, player } = table([7, 10]);
  game.start(100); game.predict('high');
  const state = game.getState();
  state.card.rank = 1; state.history[0].card.rank = 13; state.history.push({ card: { rank: 9 } });
  assert.equal(game.getState().card.rank, 10);
  assert.equal(game.getState().history[0].card.rank, 7);
  assert.equal(game.getState().history.length, 2);
  game.close(); player.resetBalance(); game.close();
  assert.equal(player.getState().balance, 10000);
});
