import { BETS, ROUND_LIMIT } from './engine.js';

export const CHIPS = Object.freeze([10, 50, 100, 500, 1000, 5000, 10000]);
export const chipLabel = (amount) => amount >= 1000 ? `${amount / 1000}k` : String(amount);

export function createBettingRack() {
  let placements = [];
  const totals = () => placements.reduce((bets, { id, amount }) => { bets[id] = (bets[id] || 0) + amount; return bets; }, {});
  const snapshot = () => placements.map((chip) => ({ ...chip }));
  return {
    totals, snapshot,
    stack: (id) => placements.filter((chip) => chip.id === id).map((chip) => chip.amount),
    get size() { return placements.length; },
    add(id, amount, balance) {
      if (!Object.hasOwn(BETS, id) || !CHIPS.includes(amount)) throw new Error('Nieprawidłowy żeton lub pole.');
      const total = placements.reduce((sum, chip) => sum + chip.amount, 0) + amount;
      if (total > ROUND_LIMIT) throw new Error('Limit rundy to 100 000 żetonów.');
      if (total > balance) throw new Error('Za mało żetonów na ten zakład.');
      placements.push({ id, amount });
    },
    remove(id) { const index = placements.findLastIndex((chip) => chip.id === id); return index === -1 ? undefined : placements.splice(index, 1)[0]; },
    undo() { return placements.pop(); },
    clear() { placements = []; },
    restore(chips, balance) {
      const candidate = createBettingRack();
      chips.forEach(({ id, amount }) => candidate.add(id, amount, balance));
      placements = candidate.snapshot();
    },
  };
}
