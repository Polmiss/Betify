import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlackjack, drawBlackjackCard, handValue } from '../src/games/blackjack-engine.js';
import { createPlayerStore, MAX_BALANCE, STORAGE_KEY } from '../src/store.js';

const card = (rank) => ({ rank: String(rank), suit: '♠' });
function table(draws, balance = 10000) {
  const storage = { getItem: () => JSON.stringify({ balance }), setItem() {} };
  const player = createPlayerStore(storage);
  const game = createBlackjack(player, { round: (value) => Math.ceil(value - 1e-8), shoeFactory: () => [...Array.from({ length: 60 }, () => card(10)), ...draws.map(card).reverse()] });
  return { player, game };
}

test('aces switch between 1 and 11, including multiple aces', () => {
  assert.deepEqual(handValue(['A', 'A', 9].map(card)), { total: 21, soft: true });
  assert.deepEqual(handValue(['A', 9, 5].map(card)), { total: 15, soft: false });
  assert.deepEqual(handValue(['A', 'A', 'A', 'K'].map(card)), { total: 13, soft: false });
});

test('independent draws map all 52 cards uniformly and allow replacement', () => {
  const cards = Array.from({ length: 52 }, (_, index) => drawBlackjackCard({ getRandomValues: (array) => { array[0] = index; } }));
  assert.equal(new Set(cards.map((card) => card.rank + card.suit)).size, 52);
  assert.equal(cards.filter((card) => card.rank === 'A').length, 4);
  const random = { getRandomValues: (array) => { array[0] = 0; } };
  assert.deepEqual(drawBlackjackCard(random), drawBlackjackCard(random));
});

test('stakes reject invalid amounts and insufficient funds without debiting', () => {
  const { game, player } = table([10, 9, 8, 8], 100);
  for (const bet of [NaN, Infinity, -1, 0, 9, 11, 10.5, 5002, '100', 102]) {
    assert.equal(typeof game.start(bet), 'string');
    assert.equal(player.getState().balance, 100);
  }
  assert.equal(game.start(100), null);
  assert.equal(player.getState().balance, 0);
  assert.equal(typeof game.start(10), 'string');
  assert.equal(game.getState().bet, 100);
});

test('natural blackjack pays 3:2 and cannot be settled twice', () => {
  const { game, player } = table(['A', 9, 'K', 7]);
  game.start(100);
  assert.equal(game.getState().outcome, 'blackjack');
  assert.equal(game.getState().payout, 250);
  assert.equal(player.getState().balance, 10150);
  assert.equal(game.hit(), false);
  assert.equal(game.stand(), false);
  assert.equal(game.double(), false);
  assert.equal(player.getState().balance, 10150);
});

test('two natural blackjacks return only the stake', () => {
  const { game, player } = table(['A', 'K', 'Q', 'A']);
  game.start(100);
  assert.equal(game.getState().outcome, 'push');
  assert.equal(player.getState().balance, 10000);
});

test('dealer blackjack settles before the player can act', () => {
  const { game, player } = table([10, 'A', 9, 'K']);
  game.start(100);
  assert.equal(game.getState().outcome, 'lose');
  assert.equal(game.getState().hidden, false);
  assert.equal(game.hit(), false);
  assert.equal(player.getState().balance, 9900);
});

test('dealer hole card is hidden during play; snapshots cannot mutate the game', () => {
  const { game } = table([10, 9, 8, 8]);
  game.start(100);
  const state = game.getState();
  assert.equal(state.hidden, true);
  assert.equal(state.dealer.length, 1);
  state.player[0].rank = 'A'; state.player.push(card('K'));
  assert.equal(game.getState().player.length, 2);
  assert.equal(game.getState().player[0].rank, '10');
  game.stand();
  assert.equal(game.getState().dealer.length, 2);
});

test('busting loses the stake even if dealer has a weak hand', () => {
  const { game, player } = table([10, 6, 8, 9, 8]);
  game.start(100); game.hit();
  assert.equal(game.getState().outcome, 'bust');
  assert.equal(player.getState().balance, 9900);
});

test('dealer draws below 17 and dealer bust pays the player', () => {
  const { game, player } = table([10, 6, 8, 9, 10]);
  game.start(100); game.stand();
  assert.equal(handValue(game.getState().dealer).total, 25);
  assert.equal(game.getState().outcome, 'win');
  assert.equal(player.getState().balance, 10100);
});

test('dealer stands on soft 17; equal totals push', () => {
  const { game, player } = table([10, 'A', 7, 6, 4]);
  game.start(100); game.stand();
  assert.equal(game.getState().dealer.length, 2);
  assert.equal(game.getState().outcome, 'push');
  assert.equal(player.getState().balance, 10000);
});

test('ordinary loss is settled once and dealer does not draw on hard 17', () => {
  const { game, player } = table([10, 10, 6, 7]);
  game.start(100); game.stand(); game.stand();
  assert.equal(game.getState().outcome, 'lose');
  assert.equal(game.getState().dealer.length, 2);
  assert.equal(player.getState().balance, 9900);
});

test('three-card 21 automatically stands and pays the upper rounding branch', () => {
  const { game, player } = table([5, 10, 6, 8, 'K']);
  game.start(100); game.hit();
  assert.equal(game.getState().outcome, 'win');
  assert.equal(player.getState().balance, 10100);
});

test('doubling debits again, deals one card, and settles both stakes', () => {
  const { game, player } = table([5, 10, 6, 7, 'K']);
  game.start(100);
  assert.equal(game.getState().canDouble, true);
  assert.equal(game.double(), true);
  assert.equal(game.getState().player.length, 3);
  assert.equal(game.getState().bet, 200);
  assert.equal(game.getState().payout, 400);
  assert.equal(player.getState().balance, 10200);
  assert.equal(game.double(), false);
});

test('busting on double loses both stakes', () => {
  const { game, player } = table([10, 10, 6, 7, 'K']);
  game.start(100); game.double();
  assert.equal(game.getState().outcome, 'bust');
  assert.equal(player.getState().balance, 9800);
});

test('doubling is blocked after a hit or without enough funds', () => {
  const { game, player } = table([2, 10, 3, 7, 4]);
  game.start(100); game.hit();
  assert.equal(game.double(), false);
  assert.equal(player.getState().balance, 9900);
  const short = table([5, 10, 6, 7], 100);
  short.game.start(100);
  assert.equal(short.game.getState().canDouble, false);
  assert.equal(short.game.double(), false);
});

test('wallet limit rejects rounds or doubles that cannot be paid', () => {
  const { game, player } = table([5, 10, 6, 7], MAX_BALANCE - 100);
  assert.equal(typeof game.start(100), 'string');
  assert.equal(player.getState().balance, MAX_BALANCE - 100);
  const near = table([5, 10, 6, 7], MAX_BALANCE - 200);
  assert.equal(near.game.start(100), null);
  assert.equal(near.game.getState().canDouble, true);
  near.game.stand();
  assert.equal(near.player.getState().balance, MAX_BALANCE - 300);
});

test('settled balances persist through store recreation', () => {
  let saved;
  const storage = { getItem: (key) => key === STORAGE_KEY ? saved : null, setItem: (_, value) => { saved = value; } };
  const player = createPlayerStore(storage);
  const game = createBlackjack(player, { shoeFactory: () => [card(7), card('K'), card(9), card('A')] });
  game.start(10);
  assert.equal(createPlayerStore(storage).getState().balance, 10015);
});

test('hundreds of complete rounds preserve integer balances and settle only once', () => {
  const player = createPlayerStore({ getItem: () => null, setItem() {} });
  const game = createBlackjack(player);
  for (let round = 0; round < 500; round++) {
    const before = player.getState().balance;
    assert.equal(game.start(10), null);
    if (round % 3 === 0 && game.getState().canDouble) game.double();
    else { while (game.getState().phase === 'playing' && handValue(game.getState().player).total < 16) game.hit(); game.stand(); }
    const state = game.getState();
    assert.equal(state.phase, 'finished');
    assert.equal(player.getState().balance, before - state.bet + state.payout);
    assert.equal(Number.isSafeInteger(player.getState().balance), true);
    game.stand();
    assert.equal(player.getState().balance, before - state.bet + state.payout);
  }
});

test('animated opening blocks moves and waits before settling natural blackjack', () => {
  const { game, player } = table(['A', 9, 'K', 7]);
  game.start(100, { deferOpening: true });
  assert.equal(game.getState().phase, 'dealing');
  assert.equal(game.getState().hidden, true);
  assert.equal(player.getState().balance, 9900);
  assert.equal(game.hit(), false);
  assert.equal(game.double(), false);
  assert.equal(game.beginStand(), false);
  assert.equal(typeof game.start(100), 'string');
  game.resolveOpening();
  assert.equal(game.getState().outcome, 'blackjack');
  assert.equal(player.getState().balance, 10150);
  assert.equal(game.resolveOpening(), false);
});

test('dealer steps reveal, draw one card at a time, and pay only at settlement', () => {
  const { game, player } = table([10, 2, 8, 3, 4, 10]);
  game.start(100);
  game.beginStand();
  assert.equal(game.getState().hidden, false);
  assert.equal(game.getState().dealer.length, 2);
  assert.equal(game.hit(), false);
  assert.equal(game.double(), false);
  assert.equal(typeof game.start(100), 'string');
  game.dealerStep();
  assert.equal(game.getState().dealer.length, 3);
  assert.equal(game.getState().phase, 'dealer');
  game.dealerStep();
  assert.equal(game.getState().dealer.length, 4);
  assert.equal(player.getState().balance, 9900);
  game.dealerStep();
  assert.equal(game.getState().outcome, 'lose');
  assert.equal(game.dealerStep(), false);
  assert.equal(player.getState().balance, 9900);
});

test('double and hitting 21 can defer the dealer turn', () => {
  const doubled = table([5, 10, 6, 7, 'K']);
  doubled.game.start(100);
  doubled.game.double({ deferDealer: true });
  assert.equal(doubled.game.getState().phase, 'dealer');
  assert.equal(doubled.player.getState().balance, 9800);
  doubled.game.dealerStep();
  assert.equal(doubled.player.getState().balance, 10200);
  const hit = table([5, 10, 6, 7, 'K']);
  hit.game.start(100);
  hit.game.hit({ deferDealer: true });
  assert.equal(hit.game.getState().phase, 'dealer');
  assert.equal(hit.player.getState().balance, 9900);
  hit.game.stand();
  assert.equal(hit.player.getState().balance, 10100);
});

test('closing during opening or dealer animation settles exactly once', () => {
  for (const phase of ['dealing', 'dealer']) {
    const { game, player } = table([10, 6, 8, 9, 10]);
    game.start(100, { deferOpening: true });
    if (phase === 'dealer') { game.resolveOpening(); game.beginStand(); }
    game.stand();
    assert.equal(game.getState().outcome, 'win');
    assert.equal(player.getState().balance, 10100);
    game.stand(); game.dealerStep(); game.resolveOpening();
    assert.equal(player.getState().balance, 10100);
  }
});

test('failed settlement freezes rounding until retry, without dealing extra cards', () => {
  const player = createPlayerStore({ getItem: () => null, setItem() {} });
  let fail = true, rounds = 0;
  const game = createBlackjack({ ...player, credit: (amount) => !fail && player.credit(amount) }, {
    shoeFactory: () => [7, 8, 10, 10].map(card),
    round: (amount) => { rounds++; return Math.ceil(amount); },
  });
  game.start(100);
  assert.throws(() => game.stand());
  assert.equal(rounds, 1);
  assert.equal(game.hit(), false);
  fail = false;
  game.stand();
  assert.equal(rounds, 1);
  assert.equal(player.getState().balance, 10100);
  game.stand(); assert.equal(rounds, 1);
});
