import test from 'node:test';
import assert from 'node:assert/strict';
import { createMines as createMinesEngine, createBoard, calculateOdds, randomIndex, MAX_PAYOUT } from '../src/games/mines/engine.js';
import { createPlayerStore, MAX_BALANCE } from '../src/store.js';

// Fix only the rounding branch in gameplay fixtures; rtp.test verifies both
// branches and the expectation of the production rounding implementation.
const createMines = (player, options = {}) => createMinesEngine(player, { round: (value) => Math.floor(value + 1e-8), ...options });

function table({ balance = 10000, layout = [22, 23, 24], pick = () => 0 } = {}) {
  const player = createPlayerStore({ getItem: () => JSON.stringify({ balance }), setItem() {} });
  let boardCalls = 0;
  const game = createMines(player, { boardFactory: () => { boardCalls++; return [...layout]; }, pick });
  return { player, game, calls: () => boardCalls };
}
function choose(n, k) { let value = 1; for (let i = 1; i <= k; i++) value = value * (n - i + 1) / i; return value; }

test('multipliers match the combinatorial probability for every supported mine count', () => {
  for (let mines = 1; mines <= 24; mines++) {
    for (let opened = 1; opened <= 25 - mines; opened++) {
      const odds = calculateOdds(mines, opened, 100);
      const successChance = choose(25 - mines, opened) / choose(25, opened);
      assert.ok(Math.abs(odds.multiplier * successChance - .99) < 1e-10);
      assert.equal(odds.safeRemaining, 25 - mines - opened);
      assert.ok(Math.abs(odds.nextChance - (25 - mines - opened) / (25 - opened)) < 1e-12);
    }
  }
  assert.equal(calculateOdds(3, 0).multiplier, 1);
  assert.equal(calculateOdds(3, 1).availablePayout, 0);
  assert.ok(Math.abs(calculateOdds(3, 22).multiplier - 2277) < 1e-8);
  assert.equal(calculateOdds(24, 1).nextMultiplier, null);
  const capped = calculateOdds(12, 12, 5000);
  assert.equal(capped.effectiveMultiplier, MAX_BALANCE / 5000);
  assert.equal(capped.effectiveNextMultiplier, MAX_BALANCE / 5000);
  assert.equal(capped.availablePayout, MAX_PAYOUT);
});

test('random sampling rejects the biased tail and creates distinct in-range positions', () => {
  let calls = 0;
  assert.equal(randomIndex(25, { getRandomValues(v) { v[0] = calls++ ? 7 : 2 ** 32 - 1; } }), 7);
  assert.equal(calls, 2);
  for (let mines = 1; mines <= 24; mines++) {
    const board = createBoard(mines);
    assert.equal(board.length, mines);
    assert.equal(new Set(board).size, mines);
    assert.ok(board.every((i) => i >= 0 && i < 25));
  }
  assert.deepEqual(createBoard(3, () => 0), [23, 24, 0]);
});

test('invalid settings and insufficient funds never debit the wallet', () => {
  const { game, player } = table({ balance: 100 });
  for (const bet of [0, -1, 9, 10.5, 5001, NaN, Infinity, '100', 101]) {
    assert.equal(typeof game.start(bet, 3), 'string');
    assert.equal(player.getState().balance, 100);
  }
  for (const mines of [0, 25, -1, 2.5, '3', NaN]) assert.equal(typeof game.start(100, mines), 'string');
  assert.equal(typeof game.reveal(0), 'string');
  assert.equal(game.start(100, 3), null);
  assert.equal(player.getState().balance, 0);
  assert.equal(typeof game.start(10, 3), 'string');
  assert.equal(typeof game.configure(5), 'string');
  assert.equal(game.getState().mineCount, 3);
});

test('the board is fixed once, hidden before cashout, and the first pick can lose', () => {
  const { game, player, calls } = table();
  game.start(100, 3);
  assert.ok(game.getState().cells.every((cell) => cell.kind === 'hidden'));
  game.reveal(0); game.reveal(1);
  assert.equal(calls(), 1);
  assert.equal(game.getState().cells[24].kind, 'hidden');
  game.cashout();
  assert.equal(game.getState().cells.filter((cell) => cell.kind === 'mine').length, 3);
  assert.equal(game.getState().cells[22].kind, 'mine');
  const first = table({ layout: [0] });
  first.game.start(100, 1); first.game.reveal(0);
  assert.equal(first.game.getState().outcome, 'mine');
  assert.equal(first.player.getState().balance, 9900);
  assert.ok(player.getState().balance > 10000);
});

test('repeated or invalid reveals cannot increase the multiplier or debit again', () => {
  const { game, player } = table();
  game.start(100, 3); game.reveal(0);
  const multiplier = game.getState().multiplier;
  for (const index of [0, -1, 25, 2.5, '2', NaN]) assert.equal(typeof game.reveal(index), 'string');
  assert.equal(game.getState().opened.length, 1);
  assert.equal(game.getState().multiplier, multiplier);
  assert.equal(player.getState().balance, 9900);
});

test('cashout is locked before the first gem and pays a rounded amount once', () => {
  const { game, player } = table();
  game.start(100, 3);
  assert.equal(typeof game.cashout(), 'string');
  game.reveal(0);
  assert.equal(game.getState().availablePayout, 112);
  assert.equal(game.cashout(), null);
  assert.equal(game.getState().payout, 112);
  assert.equal(player.getState().balance, 10012);
  game.cashout(); game.close(); game.reveal(1);
  assert.equal(player.getState().balance, 10012);
});

test('a mine loses all accumulated uncollected winnings', () => {
  const { game, player } = table();
  game.start(100, 3); game.reveal(0); game.reveal(1); game.reveal(22);
  assert.equal(game.getState().outcome, 'mine');
  assert.equal(game.getState().payout, 0);
  assert.equal(game.getState().hit, 22);
  game.close(); game.cashout();
  assert.equal(player.getState().balance, 9900);
});

test('clearing every safe tile automatically cashes out, including the 24-mine case', () => {
  const { game, player } = table({ layout: Array.from({ length: 24 }, (_, i) => i) });
  game.start(100, 24); game.reveal(24);
  assert.equal(game.getState().outcome, 'cleared');
  assert.equal(game.getState().payout, 2475);
  assert.equal(player.getState().balance, 12375);
  const one = table({ layout: [24] });
  one.game.start(100, 1);
  for (let i = 0; i < 24; i++) one.game.reveal(i);
  assert.equal(one.game.getState().outcome, 'cleared');
  assert.equal(one.player.getState().balance, 12375);
});

test('random pick samples unrevealed cells and can select a mine', () => {
  const { game, player } = table({ layout: [0], pick: () => 0 });
  game.start(100, 1); game.randomPick();
  assert.equal(game.getState().outcome, 'mine');
  assert.equal(player.getState().balance, 9900);
  const safe = table();
  safe.game.start(100, 3); safe.game.randomPick(); safe.game.randomPick();
  assert.deepEqual(safe.game.getState().opened, [0, 1]);
});

test('the payout cap ends the round automatically', () => {
  const layout = Array.from({ length: 12 }, (_, i) => i + 13);
  const { game, player } = table({ layout });
  game.start(5000, 12);
  for (let i = 0; i < 13 && game.getState().phase === 'playing'; i++) game.reveal(i);
  assert.equal(game.getState().outcome, 'limit');
  assert.ok(game.getState().payout < MAX_PAYOUT);
  assert.equal(game.getState().payout, Math.floor(5000 * game.getState().multiplier + 1e-8));
  assert.equal(player.getState().balance, 5000 + game.getState().payout);
});

test('closing refunds untouched rounds and cashes out discovered gems exactly once', () => {
  const empty = table();
  empty.game.start(100, 3); empty.game.close(); empty.game.close();
  assert.equal(empty.player.getState().balance, 10000);
  assert.equal(empty.game.getState().outcome, 'cancelled');
  const played = table();
  played.game.start(100, 3); played.game.reveal(0); played.game.close(); played.game.close();
  assert.equal(played.player.getState().balance, 10012);
  played.player.resetBalance(); played.game.close();
  assert.equal(played.player.getState().balance, 10000);
});

test('snapshots do not leak or mutate mine layout, and bad layouts never debit', () => {
  const { game } = table();
  game.start(100, 3); game.reveal(0);
  const state = game.getState();
  state.cells[24].kind = 'gem'; state.opened.push(24);
  assert.equal(game.getState().cells[24].kind, 'hidden');
  assert.deepEqual(game.getState().opened, [0]);
  const bad = table({ layout: [0, 0, 2] });
  assert.throws(() => bad.game.start(100, 3));
  assert.equal(bad.player.getState().balance, 10000);
});

test('cashout respects the wallet cap, and failed credit remains retryable', () => {
  const near = table({ balance: MAX_BALANCE - 1 });
  assert.ok(near.game.start(100, 3));
  assert.equal(near.player.getState().balance, MAX_BALANCE - 1);
  const real = table();
  let blocked = true;
  const wallet = { ...real.player, credit: (value) => blocked ? false : real.player.credit(value) };
  const game = createMines(wallet, { boardFactory: () => [22, 23, 24] });
  game.start(100, 3); game.reveal(0);
  assert.equal(typeof game.cashout(), 'string');
  assert.equal(game.getState().phase, 'playing');
  blocked = false;
  assert.equal(game.cashout(), null);
  assert.equal(real.player.getState().balance, 10012);
});
