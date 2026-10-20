import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundResults, createRoundReporter, ROUND_HISTORY_LIMIT } from '../src/round-results.js';
import { createPlayerStore } from '../src/store.js';
import { createInstantGame } from '../src/games/instant/engine.js';
import { createMines } from '../src/games/mines/engine.js';
import { createHighLow } from '../src/games/high-low/engine.js';
import { createBlackjack } from '../src/games/blackjack-engine.js';
import { settleRound } from '../src/games/roulette/engine.js';

const wallet = () => createPlayerStore({ getItem: () => null, setItem() {} });
const finished = (bet, payout, outcome) => ({ phase: 'finished', bet, payout, outcome });

test('results count net profit, partial returns and pushes correctly, separately for each game', () => {
  const results = createRoundResults();
  results.record('plinko', finished(100, 70, 'lose'));
  results.record('plinko', finished(100, 150, 'win'));
  results.record('plinko', finished(100, 100, 'push'));
  results.record('blackjack', finished(200, 0, 'bust'));
  const plinko = results.get('plinko');
  assert.deepEqual([plinko.wins, plinko.losses, plinko.draws, plinko.net, plinko.rounds], [1, 1, 1, 20, 3]);
  assert.deepEqual(plinko.recent.map((round) => round.net), [0, 50, -30]);
  assert.equal(results.get('blackjack').net, -200);
  assert.equal(results.get('mines').rounds, 0);
  results.record('mines', finished(100, 50, 'cancelled'));
  assert.equal(results.get('mines').net, -50, 'a capped partial refund is still an actual loss');
});

test('recent history is bounded without losing session totals, and snapshots cannot change it', () => {
  const results = createRoundResults();
  for (let round = 0; round < 30; round++) results.record('dice', finished(100, 198));
  const state = results.get('dice');
  assert.equal(state.rounds, 30);
  assert.equal(state.net, 2940);
  assert.equal(state.recent.length, ROUND_HISTORY_LIMIT);
  assert.equal(state.recent[0].number, 30);
  state.wins = 0;
  state.recent[0].net = -100;
  state.recent.length = 0;
  assert.equal(results.get('dice').wins, 30);
  assert.equal(results.get('dice').recent[0].net, 98);
});

test('reporter ignores intermediate states, cancellations, duplicate renders and failed settlement', () => {
  const results = createRoundResults();
  const reporter = createRoundReporter((round) => results.record('goal', round));
  assert.equal(reporter.report(finished(100, 198)), false);
  reporter.begin();
  for (const phase of ['playing', 'settling']) assert.equal(reporter.report({ phase, bet: 100, payout: 198 }), false);
  assert.equal(results.get('goal').rounds, 0);
  assert.equal(reporter.report(finished(100, 198)), true);
  for (let render = 0; render < 10; render++) assert.equal(reporter.report(finished(100, 198)), false);
  reporter.begin();
  reporter.report(finished(100, 100, 'cancelled'));
  assert.equal(results.get('goal').rounds, 1);
  reporter.begin();
  reporter.report(finished(100, 198));
  assert.equal(results.get('goal').rounds, 2, 'identical consecutive results must both count');
});

test('invalid amounts and non-game IDs cannot enter the results', () => {
  const results = createRoundResults();
  for (const [bet, payout] of [[0, 100], [-1, 10], [10, -1], [10.5, 20], [10, Infinity], ['100', 200]]) {
    assert.equal(results.record('dice', { bet, payout }), false);
  }
  assert.equal(results.record('unknown', { bet: 100, payout: 198 }), false);
  assert.equal(results.get('dice').rounds, 0);
});

test('settled results from all eight engines agree with their actual wallet changes', () => {
  const results = createRoundResults();
  function check(id, play) {
    const player = wallet();
    const before = player.getState().balance;
    const reporter = createRoundReporter((round) => results.record(id, round));
    const state = play(player, reporter);
    reporter.report(state);
    reporter.report(state);
    const result = results.get(id);
    assert.equal(result.rounds, 1, id);
    assert.equal(result.net, player.getState().balance - before, id);
  }
  for (const id of ['dice', 'trader', 'goal', 'plinko']) {
    check(id, (player, reporter) => {
      const game = createInstantGame(id, player, { randomInt: () => 0 });
      assert.equal(game.play(100, { direction: id === 'trader' ? 'down' : 'under' }), null);
      reporter.begin();
      if (id === 'goal') { game.shoot(1); game.cashout(); }
      return game.getState();
    });
  }
  check('mines', (player, reporter) => {
    const game = createMines(player, { boardFactory: () => [0, 1, 2] });
    game.start(100, 3); reporter.begin(); game.reveal(24); game.cashout();
    return game.getState();
  });
  check('high-low', (player, reporter) => {
    let rank = 5;
    const game = createHighLow(player, { draw: () => ({ rank: rank++, suit: '♠' }) });
    game.start(100); reporter.begin(); game.predict('high'); game.cashout();
    return game.getState();
  });
  check('blackjack', (player, reporter) => {
    const game = createBlackjack(player, { shoeFactory: () => ['10', '9', '8', '8', '3'].map((rank) => ({ rank, suit: '♠' })).reverse() });
    game.start(100); reporter.begin(); game.double();
    return game.getState();
  });
  check('roulette', (player, reporter) => {
    const result = settleRound(player, { 'number-1': 100 }, 1);
    reporter.begin();
    return finished(result.stake, result.payout);
  });
});
