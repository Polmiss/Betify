import test from 'node:test';
import assert from 'node:assert/strict';
import { createRouletteClock, BETTING_MS, SPIN_MS, ROUND_MS } from '../src/games/roulette/round-clock.js';
import { createBettingRack } from '../src/games/roulette/betting.js';
import { createPlayerStore } from '../src/store.js';
import { settleRound, calculateResult } from '../src/games/roulette/engine.js';
import { createRoundReporter } from '../src/round-results.js';

test('automatic starts are 15 seconds apart, with editable bets for 10s and a locked 5s spin', () => {
  let now = 0;
  const starts = [], opens = [];
  const clock = createRouletteClock({ now: () => now, onSpin: (state) => starts.push(state.startedAt), onBetting: (state) => opens.push(state.startedAt) });
  assert.equal(ROUND_MS, 15000);
  assert.equal(clock.getState().seconds, 10);
  now = BETTING_MS - 1; assert.equal(clock.canBet(), true);
  now++; assert.equal(clock.canBet(), false, 'the deadline closes bets even before the UI timer runs');
  for (let i = 0; i < 20; i++) clock.advance();
  assert.deepEqual(starts, [10000], 'repeated timer/animation/input ticks cannot spin twice');
  now += SPIN_MS - 1; assert.equal(clock.canBet(), false);
  now++; assert.equal(clock.canBet(), true);
  assert.equal(clock.getState().seconds, 10);
  now += BETTING_MS; clock.advance();
  now += SPIN_MS; clock.advance();
  now += BETTING_MS; clock.advance();
  assert.deepEqual(starts, [10000, 25000, 40000]);
  assert.deepEqual(opens, [15000, 30000]);
});

test('background throttling never replays missed rounds and always opens a full betting window', () => {
  let now = 0, starts = 0, opens = 0;
  const clock = createRouletteClock({ now: () => now, onSpin: () => starts++, onBetting: () => opens++ });
  now = 1000000; clock.advance(); clock.advance();
  assert.equal(starts, 1); assert.equal(opens, 0);
  assert.equal(clock.getState().remainingMs, SPIN_MS);
  now += 1000000; clock.advance();
  assert.equal(starts, 1); assert.equal(opens, 1);
  assert.equal(clock.getState().remainingMs, BETTING_MS);
  assert.equal(clock.canBet(), true);
});

test('leaving or resetting closes the old clock permanently', () => {
  let now = 0, starts = 0;
  const old = createRouletteClock({ now: () => now, onSpin: () => starts++ });
  old.close(); old.close();
  now = 100000; old.advance();
  assert.equal(old.canBet(), false); assert.equal(starts, 0);
  const fresh = createRouletteClock({ now: () => now, onSpin: () => starts++ });
  assert.equal(fresh.getState().seconds, 10);
  now += BETTING_MS; old.advance(); fresh.advance();
  assert.equal(starts, 1);
});

test('timed acceptance consumes a draft once, ignores empty spins and never repeats a paid bet', () => {
  let now = 0, pocket = 32, result, closedBets;
  const player = createPlayerStore({ getItem: () => null, setItem() {} });
  const rack = createBettingRack();
  const results = [];
  const reporter = createRoundReporter((round) => results.push(round));
  const clock = createRouletteClock({ now: () => now,
    onSpin() {
      closedBets = rack.snapshot();
      result = rack.size ? settleRound(player, rack.totals(), pocket, { round: Math.floor }) : calculateResult({}, pocket);
      if (result.stake) reporter.begin();
    },
    onBetting() { reporter.report({ phase: 'finished', bet: result.stake, payout: result.payout }); rack.clear(); },
  });
  rack.add('red', 100, player.getState().balance);
  assert.equal(player.getState().balance, 10000, 'drafts are editable without charging');
  now = BETTING_MS; clock.advance();
  assert.deepEqual(closedBets, [{ id: 'red', amount: 100 }]);
  assert.equal(player.getState().balance, 10103);
  assert.equal(clock.canBet(), false);
  assert.equal(results.length, 0, 'history waits for the reveal');
  now += SPIN_MS; clock.advance();
  assert.equal(results.length, 1); assert.equal(rack.size, 0);
  const balance = player.getState().balance;
  for (let i = 0; i < 4; i++) { now += BETTING_MS; clock.advance(); now += SPIN_MS; clock.advance(); }
  assert.equal(player.getState().balance, balance);
  assert.equal(results.length, 1, 'empty rounds are not player wins, losses or pushes');
  assert.equal(result.stake, 0);
});
