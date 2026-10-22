import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { TARGET_RTP, roundPayout, payoutBounds, payoutLabel } from '../src/rtp.js';
import { BETS, WHEEL, calculateResult, settleRound } from '../src/games/roulette/engine.js';
import { diceOffer, goalOffer, createInstantGame } from '../src/games/instant/engine.js';
import { calculateOdds, createMines } from '../src/games/mines/engine.js';
import { choicesFor, createHighLow } from '../src/games/high-low/engine.js';
import { PLINKO_TABLES } from '../src/games/instant/plinko-tables.js';
import { PLINKO_DISTRIBUTION } from '../src/games/instant/plinko-distribution.js';
import { plinkoFlight, PLINKO_RELEASE_COUNT } from '../src/games/instant/plinko-release.js';
import { simulatePlinko } from '../src/games/instant/plinko-physics.js';
import { createPlinkoSession } from '../src/games/instant/plinko-session.js';
import { createBlackjackAnalysis, BLACKJACK_WIN_RETURN } from '../src/games/blackjack-math.js';
import { createBlackjack } from '../src/games/blackjack-engine.js';
import { createPlayerStore, MAX_BALANCE } from '../src/store.js';

const near = (actual, expected = TARGET_RTP, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} != ${expected}`);
// Exact expectation of the production 32-bit rounding draw (no Monte Carlo).
const roundedExpectation = (amount) => {
  const { low, high, expected } = payoutBounds(amount);
  return low === high ? low : low + Math.ceil((expected - low) * 2 ** 32) / 2 ** 32;
};
const wallet = (balance = 100000000) => {
  let saved = JSON.stringify({ balance });
  return createPlayerStore({ getItem: () => saved, setItem: (_, value) => { saved = value; } });
};

test('rounding preserves fractional expectations even at minimum bets; previews never draw', () => {
  assert.equal(roundPayout(12.75, () => .749), 13);
  assert.equal(roundPayout(12.75, () => .75), 12);
  assert.equal(roundPayout(0.06445, () => .01), 1);
  assert.equal(roundPayout(0.06445, () => .1), 0);
  assert.equal(roundPayout(198 + 1e-13, () => { throw Error('no draw for integers'); }), 198);
  assert.equal(payoutLabel(12.75), '12–13');
  for (const amount of [0.06445, 10.999, 12.75, 19.8, 123.75, 366.3, 999999.9]) near(roundedExpectation(amount), amount, 1e-8);
  for (const invalid of [-1, NaN, Infinity]) assert.throws(() => roundPayout(invalid));
  assert.throws(() => roundPayout(12.5, () => 1));
});

test('every roulette bet and stake has 99% expected return after integer settlement rounding', () => {
  for (const id of Object.keys(BETS)) for (const bet of [10, 11, 50, 100, 5000, 100000]) {
    const expectation = WHEEL.reduce((sum, pocket) => sum + roundedExpectation(calculateResult({ [id]: bet }, pocket).payout) / 37, 0);
    near(expectation / bet);
  }
  const bets = { 'number-0': 11, red: 53, high: 100, 'column-2': 27 };
  const expectation = WHEEL.reduce((sum, pocket) => sum + roundedExpectation(calculateResult(bets, pocket).payout) / 37, 0);
  near(expectation / Object.values(bets).reduce((a, b) => a + b, 0));
});

test('Dice, Trader and every Goal cashout depth retain 99% at small and large stakes', () => {
  for (const bet of [10, 11, 101, 5000]) {
    for (let threshold = 2; threshold <= 98; threshold++) for (const direction of ['under', 'over']) {
      const offer = diceOffer(threshold, direction);
      near(offer.probability * roundedExpectation(bet * offer.multiplier) / bet);
    }
    near(.5 * roundedExpectation(bet * 1.98) / bet);
    for (let wins = 1; wins <= 10; wins++) near(.8 ** wins * roundedExpectation(bet * goalOffer(wins).multiplier) / bet);
  }
});

test('Mines retains 99% for every mine count and every reachable cashout depth', () => {
  for (const bet of [10, 11, 101, 5000]) for (let mines = 1; mines <= 24; mines++) {
    let probability = 1;
    for (let picks = 1; picks <= 25 - mines; picks++) {
      probability *= (25 - mines - picks + 1) / (26 - picks);
      const odds = calculateOdds(mines, picks, bet);
      if (Math.ceil(bet * odds.multiplier) > MAX_BALANCE) break;
      near(probability * roundedExpectation(bet * odds.multiplier) / bet);
    }
    const player = wallet();
    const game = createMines(player, { boardFactory: () => Array.from({ length: mines }, (_, i) => 24 - i), round: Math.floor });
    assert.equal(game.start(bet, mines), null);
    let probabilityToFinish = 1;
    for (let i = 0; game.getState().phase === 'playing'; i++) {
      probabilityToFinish *= (25 - mines - i) / (25 - i);
      game.reveal(i);
    }
    const state = game.getState();
    near(probabilityToFinish * state.multiplier);
    assert.ok(player.getState().balance <= MAX_BALANCE);
  }
});

test('High Low charges the 1% edge once and every continuation is fair', () => {
  for (const bet of [10, 11, 101, 5000]) for (let rank = 1; rank <= 13; rank++) {
    for (const choice of Object.values(choicesFor(rank))) {
      const probability = choice.count / 13;
      near(probability * roundedExpectation(bet * TARGET_RTP / probability) / bet);
      for (const current of [1.5, 3, 12.87]) near(probability * (current / probability), current);
    }
  }
});

test('all nine Plinko tables have 99% RTP for their complete finite release distribution', () => {
  assert.equal(PLINKO_RELEASE_COUNT, 32768);
  for (const [rows, risks] of Object.entries(PLINKO_TABLES)) {
    const counts = PLINKO_DISTRIBUTION.counts[rows];
    assert.equal(counts.reduce((a, b) => a + b, 0), PLINKO_RELEASE_COUNT);
    assert.deepEqual(counts, [...counts].reverse());
    for (const table of Object.values(risks)) for (const bet of [10, 11, 101, 5000]) {
      assert.ok(Math.ceil(bet * Math.max(...table)) <= 1000000);
      near(table.reduce((sum, value, slot) => sum + counts[slot] / PLINKO_RELEASE_COUNT * roundedExpectation(bet * value), 0) / bet);
    }
  }
});

test('Plinko calibration matches every physical release and mirrors preserve collision paths', async () => {
  const physics = (await readFile(new URL('../src/games/instant/plinko-physics.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  assert.equal(createHash('sha256').update(physics).digest('hex'), PLINKO_DISTRIBUTION.physicsSha256, 'recalibrate after any physics change');
  for (const rows of [8, 12, 16]) {
    const counts = Array(rows + 1).fill(0);
    for (let seed = 0; seed < PLINKO_DISTRIBUTION.poolSize; seed++) {
      const plan = simulatePlinko(seed, rows);
      counts[plan.slot]++; counts[rows - plan.slot]++;
    }
    assert.deepEqual(counts, PLINKO_DISTRIBUTION.counts[rows]);
    for (const seed of [0, 1, 2026, 16383]) {
      const original = plinkoFlight(seed, rows);
      const mirror = plinkoFlight(seed + PLINKO_DISTRIBUTION.poolSize, rows);
      assert.equal(mirror.slot, rows - original.slot);
      assert.equal(mirror.duration, original.duration);
      for (let i = 0; i < original.frames.length; i++) {
        near(original.frames[i].x + mirror.frames[i].x, 640);
        assert.equal(original.frames[i].y, mirror.frames[i].y);
      }
    }
  }
});

test('Blackjack exact decision-tree expectation is 99% of all stakes including doubles', () => {
  const analysis = createBlackjackAnalysis();
  const expected = analysis.expected();
  near(expected.rtp, TARGET_RTP, 1e-12);
  assert.ok(expected.stake > 1, 'double stakes must be included');
  assert.ok(BLACKJACK_WIN_RETURN < 2 && BLACKJACK_WIN_RETURN > 1.99);
  assert.equal(analysis.recommend(20, false, 10, true), 'stand');
  assert.equal(analysis.recommend(11, false, 6, true), 'double');
  assert.equal(analysis.recommend(11, false, 6, false), 'hit');
});

test('Blackjack actual engine with published hints agrees with analytic RTP in a deterministic simulation', () => {
  let state = 123456789;
  const unit = () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 2 ** 32; };
  const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const game = createBlackjack(wallet(), { drawCard: () => ({ rank: ranks[Math.floor(unit() * 13)], suit: '♠' }), round: (value) => roundPayout(value, unit) });
  let payout = 0, stake = 0;
  for (let i = 0; i < 300000; i++) {
    assert.equal(game.start(100), null);
    while (game.getState().phase === 'playing') game[game.getState().recommendation]();
    payout += game.getState().payout; stake += game.getState().bet;
  }
  near(payout / stake, TARGET_RTP, .006);
});

test('a retry never rerolls payout rounding in Mines, High Low or concurrent Plinko', () => {
  for (const id of ['mines', 'high-low', 'plinko']) {
    const player = wallet();
    let blocked = true, calls = 0;
    const mock = { ...player, credit: (amount) => blocked ? false : player.credit(amount) };
    const round = (amount) => { calls++; return Math.ceil(amount); };
    let finish;
    if (id === 'mines') {
      const game = createMines(mock, { boardFactory: () => [24], round }); game.start(100, 1); game.reveal(0); finish = () => game.cashout();
    } else if (id === 'high-low') {
      const game = createHighLow(mock, { draw: () => ({ rank: 7, suit: '♠' }), round }); game.start(100); game.predict('high'); finish = () => game.cashout();
    } else {
      const game = createPlinkoSession(mock, { seed: () => 1, round }); const { ball } = game.drop(100); finish = () => game.land(ball.id).error;
    }
    assert.ok(finish()); assert.equal(calls, 1);
    assert.ok(finish()); assert.equal(calls, 1);
    blocked = false; assert.ok(!finish()); assert.equal(calls, 1);
  }
});

test('immediate settlements pass the unfloored amount to rounding before debit', () => {
  for (const id of ['dice', 'trader', 'plinko']) {
    const player = wallet(10000);
    const game = createInstantGame(id, player, { randomInt: () => 0, round: (value) => {
      assert.equal(player.getState().balance, 10000);
      assert.notEqual(value % 1, 0);
      return Math.ceil(value);
    } });
    assert.equal(game.play(11, id === 'trader' ? { direction: 'down' } : {}), null);
  }
  const player = wallet(10000);
  const result = settleRound(player, { red: 10 }, 32, { round: (value) => { assert.equal(value, 20.35); return 21; } });
  assert.equal(result.payout, 21); assert.equal(player.getState().balance, 10011);
});
