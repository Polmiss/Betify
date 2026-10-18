import { MAX_BALANCE } from '../../store.js';

export const MIN_BET = 10;
export const MAX_BET = 5000;
export const MAX_PAYOUT = 1000000;
export const MAX_MULTIPLIER = 1000;
export const GOAL_SHOTS = 10;
export const PLINKO_ROWS = 12;
// Symmetric payouts; binomial landing probabilities come from 12 fair left/right draws.
export const PLINKO_PAYTABLES = {
  low: [8, 3, 1.5, 1.3, 1.1, 0.9, 0.7, 0.9, 1.1, 1.3, 1.5, 3, 8],
  high: [100, 15, 5, 4.3, 0.5, 0.2, 0.1, 0.2, 0.5, 4.3, 5, 15, 100],
};

export function drawInteger(size, random = globalThis.crypto) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 2 ** 32) throw new Error('Nieprawidłowy zakres losowania.');
  const sample = new Uint32Array(1);
  const cutoff = 2 ** 32 - (2 ** 32 % size);
  do { random.getRandomValues(sample); } while (sample[0] >= cutoff);
  return sample[0] % size;
}

const cap = (value, bet) => Math.min(value, MAX_MULTIPLIER, bet ? MAX_PAYOUT / bet : MAX_MULTIPLIER);
export const payoutFor = (bet, multiplier) => Math.min(MAX_PAYOUT, Math.floor(bet * multiplier + 1e-8));

export function diceOffer(threshold, direction) {
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > 98 || !['under', 'over'].includes(direction)) return null;
  const probability = (direction === 'under' ? threshold : 100 - threshold) / 100;
  return { probability, multiplier: 0.99 / probability };
}

export function minesOffer(mines, revealed, bet = 0) {
  if (!Number.isInteger(mines) || mines < 1 || mines > 24 || !Number.isInteger(revealed) || revealed < 0 || revealed > 25 - mines) return null;
  let probability = 1;
  for (let i = 0; i < revealed; i++) probability *= (25 - mines - i) / (25 - i);
  return { probability, multiplier: revealed ? cap(0.99 / probability, bet) : 1,
    nextProbability: revealed < 25 - mines ? (25 - mines - revealed) / (25 - revealed) : 0 };
}

export function goalOffer(wins, bet = 0) {
  return { probability: 0.8, multiplier: wins ? cap(0.99 / 0.8 ** wins, bet) : 1,
    nextMultiplier: cap(0.99 / 0.8 ** (wins + 1), bet) };
}

export function createInstantGame(id, player, { randomInt = drawInteger } = {}) {
  if (!['dice', 'mines', 'trader', 'goal', 'plinko'].includes(id)) throw new Error('Nieznana gra.');
  let state = { id, phase: 'ready', bet: 0, multiplier: 1, payout: 0, outcome: null, result: null, history: [] };
  let bombs = [];
  let pending;
  let closed = false;
  function random(size) {
    const value = randomInt(size);
    if (!Number.isInteger(value) || value < 0 || value >= size) throw new Error('Nieprawidłowy wynik losowania.');
    return value;
  }
  function validate(bet) {
    if (closed) return 'Gra jest zamknięta.';
    if (['playing', 'settling'].includes(state.phase)) return 'Najpierw zakończ obecną rundę.';
    if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET) return 'Wpisz całkowitą stawkę od 10 do 5 000 żetonów.';
    player.refresh?.(false);
    if (player.getState().balance < bet) return 'Za mało żetonów. Możesz zresetować saldo w nagłówku.';
    return null;
  }
  function begin(bet, data = {}) {
    if (!player.debit(bet)) return 'Nie udało się pobrać stawki.';
    state = { id, phase: 'playing', bet, multiplier: 1, payout: 0, outcome: null, result: null, history: state.history, ...data };
    return null;
  }
  function retry() {
    if (state.phase !== 'settling' || !pending) return 'Brak wypłaty do rozliczenia.';
    player.refresh?.(false);
    const payout = Math.max(0, Math.min(pending.payout, MAX_BALANCE - player.getState().balance));
    if (payout > 0 && !player.credit(payout)) return 'Nie udało się rozliczyć wypłaty. Ponów rozliczenie.';
    state.phase = 'finished';
    state.outcome = pending.outcome;
    state.payout = payout;
    state.capped = payout < pending.payout;
    state.history = [{ payout, bet: state.bet, outcome: state.outcome, multiplier: state.multiplier }, ...state.history].slice(0, 8);
    pending = null;
    return null;
  }
  function finish(outcome, payout) {
    if (state.phase !== 'playing') return 'Runda jest już zakończona.';
    pending = { outcome, payout };
    state.phase = 'settling';
    return retry();
  }
  function cashout() {
    if (state.phase !== 'playing' || !['mines', 'goal'].includes(id) || state.wins < 1) return 'Najpierw traf przynajmniej raz.';
    return finish('cashout', payoutFor(state.bet, state.multiplier));
  }
  function play(bet, options = {}) {
    const error = validate(bet);
    if (error) return error;
    // Generate and validate all immediate results before debiting the wallet.
    if (id === 'dice') {
      const { threshold = 50, direction = 'under' } = options;
      const offer = diceOffer(threshold, direction);
      if (!offer) return 'Wybierz próg 2–98 i kierunek zakładu.';
      const roll = random(10000);
      const won = direction === 'under' ? roll < threshold * 100 : roll >= threshold * 100;
      const debitError = begin(bet, { result: { roll, threshold, direction }, multiplier: offer.multiplier });
      return debitError || finish(won ? 'win' : 'lose', won ? payoutFor(bet, offer.multiplier) : 0);
    }
    if (id === 'trader') {
      const { direction = 'up' } = options;
      if (!['up', 'down'].includes(direction)) return 'Wybierz wzrost albo spadek.';
      const previous = state.result?.prices?.at(-1) || 1000;
      const movement = random(2) === 1 ? 'up' : 'down';
      const change = 10 + random(41);
      const price = Math.round(previous * (1 + (movement === 'up' ? 1 : -1) * change / 1000) * 100) / 100;
      const prices = [...(state.result?.prices || [1000]), price].slice(-24);
      const debitError = begin(bet, { result: { direction, movement, previous, price, prices }, multiplier: 1.98 });
      return debitError || finish(direction === movement ? 'win' : 'lose', direction === movement ? payoutFor(bet, 1.98) : 0);
    }
    if (id === 'plinko') {
      const { risk = 'low' } = options;
      if (!Object.hasOwn(PLINKO_PAYTABLES, risk)) return 'Wybierz niskie albo wysokie ryzyko.';
      const path = Array.from({ length: PLINKO_ROWS }, () => random(2));
      const slot = path.reduce((sum, step) => sum + step, 0);
      const multiplier = PLINKO_PAYTABLES[risk][slot];
      const debitError = begin(bet, { result: { path, slot, risk }, multiplier });
      const payout = payoutFor(bet, multiplier);
      return debitError || finish(payout > bet ? 'win' : payout === bet ? 'push' : 'lose', payout);
    }
    if (id === 'mines') {
      const { mines = 3 } = options;
      if (!minesOffer(mines, 0)) return 'Wybierz od 1 do 24 min.';
      const board = Array.from({ length: 25 }, (_, index) => index);
      for (let i = 24; i > 0; i--) { const j = random(i + 1); [board[i], board[j]] = [board[j], board[i]]; }
      const debitError = begin(bet, { mines, revealed: [], wins: 0 });
      if (!debitError) bombs = board.slice(0, mines);
      return debitError;
    }
    return begin(bet, { wins: 0, shots: [] });
  }
  function reveal(index) {
    if (id !== 'mines' || state.phase !== 'playing') return 'Najpierw rozpocznij rundę Mines.';
    if (!Number.isInteger(index) || index < 0 || index > 24 || state.revealed.includes(index)) return 'Wybierz nieodkryte pole.';
    state.revealed.push(index);
    if (bombs.includes(index)) { state.hit = index; return finish('lose', 0); }
    state.wins++;
    state.multiplier = minesOffer(state.mines, state.wins, state.bet).multiplier;
    if (state.wins === 25 - state.mines || state.multiplier >= cap(Infinity, state.bet)) return cashout();
    return null;
  }
  function shoot(zone) {
    if (id !== 'goal' || state.phase !== 'playing') return 'Najpierw rozpocznij serię Goal.';
    if (!Number.isInteger(zone) || zone < 0 || zone > 4) return 'Wybierz jedno z pięciu miejsc strzału.';
    const keeper = random(5);
    const scored = keeper !== zone;
    state.shots.push({ zone, keeper, scored });
    state.result = { zone, keeper, scored };
    if (!scored) return finish('lose', 0);
    state.wins++;
    state.multiplier = goalOffer(state.wins, state.bet).multiplier;
    if (state.wins === GOAL_SHOTS || state.multiplier >= cap(Infinity, state.bet)) return cashout();
    return null;
  }
  return {
    play, reveal, shoot, cashout, retry,
    getState() {
      return structuredClone({ ...state,
        availablePayout: state.phase === 'playing' && state.wins ? payoutFor(state.bet, state.multiplier) : 0,
        // The live board never discloses unselected mines.
        bombs: id === 'mines' && ['settling', 'finished'].includes(state.phase) ? bombs : [],
      });
    },
    close() {
      let error = null;
      if (state.phase === 'settling') error = retry();
      else if (state.phase === 'playing') error = state.wins ? cashout() : finish('cancelled', state.bet);
      if (!error) closed = true;
      return error;
    },
  };
}
