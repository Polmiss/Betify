import test from 'node:test';
import assert from 'node:assert/strict';
import { BETS, WHEEL, RED, colorOf, calculateResult, stakeTotal, drawPocket, settleRound, ROUND_LIMIT } from '../src/games/roulette/engine.js';
import { createPlayerStore, MAX_BALANCE, STORAGE_KEY } from '../src/store.js';

function playerWith(balance = 10000) {
  const storage = new Map([[STORAGE_KEY, JSON.stringify({ balance, favorites: [] })]]);
  return createPlayerStore({ getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) });
}

test('European wheel contains every pocket once, with correct color groups', () => {
  assert.deepEqual([...WHEEL].sort((a, b) => a - b), Array.from({ length: 37 }, (_, n) => n));
  assert.equal(RED.length, 18);
  assert.equal(WHEEL.filter((n) => colorOf(n) === 'black').length, 18);
  assert.equal(colorOf(0), 'green');
  assert.equal(colorOf(32), 'red');
  assert.equal(colorOf(15), 'black');
});

test('straight-up bets return 36.63 times the stake, including zero', () => {
  for (const n of WHEEL) {
    assert.equal(calculateResult({ [`number-${n}`]: 10 }, n).payout, 366.3);
    assert.equal(calculateResult({ [`number-${n}`]: 10 }, (n + 1) % 37).payout, 0);
  }
});

test('zero loses every outside bet without being even, low or a column', () => {
  const outside = Object.fromEntries(Object.keys(BETS).filter((id) => !id.startsWith('number-')).map((id) => [id, 10]));
  const result = calculateResult(outside, 0);
  assert.equal(result.payout, 0);
  assert.deepEqual(result.winningIds, []);
});

test('even-money bets cover the correct boundaries and use the RTP 99% payout', () => {
  const expectations = {
    red: (n) => RED.includes(n),
    black: (n) => n > 0 && !RED.includes(n),
    even: (n) => n > 0 && n % 2 === 0,
    odd: (n) => n > 0 && n % 2 === 1,
    low: (n) => n >= 1 && n <= 18,
    high: (n) => n >= 19 && n <= 36,
  };
  for (const [id, wins] of Object.entries(expectations)) {
    for (const pocket of WHEEL) assert.equal(calculateResult({ [id]: 100 }, pocket).payout, wins(pocket) ? 203.5 : 0, `${id} at ${pocket}`);
  }
});

test('dozens and columns cover 12 pockets each and pay 3.0525 times including stake', () => {
  for (const prefix of ['dozen', 'column']) {
    assert.deepEqual([1, 2, 3].flatMap((n) => BETS[`${prefix}-${n}`].pockets).sort((a, b) => a - b), Array.from({ length: 36 }, (_, n) => n + 1));
    for (const n of [1, 2, 3]) {
      const bet = BETS[`${prefix}-${n}`];
      assert.equal(bet.pockets.length, 12);
      for (const pocket of WHEEL) assert.equal(calculateResult({ [bet.id]: 50 }, pocket).payout, bet.pockets.includes(pocket) ? 152.625 : 0);
    }
  }
});

test('mixed bets accumulate payouts and deduct all stakes exactly once', () => {
  const player = playerWith();
  const result = settleRound(player, { 'number-32': 10, red: 100, high: 50, odd: 20 }, 32, { round: Math.floor });
  assert.equal(result.stake, 180);
  assert.equal(result.payout, 671);
  assert.equal(result.net, 491);
  assert.equal(player.getState().balance, 10491);
});

test('losing rounds debit the stake, and invalid rounds never mutate balance', () => {
  const player = playerWith(100);
  assert.equal(settleRound(player, { red: 50 }, 0).net, -50);
  assert.equal(player.getState().balance, 50);
  for (const bets of [{ red: 60 }, {}, { missing: 10 }, { red: -1 }, { red: 1.2 }, { red: Infinity }, { red: ROUND_LIMIT + 1 }]) {
    assert.throws(() => settleRound(player, bets, 0));
    assert.equal(player.getState().balance, 50);
  }
  assert.throws(() => calculateResult({ red: 10 }, 37));
  assert.throws(() => calculateResult({ red: 10 }, -1));
  assert.throws(() => stakeTotal({ red: 60000, black: 60000 }));
});

test('near-limit wallet rejects a round even if that particular outcome would lose', () => {
  const player = playerWith(MAX_BALANCE);
  assert.throws(() => settleRound(player, { 'number-1': 100 }, 0), /limit portfela/);
  assert.equal(player.getState().balance, MAX_BALANCE);
});

test('unbiased random draw rejects the incomplete modulo bucket', () => {
  const values = [2 ** 32 - 1, 2 ** 32 - 2, 74];
  let calls = 0;
  const random = { getRandomValues(array) { array[0] = values[calls++]; } };
  assert.equal(drawPocket(random), 0);
  assert.equal(calls, 3);
});
