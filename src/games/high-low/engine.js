import { MAX_BALANCE } from '../../store.js';
import { TARGET_RTP, roundPayout } from '../../rtp.js';

export const MIN_BET = 10;
export const MAX_MULTIPLIER = 1000;
export const MAX_PAYOUT = MAX_BALANCE;
export const MAX_SKIPS = 52;
export const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
export const suits = ['♠', '♥', '♦', '♣'];

// Independent draws with replacement: each of the 52 cards has equal probability.
export function drawCard(random = globalThis.crypto) {
  const sample = new Uint32Array(1);
  const cutoff = 2 ** 32 - (2 ** 32 % 52);
  do { random.getRandomValues(sample); } while (sample[0] >= cutoff);
  const index = sample[0] % 52;
  return { rank: index % 13 + 1, suit: suits[Math.floor(index / 13)] };
}

export function choicesFor(rank) {
  if (!Number.isInteger(rank) || rank < 1 || rank > 13) throw new Error('Nieprawidłowa ranga karty.');
  return {
    high: { label: rank === 13 ? 'Taka sama' : rank === 1 ? 'Wyżej' : 'Wyżej lub taka sama', count: rank === 13 ? 1 : rank === 1 ? 12 : 14 - rank },
    low: { label: rank === 1 ? 'Taka sama' : rank === 13 ? 'Niżej' : 'Niżej lub taka sama', count: rank === 1 ? 1 : rank === 13 ? 12 : rank },
  };
}

export function isCorrect(previous, next, direction) {
  choicesFor(previous); choicesFor(next);
  if (direction === 'high') return previous === 13 ? next === 13 : previous === 1 ? next > 1 : next >= previous;
  if (direction === 'low') return previous === 1 ? next === 1 : previous === 13 ? next < 13 : next <= previous;
  return false;
}

export function createHighLow(player, { draw = drawCard, round = roundPayout } = {}) {
  let pending;
  function nextCard() {
    const card = draw();
    choicesFor(card.rank);
    if (!suits.includes(card.suit)) throw new Error('Nieprawidłowy kolor karty.');
    return { ...card };
  }
  let state = { phase: 'ready', card: nextCard(), bet: 0, multiplier: 1, wins: 0, skips: 0, payout: 0, outcome: null, history: [] };
  const value = (multiplier = state.multiplier) => Math.min(MAX_PAYOUT, Math.floor(state.bet * multiplier + 1e-8));
  function offers() {
    return Object.fromEntries(Object.entries(choicesFor(state.card.rank)).map(([direction, choice]) => {
      const probability = choice.count / 13;
      const multiplier = state.multiplier * (state.wins === 0 ? TARGET_RTP : 1) / probability;
      return [direction, { ...choice, probability, multiplier, payout: value(multiplier) }];
    }));
  }
  function settle(outcome, desiredPayout) {
    if (state.phase !== 'playing') return 'Ta runda jest już zakończona.';
    // Other tabs share the wallet; never overflow it if its balance changed mid-round.
    pending ??= { outcome, payout: round(desiredPayout) };
    const payout = pending.payout;
    if (player.getState().balance + payout > MAX_BALANCE) return 'Brak miejsca w portfelu na pełną wypłatę.';
    if (payout > 0 && !player.credit(payout)) return 'Nie udało się rozliczyć żetonów. Spróbuj ponownie.';
    state = { ...state, phase: 'finished', outcome: pending.outcome, payout };
    pending = undefined;
    return null;
  }
  function cashout() {
    if (state.phase !== 'playing' || state.wins === 0) return 'Najpierw traf przynajmniej jeden typ.';
    return settle('cashout', state.bet * state.multiplier);
  }
  const atLimit = () => Object.values(offers()).some((offer) => offer.multiplier > MAX_MULTIPLIER || Math.ceil(state.bet * offer.multiplier) > MAX_BALANCE - player.getState().balance);
  return {
    getState() {
      return { ...state, card: { ...state.card }, history: state.history.map((entry) => ({ ...entry, card: { ...entry.card } })),
        offers: offers(), availablePayout: state.wins > 0 ? value() : 0 };
    },
    start(bet) {
      if (state.phase === 'playing') return 'Najpierw zakończ obecną serię.';
      if (!Number.isSafeInteger(bet) || bet < MIN_BET) return 'Wybierz całkowitą stawkę od 10 żetonów.';
      if (player.getState().balance < bet) return 'Za mało żetonów. Możesz zresetować saldo w nagłówku.';
      if (player.getState().balance - bet + Math.ceil(bet * TARGET_RTP * 13) > MAX_BALANCE) return 'Za mało miejsca w portfelu na pełną wypłatę. Zmniejsz stawkę.';
      if (!player.debit(bet)) return 'Nie udało się pobrać stawki.';
      pending = undefined;
      state = { ...state, phase: 'playing', bet, multiplier: 1, wins: 0, skips: 0, payout: 0, outcome: null,
        history: [{ card: { ...state.card }, result: 'start' }] };
      return null;
    },
    predict(direction) {
      if (state.phase !== 'playing') return 'Najpierw rozpocznij grę.';
      if (pending) return 'Najpierw ponów odbiór oczekującej wypłaty.';
      if (!['high', 'low'].includes(direction)) return 'Wybierz wyżej albo niżej.';
      const offer = offers()[direction];
      if (player.getState().balance + Math.ceil(state.bet * offer.multiplier) > MAX_BALANCE) return 'Za mało miejsca w portfelu na tę wygraną. Odbierz żetony lub wybierz inny kierunek.';
      const previous = state.card.rank;
      const card = nextCard();
      const won = isCorrect(previous, card.rank, direction);
      state.card = card;
      state.history.push({ card: { ...card }, result: won ? 'win' : 'lose', direction });
      state.history = state.history.slice(-12);
      if (!won) { state.phase = 'finished'; state.outcome = 'lose'; return null; }
      state.wins++;
      state.multiplier = offer.multiplier;
      if (atLimit()) return settle('limit', state.bet * state.multiplier);
      return null;
    },
    skip() {
      if (pending) return 'Najpierw ponów odbiór oczekującej wypłaty.';
      if (state.phase === 'playing' && state.skips >= MAX_SKIPS) return 'Wykorzystano 52 pominięcia w tej rundzie.';
      const card = nextCard();
      if (state.phase === 'playing') {
        state.skips++;
        state.history.push({ card: { ...card }, result: 'skip' });
        state.history = state.history.slice(-12);
      }
      state.card = card;
      if (state.phase === 'playing' && state.wins && atLimit()) return settle('limit', state.bet * state.multiplier);
      return null;
    },
    cashout,
    close() {
      if (state.phase !== 'playing') return null;
      return state.wins > 0 ? cashout() : settle('cancelled', state.bet);
    },
  };
}
