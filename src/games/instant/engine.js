import { MAX_BALANCE } from '../../store.js';
import { PLINKO_ROWS, PLINKO_ROWS_OPTIONS } from './plinko-physics.js';
import { plinkoFlight, PLINKO_RELEASE_COUNT } from './plinko-release.js';
import { TARGET_RTP, uniformInteger, roundPayout } from '../../rtp.js';
import { PLINKO_TABLES, plinkoPaytable } from './plinko-tables.js';
export { PLINKO_ROWS, PLINKO_ROWS_OPTIONS, plinkoPaytable };

export const MIN_BET = 10;
export const MAX_PAYOUT = MAX_BALANCE;
export const MAX_MULTIPLIER = 1000;
export const GOAL_SHOTS = 10;
export const PLINKO_PAYTABLES = PLINKO_TABLES[PLINKO_ROWS];

export const drawInteger = uniformInteger;

export const payoutFor = (bet, multiplier) => Math.min(MAX_PAYOUT, Math.floor(bet * multiplier + 1e-8));

export function diceOffer(threshold, direction) {
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > 98 || !['under', 'over'].includes(direction)) return null;
  const probability = (direction === 'under' ? threshold : 100 - threshold) / 100;
  return { probability, multiplier: TARGET_RTP / probability };
}

export function minesOffer(mines, revealed, bet = 0) {
  if (!Number.isInteger(mines) || mines < 1 || mines > 24 || !Number.isInteger(revealed) || revealed < 0 || revealed > 25 - mines) return null;
  let probability = 1;
  for (let i = 0; i < revealed; i++) probability *= (25 - mines - i) / (25 - i);
  return { probability, multiplier: revealed ? TARGET_RTP / probability : 1,
    nextProbability: revealed < 25 - mines ? (25 - mines - revealed) / (25 - revealed) : 0 };
}

export function goalOffer(wins, bet = 0) {
  return { probability: 0.8, multiplier: wins ? TARGET_RTP / 0.8 ** wins : 1,
    nextMultiplier: TARGET_RTP / 0.8 ** (wins + 1) };
}

export function createInstantGame(id, player, { randomInt = drawInteger, round = roundPayout } = {}) {
  if (!['dice', 'mines', 'trader', 'goal', 'plinko'].includes(id)) throw new Error('Nieznana gra.');
  let state = { id, phase: 'ready', bet: 0, multiplier: 1, payout: 0, outcome: null, result: null, history: [] };
  let bombs = [];
  let pending;
  let closed = false;
  const limit = (bet) => Math.min(MAX_MULTIPLIER, (MAX_BALANCE - player.getState().balance) / bet);
  const hasRoom = (bet, multiplier) => player.getState().balance - bet + Math.ceil(bet * multiplier) <= MAX_BALANCE;
  const walletError = 'Za mało miejsca w portfelu na pełną wypłatę. Zmniejsz stawkę.';
  function random(size) {
    const value = randomInt(size);
    if (!Number.isInteger(value) || value < 0 || value >= size) throw new Error('Nieprawidłowy wynik losowania.');
    return value;
  }
  function validate(bet) {
    if (closed) return 'Gra jest zamknięta.';
    if (['playing', 'settling'].includes(state.phase)) return 'Najpierw zakończ obecną rundę.';
    if (!Number.isSafeInteger(bet) || bet < MIN_BET) return 'Wpisz całkowitą stawkę od 10 żetonów.';
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
    const payout = pending.payout;
    if (player.getState().balance + payout > MAX_BALANCE) return 'Brak miejsca na pełną wypłatę w portfelu.';
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
    return finish('cashout', round(state.bet * state.multiplier));
  }
  function play(bet, options = {}) {
    const error = validate(bet);
    if (error) return error;
    // Generate and validate all immediate results before debiting the wallet.
    if (id === 'dice') {
      const { threshold = 50, direction = 'under' } = options;
      const offer = diceOffer(threshold, direction);
      if (!offer) return 'Wybierz próg 2–98 i kierunek zakładu.';
      if (!hasRoom(bet, offer.multiplier)) return walletError;
      const roll = random(10000);
      const won = direction === 'under' ? roll < threshold * 100 : roll >= threshold * 100;
      const payout = won ? round(bet * offer.multiplier) : 0;
      const debitError = begin(bet, { result: { roll, threshold, direction }, multiplier: offer.multiplier });
      return debitError || finish(won ? 'win' : 'lose', payout);
    }
    if (id === 'trader') {
      const { direction = 'up' } = options;
      if (!['up', 'down'].includes(direction)) return 'Wybierz wzrost albo spadek.';
      if (!hasRoom(bet, TARGET_RTP / .5)) return walletError;
      const previous = state.result?.prices?.at(-1) || 1000;
      const movement = random(2) === 1 ? 'up' : 'down';
      const change = 10 + random(41);
      const price = Math.round(previous * (1 + (movement === 'up' ? 1 : -1) * change / 1000) * 100) / 100;
      const prices = [...(state.result?.prices || [1000]), price].slice(-24);
      const multiplier = TARGET_RTP / .5;
      const payout = direction === movement ? round(bet * multiplier) : 0;
      const debitError = begin(bet, { result: { direction, movement, previous, price, prices }, multiplier });
      return debitError || finish(direction === movement ? 'win' : 'lose', payout);
    }
    if (id === 'plinko') {
      const { risk = 'low', rows = PLINKO_ROWS } = options;
      if (!Object.hasOwn(PLINKO_PAYTABLES, risk)) return 'Wybierz niskie, średnie albo wysokie ryzyko.';
      if (!PLINKO_ROWS_OPTIONS.includes(rows)) return 'Wybierz 8, 12 albo 16 rzędów.';
      if (!hasRoom(bet, Math.max(...plinkoPaytable(risk, rows)))) return walletError;
      const flight = plinkoFlight(random(PLINKO_RELEASE_COUNT), rows);
      const { slot, landingX } = flight;
      const multiplier = plinkoPaytable(risk, rows)[slot];
      const payout = round(bet * multiplier);
      const debitError = begin(bet, { result: { flight, slot, landingX, risk, rows }, multiplier });
      return debitError || finish(payout > bet ? 'win' : payout === bet ? 'push' : 'lose', payout);
    }
    if (id === 'mines') {
      const { mines = 3 } = options;
      if (!minesOffer(mines, 0)) return 'Wybierz od 1 do 24 min.';
      if (!hasRoom(bet, minesOffer(mines, 1).multiplier)) return walletError;
      const board = Array.from({ length: 25 }, (_, index) => index);
      for (let i = 24; i > 0; i--) { const j = random(i + 1); [board[i], board[j]] = [board[j], board[i]]; }
      const debitError = begin(bet, { mines, revealed: [], wins: 0 });
      if (!debitError) bombs = board.slice(0, mines);
      return debitError;
    }
    if (!hasRoom(bet, goalOffer(0).nextMultiplier)) return walletError;
    return begin(bet, { wins: 0, shots: [] });
  }
  function reveal(index) {
    if (id !== 'mines' || state.phase !== 'playing') return 'Najpierw rozpocznij rundę Mines.';
    if (!Number.isInteger(index) || index < 0 || index > 24 || state.revealed.includes(index)) return 'Wybierz nieodkryte pole.';
    state.revealed.push(index);
    if (bombs.includes(index)) { state.hit = index; return finish('lose', 0); }
    state.wins++;
    state.multiplier = minesOffer(state.mines, state.wins, state.bet).multiplier;
    if (state.wins === 25 - state.mines || minesOffer(state.mines, state.wins + 1).multiplier > limit(state.bet)) return cashout();
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
    if (state.wins === GOAL_SHOTS || goalOffer(state.wins).nextMultiplier > limit(state.bet)) return cashout();
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
