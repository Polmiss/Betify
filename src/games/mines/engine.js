import { MAX_BALANCE } from '../../store.js';

export const TILE_COUNT = 25;
export const MIN_BET = 10;
export const MAX_BET = 5000;
export const MAX_PAYOUT = 1000000;

export function randomIndex(limit, random = globalThis.crypto) {
  if (!Number.isInteger(limit) || limit < 1 || limit > TILE_COUNT) throw new Error('Nieprawidłowy zakres losowania.');
  const value = new Uint32Array(1);
  const cutoff = 2 ** 32 - (2 ** 32 % limit);
  do { random.getRandomValues(value); } while (value[0] >= cutoff);
  return value[0] % limit;
}

function validMines(count) { return Number.isInteger(count) && count >= 1 && count <= 24; }

// A partial Fisher-Yates shuffle samples distinct positions before the first pick.
export function createBoard(mineCount, pick = randomIndex) {
  if (!validMines(mineCount)) throw new Error('Wybierz od 1 do 24 min.');
  const positions = Array.from({ length: TILE_COUNT }, (_, i) => i);
  for (let i = TILE_COUNT - 1; i >= TILE_COUNT - mineCount; i--) {
    const j = pick(i + 1);
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(TILE_COUNT - mineCount);
}

export function calculateOdds(mineCount, safePicks, bet = 0) {
  if (!validMines(mineCount) || !Number.isInteger(safePicks) || safePicks < 0 || safePicks > TILE_COUNT - mineCount) throw new Error('Nieprawidłowy stan planszy.');
  let fairMultiplier = 1;
  for (let i = 0; i < safePicks; i++) fairMultiplier *= (TILE_COUNT - i) / (TILE_COUNT - mineCount - i);
  const multiplier = safePicks === 0 ? 1 : fairMultiplier * .99;
  const safeRemaining = TILE_COUNT - mineCount - safePicks;
  const nextChance = safeRemaining / (TILE_COUNT - safePicks);
  const nextMultiplier = safeRemaining ? fairMultiplier * (TILE_COUNT - safePicks) / safeRemaining * .99 : null;
  const payout = (value) => Math.min(MAX_PAYOUT, Math.floor(bet * value + 1e-8));
  return { multiplier, safeRemaining, nextChance, nextMultiplier,
    effectiveMultiplier: bet > 0 ? Math.min(multiplier, MAX_PAYOUT / bet) : multiplier,
    effectiveNextMultiplier: nextMultiplier === null ? null : bet > 0 ? Math.min(nextMultiplier, MAX_PAYOUT / bet) : nextMultiplier,
    availablePayout: safePicks ? payout(multiplier) : 0,
    nextPayout: nextMultiplier === null ? null : payout(nextMultiplier) };
}

export function createMines(player, { boardFactory = createBoard, pick = randomIndex } = {}) {
  let state = { phase: 'ready', mineCount: 3, bet: 0, opened: [], hit: null, payout: 0, outcome: null };
  let mines = new Set();
  const odds = () => calculateOdds(state.mineCount, state.opened.length, state.bet);
  function settle(outcome, desiredPayout) {
    if (state.phase !== 'playing') return 'Ta runda jest już zakończona.';
    const payout = Math.min(desiredPayout, MAX_BALANCE - player.getState().balance);
    if (payout > 0 && !player.credit(payout)) return 'Nie udało się rozliczyć żetonów. Spróbuj ponownie odebrać wygraną.';
    state = { ...state, phase: 'finished', outcome, payout };
    return null;
  }
  function cashout() {
    if (state.phase !== 'playing' || state.opened.length === 0) return 'Najpierw odkryj przynajmniej jeden diament.';
    return settle('cashout', odds().availablePayout);
  }
  function reveal(index) {
    if (state.phase !== 'playing') return 'Najpierw rozpocznij rundę.';
    if (!Number.isInteger(index) || index < 0 || index >= TILE_COUNT) return 'Nieprawidłowe pole.';
    if (state.opened.includes(index)) return 'To pole jest już odkryte.';
    if (mines.has(index)) { state = { ...state, phase: 'finished', hit: index, outcome: 'mine', payout: 0 }; return null; }
    state.opened.push(index);
    if (state.opened.length === TILE_COUNT - state.mineCount) return settle('cleared', odds().availablePayout);
    if (odds().availablePayout >= MAX_PAYOUT) return settle('limit', MAX_PAYOUT);
    return null;
  }
  return {
    getState() {
      const finished = state.phase === 'finished';
      return { ...state, opened: [...state.opened], ...odds(),
        cells: Array.from({ length: TILE_COUNT }, (_, index) => ({
          index, selected: state.opened.includes(index) || state.hit === index,
          kind: state.opened.includes(index) ? 'gem' : finished ? mines.has(index) ? 'mine' : 'gem' : 'hidden',
        })) };
    },
    configure(mineCount) {
      if (state.phase === 'playing') return 'Nie można zmienić liczby min w trakcie rundy.';
      if (!validMines(mineCount)) return 'Wybierz od 1 do 24 min.';
      state = { phase: 'ready', mineCount, bet: 0, opened: [], hit: null, payout: 0, outcome: null };
      mines = new Set();
      return null;
    },
    start(bet, mineCount = state.mineCount) {
      if (state.phase === 'playing') return 'Najpierw zakończ obecną rundę.';
      if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET) return 'Wybierz całkowitą stawkę od 10 do 5 000 żetonów.';
      if (!validMines(mineCount)) return 'Wybierz od 1 do 24 min.';
      if (player.getState().balance < bet) return 'Za mało żetonów. Możesz zresetować saldo w nagłówku.';
      const layout = boardFactory(mineCount);
      if (!Array.isArray(layout) || layout.length !== mineCount || new Set(layout).size !== mineCount || layout.some((i) => !Number.isInteger(i) || i < 0 || i >= TILE_COUNT)) throw new Error('Nieprawidłowy układ min.');
      if (!player.debit(bet)) return 'Nie udało się pobrać stawki.';
      mines = new Set(layout);
      state = { phase: 'playing', mineCount, bet, opened: [], hit: null, payout: 0, outcome: null };
      return null;
    },
    reveal,
    randomPick() {
      if (state.phase !== 'playing') return 'Najpierw rozpocznij rundę.';
      const candidates = Array.from({ length: TILE_COUNT }, (_, i) => i).filter((i) => !state.opened.includes(i));
      return reveal(candidates[pick(candidates.length)]);
    },
    cashout,
    close() {
      if (state.phase !== 'playing') return null;
      return state.opened.length ? cashout() : settle('cancelled', state.bet);
    },
  };
}
