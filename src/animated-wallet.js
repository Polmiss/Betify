// Keep the visible amount stable while a result is being revealed. Accounting
// stays immediate so closing a tab cannot discard an already settled payout.
export function createAnimatedWallet(player) {
  const locks = new Set();
  const listeners = new Set();
  let heldBalance;
  function getDisplayState() {
    const state = player.getState();
    return { ...state, balance: locks.size ? heldBalance : state.balance };
  }
  function notify() { listeners.forEach((listener) => listener(getDisplayState())); }
  player.subscribe(notify);
  return {
    ...player,
    getDisplayState,
    subscribeDisplay(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    beginAnimation() {
      if (!locks.size) heldBalance = player.getState().balance;
      const token = {};
      locks.add(token);
      return () => { if (locks.delete(token) && !locks.size) notify(); };
    },
  };
}
