import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerStore, MAX_BALANCE } from '../src/store.js';
import { createPlinkoSession as createSessionEngine } from '../src/games/instant/plinko-session.js';
import { payoutFor } from '../src/games/instant/engine.js';

// Fix only the rounding branch in gameplay fixtures; rtp.test verifies both
// branches and the expectation of the production rounding implementation.
const createPlinkoSession = (player, options = {}) => createSessionEngine(player, { round: (value) => Math.floor(value + 1e-8), ...options });

function wallet(balance = 10000) {
  let saved = JSON.stringify({ balance, favorites: [] });
  return createPlayerStore({ getItem: () => saved, setItem: (_, value) => { saved = value; } });
}

test('200 concurrent balls have unique stakes and settle independently out of order', () => {
  const player = wallet();
  let seed = 1;
  const game = createPlinkoSession(player, { seed: () => seed++ });
  const balls = Array.from({ length: 200 }, (_, i) => game.drop(10, { risk: ['low', 'medium', 'high'][i % 3] }).ball);
  assert.equal(game.getState().active, 200);
  assert.equal(new Set(balls.map((ball) => ball.id)).size, 200);
  assert.equal(player.getState().balance, 8000, 'no payout before landing');
  let paid = 0;
  for (const ball of balls.reverse()) {
    const expected = payoutFor(ball.bet, ball.multiplier);
    const { round } = game.land(ball.id);
    assert.equal(round.payout, expected);
    assert.equal(round.risk, ball.risk);
    paid += expected;
    assert.equal(game.land(ball.id).round, null, 'no duplicate settlement');
  }
  assert.equal(game.getState().active, 0);
  assert.equal(player.getState().balance, 8000 + paid);
  assert.equal(game.getState().history.length, 8);
});

test('only funds restrict new balls; rows stay fixed until all have landed', () => {
  const player = wallet(200);
  const game = createPlinkoSession(player, { seed: () => 1 });
  const first = game.drop(100).ball;
  const second = game.drop(100).ball;
  assert.ok(game.drop(10).error);
  assert.ok(game.drop(10, { rows: 8 }).error);
  assert.equal(player.getState().balance, 0);
  game.land(second.id); game.land(first.id);
  assert.ok(game.drop(10, { rows: 8 }).ball);
});

test('invalid options and random source failure never debit the wallet', () => {
  const player = wallet();
  const game = createPlinkoSession(player, { seed: () => { throw new Error('random unavailable'); } });
  for (const bet of [0, 9, 5001, NaN, Infinity, 10.5]) assert.ok(game.drop(bet).error);
  assert.ok(game.drop(100, { rows: 9 }).error);
  assert.ok(game.drop(100, { risk: 'other' }).error);
  assert.throws(() => game.drop(100));
  assert.equal(player.getState().balance, 10000);
});

test('failed credit can be retried once and close still settles pending balls', () => {
  const player = wallet();
  let fail = true;
  const game = createPlinkoSession({ ...player, credit: (amount) => fail ? false : player.credit(amount) }, { seed: () => 1 });
  const ball = game.drop(100).ball;
  game.close();
  assert.ok(game.drop(100).error);
  assert.ok(game.land(ball.id).error);
  assert.equal(game.getState().active, 1);
  assert.equal(player.getState().balance, 9900);
  fail = false;
  assert.ok(game.land(ball.id).round);
  assert.equal(game.land(ball.id).round, null);
});

test('balance cap leaves room for all unrevealed stakes and history is isolated', () => {
  const near = createPlinkoSession(wallet(MAX_BALANCE));
  assert.ok(near.drop(100).error);
  const player = wallet(MAX_BALANCE - 1000000);
  const game = createPlinkoSession(player, { seed: () => 1 });
  const first = game.drop(100).ball;
  const second = game.drop(100).ball;
  game.land(first.id);
  assert.ok(player.getState().balance + game.getState().pendingStake <= MAX_BALANCE);
  game.land(second.id);
  const state = game.getState();
  state.history[0].payout = -1; state.ids.push(500);
  assert.ok(game.getState().history[0].payout >= 0);
  assert.equal(game.getState().ids.length, 0);
});
