import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerStore, INITIAL_BALANCE, MAX_BALANCE, STORAGE_KEY } from '../src/store.js';
import { filterGames } from '../src/catalog.js';

function memoryStorage(initial = null) {
  const values = new Map(initial === null ? [] : [[STORAGE_KEY, initial]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('wallet prevents overdrafts, non-integer amounts and balance overflow', () => {
  const player = createPlayerStore(memoryStorage());
  for (const amount of [-1, 0, 1.5, NaN, Infinity, '100']) {
    assert.equal(player.credit(amount), false);
    assert.equal(player.debit(amount), false);
  }
  assert.equal(player.debit(INITIAL_BALANCE + 1), false);
  assert.equal(player.credit(MAX_BALANCE), false);
  assert.equal(player.getState().balance, INITIAL_BALANCE);
  assert.equal(player.debit(INITIAL_BALANCE), true);
  assert.equal(player.getState().balance, 0);
});

test('balance and favorites survive recreation; reset preserves favorites', () => {
  const storage = memoryStorage();
  const player = createPlayerStore(storage);
  player.credit(5000);
  player.toggleFavorite('blackjack');
  const restored = createPlayerStore(storage);
  assert.equal(restored.getState().balance, 15000);
  assert.deepEqual(restored.getState().favorites, ['blackjack']);
  restored.resetBalance();
  assert.equal(restored.getState().balance, INITIAL_BALANCE);
  assert.deepEqual(restored.getState().favorites, ['blackjack']);
});

test('corrupt saved data cannot introduce invalid balances or game IDs', () => {
  const player = createPlayerStore(memoryStorage(JSON.stringify({ balance: -500, favorites: ['blackjack', 'unknown', 'blackjack', 42] })));
  assert.equal(player.getState().balance, INITIAL_BALANCE);
  assert.deepEqual(player.getState().favorites, ['blackjack']);
  assert.equal(createPlayerStore(memoryStorage('{invalid')).getState().balance, INITIAL_BALANCE);
});

test('blocked browser storage still permits an in-memory session', () => {
  const storage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const player = createPlayerStore(storage);
  assert.equal(player.credit(5000), true);
  player.toggleFavorite('mines');
  assert.equal(player.getState().balance, 15000);
  assert.deepEqual(player.getState().favorites, ['mines']);
  assert.equal(player.getState().persistent, false);
});

test('state snapshots cannot mutate the stored favorites', () => {
  const player = createPlayerStore(memoryStorage());
  player.toggleFavorite('roulette');
  player.getState().favorites.push('dice');
  assert.deepEqual(player.getState().favorites, ['roulette']);
  player.toggleFavorite('unknown');
  assert.deepEqual(player.getState().favorites, ['roulette']);
});

test('search composes with category and favorite filters, including Polish characters', () => {
  assert.deepEqual(filterGames({ category: 'cards', query: 'poker' }).map((game) => game.id), ['poker']);
  assert.equal(filterGames({ category: 'instant', query: 'poker' }).length, 0);
  assert.deepEqual(filterGames({ category: 'favorites', favorites: ['mines'], query: 'min' }).map((game) => game.id), ['mines']);
  assert.equal(filterGames({ query: 'stolowe' }).length, 1);
  assert.equal(filterGames({ query: '  BLACKJACK ' }).length, 1);
});
