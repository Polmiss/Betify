import test from 'node:test';
import assert from 'node:assert/strict';
import { createInstantGame, diceOffer, minesOffer, goalOffer, payoutFor, drawInteger, PLINKO_PAYTABLES, PLINKO_ROWS_OPTIONS, plinkoPaytable, MAX_PAYOUT } from '../src/games/instant/engine.js';
import { createPlayerStore, MAX_BALANCE, STORAGE_KEY } from '../src/store.js';
import { games } from '../src/catalog.js';

const ids = ['dice', 'mines', 'trader', 'goal', 'plinko'];
function wallet(balance = 10000) {
  const data = new Map([[STORAGE_KEY, JSON.stringify({ balance, favorites: [] })]]);
  return createPlayerStore({ getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) });
}
function sequence(...values) {
  return (size) => { assert.ok(values.length, 'Unexpected extra random draw'); const value = values.shift(); assert.ok(value < size); return value; };
}
// Keeping every shuffle position in place places mines at indexes 0, 1, ... .
const unshuffled = (size) => size - 1;

test('all eight catalog entries now open playable games', () => {
  assert.equal(games.length, 8);
  assert.ok(games.every((game) => game.status === 'playable'));
});

test('uniform integer sampling rejects incomplete buckets and invalid ranges', () => {
  const values = [0xffffffff, 9999];
  assert.equal(drawInteger(10000, { getRandomValues(array) { array[0] = values.shift(); } }), 9999);
  assert.equal(values.length, 0);
  for (const size of [0, -1, NaN, 1.2, 2 ** 32 + 1]) assert.throws(() => drawInteger(size));
});

for (const id of ids) {
  test(`${id}: bad stakes and insufficient funds never debit`, () => {
    const player = wallet();
    const game = createInstantGame(id, player);
    for (const bet of [0, -1, 9, 5001, 20.5, Infinity, NaN, '100']) {
      assert.ok(game.play(bet));
      assert.equal(player.getState().balance, 10000);
    }
    player.debit(9995);
    assert.ok(game.play(10));
    assert.equal(player.getState().balance, 5);
  });
  test(`${id}: close is idempotent and prohibits new rounds`, () => {
    const player = wallet();
    const game = createInstantGame(id, player, { randomInt: unshuffled });
    assert.equal(game.play(100), null);
    const balance = player.getState().balance;
    assert.equal(game.close(), null);
    assert.equal(player.getState().balance, ['mines', 'goal'].includes(id) ? 10000 : balance);
    game.close();
    const final = player.getState().balance;
    assert.ok(game.play(100));
    assert.equal(player.getState().balance, final);
  });
}

test('Dice displayed probabilities match all 10,000 outcomes for both directions', () => {
  for (let threshold = 2; threshold <= 98; threshold++) {
    const under = diceOffer(threshold, 'under');
    const over = diceOffer(threshold, 'over');
    assert.ok(Math.abs(under.probability * 10000 - threshold * 100) < 1e-9);
    assert.ok(Math.abs(over.probability * 10000 - (10000 - threshold * 100)) < 1e-9);
    assert.ok(Math.abs(under.multiplier * under.probability - 0.99) < 1e-12);
    assert.ok(Math.abs(over.multiplier * over.probability - 0.99) < 1e-12);
  }
  for (const threshold of [1, 99, NaN, 2.5]) assert.equal(diceOffer(threshold, 'under'), null);
  assert.equal(diceOffer(50, 'sideways'), null);
});

test('Dice threshold equality belongs to over; integer payouts settle once', () => {
  for (const [direction, roll, expected] of [['under', 4999, 198], ['under', 5000, 0], ['over', 5000, 198], ['over', 4999, 0], ['under', 0, 198], ['over', 9999, 198]]) {
    const player = wallet();
    const game = createInstantGame('dice', player, { randomInt: () => roll });
    assert.equal(game.play(100, { threshold: 50, direction }), null);
    assert.equal(game.getState().payout, expected);
    assert.equal(player.getState().balance, 9900 + expected);
    assert.ok(game.retry()); game.close();
    assert.equal(player.getState().balance, 9900 + expected);
  }
});

test('invalid game options and random-source failures cannot consume a stake', () => {
  for (const [id, options] of [['dice', { threshold: 101 }], ['dice', { direction: 'bad' }], ['mines', { mines: 25 }], ['mines', { mines: 0 }], ['trader', { direction: 'flat' }], ['plinko', { risk: '__proto__' }]]) {
    const player = wallet();
    assert.ok(createInstantGame(id, player).play(100, options));
    assert.equal(player.getState().balance, 10000);
  }
  for (const id of ['dice', 'mines', 'trader', 'plinko']) {
    const player = wallet();
    assert.throws(() => createInstantGame(id, player, { randomInt: () => -1 }).play(100));
    assert.equal(player.getState().balance, 10000);
  }
});

test('Mines has a fixed hidden board and rejects duplicate/invalid reveals', () => {
  const player = wallet();
  const game = createInstantGame('mines', player, { randomInt: unshuffled });
  game.play(100, { mines: 3 });
  assert.deepEqual(game.getState().bombs, []);
  assert.ok(game.play(100));
  assert.ok(game.cashout());
  for (const index of [-1, 25, 1.1, '4']) assert.ok(game.reveal(index));
  assert.equal(game.reveal(3), null);
  assert.equal(game.getState().wins, 1);
  assert.ok(game.reveal(3));
  assert.equal(player.getState().balance, 9900);
  assert.equal(game.reveal(0), null);
  assert.deepEqual(game.getState().bombs, [0, 1, 2]);
  assert.equal(game.getState().payout, 0);
  assert.ok(game.cashout());
  game.close(); assert.equal(player.getState().balance, 9900);
});

test('Mines combinatorial odds, cashout and all-safe completion are exact', () => {
  assert.equal(minesOffer(3, 1).probability, 22 / 25);
  assert.equal(minesOffer(3, 2).probability, 22 / 25 * 21 / 24);
  assert.equal(minesOffer(3, 2).nextProbability, 20 / 23);
  const player = wallet();
  const game = createInstantGame('mines', player, { randomInt: unshuffled });
  game.play(101, { mines: 3 }); game.reveal(3); game.reveal(4);
  const expected = Math.floor(101 * 0.99 / (22 / 25 * 21 / 24));
  assert.equal(game.getState().availablePayout, expected);
  assert.equal(game.cashout(), null);
  assert.equal(player.getState().balance, 10000 - 101 + expected);
  assert.ok(game.cashout());
  const last = createInstantGame('mines', wallet(), { randomInt: unshuffled });
  last.play(100, { mines: 24 }); last.reveal(24);
  assert.equal(last.getState().phase, 'finished');
  assert.equal(last.getState().payout, 2475);
});

test('Mines auto-cashes at the payout limit and never exceeds it', () => {
  const game = createInstantGame('mines', wallet(), { randomInt: unshuffled });
  game.play(5000, { mines: 12 });
  for (let index = 12; index < 25 && game.getState().phase === 'playing'; index++) game.reveal(index);
  assert.equal(game.getState().phase, 'finished');
  assert.equal(game.getState().payout, MAX_PAYOUT);
});

test('Goal evaluates all 25 shot/keeper combinations and loses uncollected winnings', () => {
  for (let zone = 0; zone < 5; zone++) {
    let wins = 0;
    for (let keeper = 0; keeper < 5; keeper++) {
      const player = wallet();
      const game = createInstantGame('goal', player, { randomInt: () => keeper });
      game.play(100); game.shoot(zone);
      assert.equal(game.getState().result.scored, zone !== keeper);
      if (zone !== keeper) { wins++; game.cashout(); assert.equal(player.getState().balance, 10023); }
      else assert.equal(player.getState().balance, 9900);
    }
    assert.equal(wins, 4);
  }
  const player = wallet();
  const game = createInstantGame('goal', player, { randomInt: sequence(0, 1) });
  game.play(100); game.shoot(1); game.shoot(1);
  assert.equal(game.getState().payout, 0);
  assert.equal(player.getState().balance, 9900);
});

test('Goal draws once per shot, validates zones and auto-cashes after ten goals', () => {
  const player = wallet();
  const game = createInstantGame('goal', player, { randomInt: () => 0 });
  game.play(100);
  for (const zone of [-1, 5, NaN, '1', 1.5]) assert.ok(game.shoot(zone));
  assert.equal(game.getState().shots.length, 0);
  for (let index = 1; index <= 10; index++) {
    assert.equal(game.shoot(1), null);
    assert.equal(game.getState().wins, index);
    assert.ok(Math.abs(game.getState().multiplier - goalOffer(index, 100).multiplier) < 1e-12);
  }
  assert.equal(game.getState().phase, 'finished');
  assert.equal(game.getState().payout, Math.floor(100 * 0.99 / 0.8 ** 10));
  assert.ok(game.shoot(1)); assert.ok(game.cashout());
});

test('Mines and Goal close refund before the first move or cash out after wins exactly once', () => {
  for (const id of ['mines', 'goal']) {
    const player = wallet();
    const game = createInstantGame(id, player, { randomInt: unshuffled });
    game.play(100);
    if (id === 'mines') game.reveal(24); else game.shoot(0);
    const payout = game.getState().availablePayout;
    assert.ok(payout > 100);
    game.close(); game.close();
    assert.equal(player.getState().balance, 9900 + payout);
  }
});

test('Trader direction, movement size and 1.98 payout match the shown chart', () => {
  const player = wallet();
  const game = createInstantGame('trader', player, { randomInt: sequence(1, 0, 0, 40) });
  game.play(100, { direction: 'up' });
  assert.equal(game.getState().result.price, 1010);
  assert.equal(game.getState().payout, 198);
  game.play(100, { direction: 'up' });
  assert.equal(game.getState().result.price, 959.5);
  assert.deepEqual(game.getState().result.prices, [1000, 1010, 959.5]);
  assert.equal(game.getState().payout, 0);
  assert.equal(player.getState().balance, 9998);
});

test('Plinko physics determines the bucket and the chosen color determines its payout', () => {
  for (const rows of PLINKO_ROWS_OPTIONS) {
    for (const seed of [0, 17, 2026]) {
      let positions;
      for (const risk of ['low', 'medium', 'high']) {
        const player = wallet();
        const game = createInstantGame('plinko', player, { randomInt: () => seed });
        assert.equal(game.play(101, { risk, rows }), null);
        const state = game.getState();
        assert.equal(state.result.slot, state.result.flight.slot);
        assert.equal(state.multiplier, plinkoPaytable(risk, rows)[state.result.slot]);
        assert.equal(state.payout, payoutFor(101, state.multiplier));
        assert.equal(player.getState().balance, 9899 + state.payout);
        if (positions) assert.deepEqual(state.result.flight.frames, positions, 'risk must not steer the ball');
        positions = state.result.flight.frames;
        state.result.flight.frames[0].x = -100;
        assert.notEqual(game.getState().result.flight.frames[0].x, -100);
        positions = game.getState().result.flight.frames;
      }
    }
  }
});

test('Plinko tables cover every bucket for all three colors and all board sizes', () => {
  for (const rows of PLINKO_ROWS_OPTIONS) {
    for (const risk of Object.keys(PLINKO_PAYTABLES)) {
      const table = plinkoPaytable(risk, rows);
      assert.equal(table.length, rows + 1);
      assert.deepEqual(table, [...table].reverse());
      assert.ok(table.every((value) => Number.isFinite(value) && value > 0));
    }
  }
  const player = wallet();
  const game = createInstantGame('plinko', player);
  assert.ok(game.play(100, { rows: 10 }));
  assert.equal(player.getState().balance, 10000);
});
test('wallet cap, failed credit retry and duplicate settlement cannot create extra tokens', () => {
  const player = wallet(MAX_BALANCE);
  const game = createInstantGame('dice', player, { randomInt: () => 0 });
  game.play(100);
  assert.equal(player.getState().balance, MAX_BALANCE);
  assert.equal(game.getState().payout, 100);
  assert.equal(game.getState().capped, true);
  const other = wallet();
  let fail = true;
  const retried = createInstantGame('dice', { ...other, credit: (amount) => !fail && other.credit(amount) }, { randomInt: () => 0 });
  assert.ok(retried.play(100));
  assert.equal(retried.getState().phase, 'settling');
  assert.ok(retried.play(100));
  assert.equal(other.getState().balance, 9900);
  fail = false;
  assert.equal(retried.retry(), null);
  assert.equal(other.getState().balance, 10098);
  assert.ok(retried.retry()); retried.close();
  assert.equal(other.getState().balance, 10098);
});

test('state snapshots cannot expose or mutate the live board, results or history', () => {
  const game = createInstantGame('mines', wallet(), { randomInt: unshuffled });
  game.play(100); game.reveal(24);
  const snapshot = game.getState();
  snapshot.revealed.push(4); snapshot.wins = 20; snapshot.bombs.push(24);
  assert.deepEqual(game.getState().revealed, [24]);
  assert.equal(game.getState().wins, 1);
  game.cashout(); game.getState().history[0].payout = MAX_PAYOUT;
  assert.notEqual(game.getState().history[0].payout, MAX_PAYOUT);
});

test('hundreds of mixed rounds preserve wallet invariants and bounded histories', () => {
  const player = wallet(1000000);
  let debit = 0;
  let credits = 0;
  for (const id of ids) {
    const game = createInstantGame(id, player);
    for (let index = 0; index < 100; index++) {
      assert.equal(game.play(10), null);
      debit += 10;
      if (id === 'mines') game.reveal(index % 25);
      if (id === 'goal') game.shoot(index % 5);
      if (game.getState().phase === 'playing') game.cashout();
      credits += game.getState().payout;
      assert.equal(player.getState().balance, 1000000 - debit + credits);
      assert.ok(game.getState().history.length <= 8);
      assert.ok(Number.isSafeInteger(player.getState().balance));
    }
    game.close();
  }
});
