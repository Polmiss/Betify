import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerStore, MAX_BALANCE, STORAGE_KEY } from '../src/store.js';
import { createBlackjack } from '../src/games/blackjack-engine.js';
import { createHighLow } from '../src/games/high-low/engine.js';
import { createMines } from '../src/games/mines/engine.js';
import { createInstantGame, payoutFor } from '../src/games/instant/engine.js';
import { createPlinkoSession } from '../src/games/instant/plinko-session.js';
import { createBettingRack } from '../src/games/roulette/betting.js';
import { settleRound, stakeTotal } from '../src/games/roulette/engine.js';

const BET = 2000000;
const BANK = 20000000;
function wallet(balance = BANK) {
  const data = new Map([[STORAGE_KEY, JSON.stringify({ balance, favorites: [] })]]);
  return createPlayerStore({ getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) });
}
const round = (value) => Math.floor(value + 1e-8);

test('blackjack accepts a funded two-million stake and pays a natural in full once', () => {
  const player = wallet();
  const draws = ['A', '9', 'K', '7'];
  const game = createBlackjack(player, { drawCard: () => ({ rank: draws.shift(), suit: '♠' }), round });
  assert.equal(game.start(BET), null);
  assert.equal(game.getState().payout, 5000000);
  assert.equal(player.getState().balance, BANK - BET + 5000000);
  game.stand(); game.close?.();
  assert.equal(player.getState().balance, BANK - BET + 5000000);
});

test('High Low accepts a large stake and quotes and cashes out more than the old payout cap', () => {
  const player = wallet();
  let rank = 7;
  const game = createHighLow(player, { draw: () => ({ rank: rank++, suit: '♠' }), round });
  assert.equal(game.start(BET), null);
  const offered = game.getState().offers.high.payout;
  assert.ok(offered > 1000000);
  assert.equal(game.predict('high'), null);
  assert.equal(game.getState().availablePayout, offered);
  assert.equal(game.cashout(), null);
  assert.equal(player.getState().balance, BANK - BET + offered);
  assert.ok(game.cashout());
});

test('Mines accepts a large stake and preserves the full first-diamond payout', () => {
  const player = wallet();
  const game = createMines(player, { boardFactory: () => [22, 23, 24], round });
  assert.equal(game.start(BET, 3), null);
  assert.equal(game.reveal(0), null);
  assert.equal(game.getState().availablePayout, 2250000);
  assert.equal(game.cashout(), null);
  assert.equal(player.getState().balance, BANK - BET + 2250000);
});

for (const id of ['dice', 'trader', 'goal', 'plinko']) test(`${id} accepts large funded stakes and preserves the displayed full payout`, () => {
  const player = wallet();
  const game = createInstantGame(id, player, { randomInt: (size) => size === 2 ? 1 : size === 5 ? 4 : 0, round });
  assert.equal(game.play(BET, { direction: id === 'dice' ? 'under' : 'up', risk: 'low', rows: 12 }), null);
  if (id === 'goal') {
    assert.equal(game.shoot(0), null);
    assert.ok(game.getState().availablePayout > 1000000);
    assert.equal(game.cashout(), null);
  }
  const state = game.getState();
  assert.equal(state.payout, payoutFor(BET, state.multiplier));
  assert.equal(player.getState().balance, BANK - BET + state.payout);
  assert.ok(state.payout > 1000000);
});

test('concurrent Plinko accepts large stakes, reserves each liability and pays each ball once', () => {
  const player = wallet();
  const session = createPlinkoSession(player, { seed: () => 1, round });
  const first = session.drop(BET, { risk: 'low' }).ball;
  const second = session.drop(BET, { risk: 'low' }).ball;
  assert.ok(first && second);
  assert.equal(player.getState().balance, BANK - 2 * BET);
  const payouts = [second, first].map((ball) => session.land(ball.id).round.payout);
  assert.equal(player.getState().balance, BANK - 2 * BET + payouts[0] + payouts[1]);
  assert.equal(session.land(first.id).round, null);
  assert.ok(createPlinkoSession(wallet(MAX_BALANCE)).drop(BET).error);
});

test('roulette all-in and repeat can exceed 100k and a multi-million win settles in full', () => {
  const rack = createBettingRack();
  assert.equal(rack.allIn('red', 2000001), 2000001);
  const saved = rack.snapshot();
  rack.clear(); rack.restore(saved, 2000001);
  assert.equal(stakeTotal(rack.totals()), 2000001);
  assert.throws(() => rack.restore(saved, 2000000));
  assert.equal(stakeTotal(rack.totals()), 2000001);
  const player = wallet();
  const result = settleRound(player, { red: BET }, 1, { round });
  assert.equal(result.payout, 4070000);
  assert.equal(player.getState().balance, BANK - BET + 4070000);
});

test('large bets still reject insufficient funds and technical wallet overflow before spending', () => {
  for (const id of ['dice', 'trader', 'goal', 'plinko']) {
    const poor = wallet(100);
    const game = createInstantGame(id, poor);
    assert.ok(game.play(BET));
    assert.equal(poor.getState().balance, 100);
    const rich = wallet(MAX_BALANCE);
    assert.ok(createInstantGame(id, rich).play(BET));
    assert.equal(rich.getState().balance, MAX_BALANCE);
  }
});
