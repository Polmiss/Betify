import { MAX_BALANCE } from '../../store.js';

export const WHEEL = Object.freeze([0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26]);
export const RED = Object.freeze([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const ROUND_LIMIT = 100000;
export const colorOf = (n) => n === 0 ? 'green' : RED.includes(n) ? 'red' : 'black';
const numbers = Array.from({ length: 36 }, (_, i) => i + 1);
const definition = (id, label, pockets, multiplier) => Object.freeze({ id, label, pockets: Object.freeze(pockets), multiplier });
export const BETS = Object.freeze(Object.fromEntries([
  ...Array.from({ length: 37 }, (_, n) => definition(`number-${n}`, `Liczba ${n}`, [n], 36)),
  definition('red', 'Czerwone', [...RED], 2),
  definition('black', 'Czarne', numbers.filter((n) => !RED.includes(n)), 2),
  definition('even', 'Parzyste', numbers.filter((n) => n % 2 === 0), 2),
  definition('odd', 'Nieparzyste', numbers.filter((n) => n % 2 === 1), 2),
  definition('low', '1–18', numbers.slice(0, 18), 2),
  definition('high', '19–36', numbers.slice(18), 2),
  ...[1, 2, 3].map((n) => definition(`dozen-${n}`, `${n}. tuzin`, numbers.slice((n - 1) * 12, n * 12), 3)),
  ...[1, 2, 3].map((n) => definition(`column-${n}`, `${n}. kolumna`, numbers.filter((v) => (v - 1) % 3 === n - 1), 3)),
].map((bet) => [bet.id, bet])));

export function stakeTotal(bets) {
  let total = 0;
  for (const [id, amount] of Object.entries(bets)) {
    if (!Object.hasOwn(BETS, id) || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('Nieprawidłowy zakład.');
    total += amount;
  }
  if (total > ROUND_LIMIT) throw new Error('Limit rundy to 100 000 żetonów.');
  return total;
}

export function calculateResult(bets, pocket) {
  if (!Number.isInteger(pocket) || pocket < 0 || pocket > 36) throw new Error('Nieprawidłowy wynik koła.');
  const stake = stakeTotal(bets);
  const winningIds = Object.keys(bets).filter((id) => BETS[id].pockets.includes(pocket));
  const payout = winningIds.reduce((total, id) => total + bets[id] * BETS[id].multiplier, 0);
  return { pocket, stake, payout, net: payout - stake, winningIds };
}

// Rejection sampling avoids modulo bias: all 37 pockets have equal probability.
export function drawPocket(random = globalThis.crypto) {
  const sample = new Uint32Array(1);
  const limit = Math.floor(2 ** 32 / 37) * 37;
  do { random.getRandomValues(sample); } while (sample[0] >= limit);
  return sample[0] % 37;
}

export function settleRound(player, bets, pocket) {
  const result = calculateResult(bets, pocket);
  if (!result.stake) throw new Error('Najpierw postaw żetony na planszy.');
  const balance = player.getState().balance;
  if (result.stake > balance) throw new Error('Za mało żetonów. Zmniejsz zakłady lub uzupełnij portfel w lobby.');
  // Check the maximum possible return before accepting a round, regardless of its outcome.
  const largestReturn = Math.max(...WHEEL.map((n) => calculateResult(bets, n).payout));
  if (balance - result.stake + largestReturn > MAX_BALANCE) throw new Error('Możliwa wygrana przekracza limit portfela. Zmniejsz stawkę.');
  if (!player.debit(result.stake)) throw new Error('Nie udało się pobrać stawki. Spróbuj ponownie.');
  if (result.payout && !player.credit(result.payout)) {
    player.credit(result.stake);
    throw new Error('Nie udało się rozliczyć rundy. Stawka została zwrócona.');
  }
  // Settlement precedes the cosmetic animation, so closing or reloading cannot lose a payout.
  return result;
}
