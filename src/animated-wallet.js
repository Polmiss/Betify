// Keep the visible amount stable while a result is being revealed. Accounting
// stays immediate so closing a tab cannot discard an already settled payout.
export function createAnimatedWallet(player) {
  const locks = new Set();
  const deferredDebits = new Map();
  const listeners = new Set();
  let heldBalance;
  function getDisplayState() {
    const state = player.getState();
    const offset = [...deferredDebits.values()].reduce((total, amount) => total + amount, 0);
    return { ...state, balance: locks.size ? heldBalance : state.balance + offset };
  }
  function notify() { listeners.forEach((listener) => listener(getDisplayState())); }
  player.subscribe(notify);
  return {
    ...player,
    getDisplayState,
    subscribeDisplay(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    deferDebit(amount) {
      if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid deferred stake');
      const token = {};
      deferredDebits.set(token, amount);
      // Register before the debit; its notification publishes the unchanged amount.
      return () => { if (deferredDebits.delete(token)) notify(); };
    },
    beginAnimation() {
      if (!locks.size) heldBalance = getDisplayState().balance;
      const token = {};
      locks.add(token);
      return () => { if (locks.delete(token) && !locks.size) notify(); };
    },
  };
}
