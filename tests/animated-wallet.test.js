import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayerStore } from '../src/store.js';
import { createAnimatedWallet } from '../src/animated-wallet.js';

function wallet() { return createAnimatedWallet(createPlayerStore({ getItem: () => null, setItem() {} })); }

test('each concurrent ball publishes its own result while other stakes stay hidden', () => {
  const player = wallet();
  const first = player.deferDebit(100); player.debit(100);
  const second = player.deferDebit(200); player.debit(200);
  assert.equal(player.getState().balance, 9700);
  assert.equal(player.getDisplayState().balance, 10000);
  const publishFirst = player.beginAnimation();
  player.credit(198); first();
  assert.equal(player.getDisplayState().balance, 10000);
  publishFirst();
  assert.equal(player.getDisplayState().balance, 10098);
  first(); publishFirst();
  assert.equal(player.getDisplayState().balance, 10098);
  const publishSecond = player.beginAnimation(); second(); publishSecond();
  assert.equal(player.getDisplayState().balance, 9898);
  assert.equal(player.getState().balance, 9898);
});

test('cancelled reservation and overlapping cleanup cannot change another stake', () => {
  const player = wallet();
  const first = player.deferDebit(100); player.debit(100);
  const cancelled = player.deferDebit(200); cancelled(); cancelled();
  assert.equal(player.getDisplayState().balance, 10000);
  first();
  assert.equal(player.getDisplayState().balance, 9900);
  assert.throws(() => player.deferDebit(-1));
});

test('debits and payouts remain hidden until the reveal ends, while accounting stays valid', () => {
  const player = wallet();
  const shown = [];
  player.subscribeDisplay((state) => shown.push(state.balance));
  const release = player.beginAnimation();
  assert.equal(player.debit(100), true);
  assert.equal(player.credit(198), true);
  assert.equal(player.getState().balance, 10098);
  assert.equal(player.getDisplayState().balance, 10000);
  assert.deepEqual(shown, [10000, 10000]);
  release();
  assert.equal(shown.at(-1), 10098);
  assert.equal(player.getDisplayState().balance, 10098);
  const count = shown.length;
  release();
  assert.equal(shown.length, count, 'cleanup and animation completion cannot publish twice');
});

test('old cleanup cannot release a later animation; insufficient funds use the actual balance', () => {
  const player = wallet();
  const old = player.beginAnimation();
  player.debit(10000);
  assert.equal(player.debit(10), false);
  old();
  const current = player.beginAnimation();
  player.credit(100);
  old();
  assert.equal(player.getDisplayState().balance, 0);
  current();
  assert.equal(player.getDisplayState().balance, 100);
});

test('overlapping reveals hold their starting balance until all releases finish', () => {
  const player = wallet();
  const first = player.beginAnimation();
  player.debit(100);
  const second = player.beginAnimation();
  player.credit(200);
  first();
  assert.equal(player.getDisplayState().balance, 10000);
  second();
  assert.equal(player.getDisplayState().balance, 10100);
  player.resetBalance();
  assert.equal(player.getDisplayState().balance, 10000);
});
