import { BETS, ROUND_LIMIT } from './engine.js';

export const CHIPS = Object.freeze([10, 50, 100, 500, 1000, 5000, 10000]);
export const chipLabel = (amount) => amount >= 1000 ? `${amount / 1000}k` : String(amount);
// Small denominations let all-in use the exact balance, including blackjack winnings.
const denominations = [1, 5, ...CHIPS];

export function createBettingRack() {
  let placements = [];
  const totals = () => placements.reduce((bets, { id, amount }) => { bets[id] = (bets[id] || 0) + amount; return bets; }, {});
  const snapshot = () => placements.map((chip) => ({ ...chip }));
  function restore(chips, balance) {
    let total = 0;
    const candidate = chips.map(({ id, amount }) => {
      if (!Object.hasOwn(BETS, id) || !denominations.includes(amount)) throw new Error('Nieprawidłowy żeton lub pole.');
      total += amount;
      if (total > ROUND_LIMIT) throw new Error('Limit rundy to 100 000 żetonów.');
      if (total > balance) throw new Error('Za mało żetonów na ten zakład.');
      return { id, amount };
    });
    placements = candidate;
  }
  function append(id, amount, balance) {
    if (!Object.hasOwn(BETS, id) || !denominations.includes(amount)) throw new Error('Nieprawidłowy żeton lub pole.');
    const total = placements.reduce((sum, chip) => sum + chip.amount, 0) + amount;
    if (total > ROUND_LIMIT) throw new Error('Limit rundy to 100 000 żetonów.');
    if (total > balance) throw new Error('Za mało żetonów na ten zakład.');
    placements.push({ id, amount });
  }
  return {
    totals, snapshot,
    stack: (id) => placements.filter((chip) => chip.id === id).map((chip) => chip.amount),
    get size() { return placements.length; },
    add(id, amount, balance) {
      if (!CHIPS.includes(amount)) throw new Error('Nieprawidłowy żeton lub pole.');
      append(id, amount, balance);
    },
    allIn(id, balance) {
      if (!Object.hasOwn(BETS, id) || !Number.isSafeInteger(balance) || balance <= 0) throw new Error('Brak żetonów do postawienia.');
      if (balance > ROUND_LIMIT) throw new Error('All in przekracza limit rundy: 100 000 żetonów.');
      let remaining = balance - placements.reduce((sum, chip) => sum + chip.amount, 0);
      if (remaining <= 0) throw new Error('Całe saldo jest już na stole.');
      const amount = remaining;
      const candidate = snapshot();
      for (const value of denominations.toReversed()) {
        while (remaining >= value) { candidate.push({ id, amount: value }); remaining -= value; }
      }
      restore(candidate, balance);
      return amount;
    },
    remove(id) { const index = placements.findLastIndex((chip) => chip.id === id); return index === -1 ? undefined : placements.splice(index, 1)[0]; },
    undo() { return placements.pop(); },
    clear() { placements = []; },
    restore,
  };
}
