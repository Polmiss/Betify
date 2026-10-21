import { MAX_BALANCE } from '../../store.js';
import { MIN_BET, MAX_BET, MAX_PAYOUT, drawInteger } from './engine.js';
import { PLINKO_ROWS_OPTIONS } from './plinko-physics.js';
import { plinkoFlight, PLINKO_RELEASE_COUNT } from './plinko-release.js';
import { roundPayout } from '../../rtp.js';
import { plinkoPaytable } from './plinko-tables.js';

export function createPlinkoSession(player, { seed = () => drawInteger(PLINKO_RELEASE_COUNT), round = roundPayout } = {}) {
  const pending = new Map();
  const history = [];
  let nextId = 1;
  let closed = false;
  const pendingStake = () => [...pending.values()].reduce((sum, ball) => sum + ball.bet, 0);
  const liability = () => [...pending.values()].reduce((sum, ball) => sum + ball.maxPayout, 0);
  return {
    drop(bet, { risk = 'low', rows = 12 } = {}) {
      if (closed) return { error: 'Gra jest zamknięta.' };
      if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET) return { error: 'Wpisz całkowitą stawkę od 10 do 5 000 żetonów.' };
      if (!PLINKO_ROWS_OPTIONS.includes(rows) || !['low', 'medium', 'high'].includes(risk)) return { error: 'Wybierz poprawny kolor i liczbę rzędów.' };
      if (pending.size && [...pending.values()][0].rows !== rows) return { error: 'Poczekaj na kulki przed zmianą liczby rzędów.' };
      player.refresh?.(false);
      if (player.getState().balance < bet) return { error: 'Za mało dostępnych żetonów na kolejną kulkę.' };
      const maxPayout = Math.ceil(bet * Math.max(...plinkoPaytable(risk, rows)));
      if (maxPayout > MAX_PAYOUT) return { error: 'Zmniejsz stawkę, aby każda pełna wypłata mieściła się w limicie 1 000 000.' };
      if (player.getState().balance - bet + liability() + maxPayout > MAX_BALANCE) return { error: 'Brak miejsca w portfelu na pełne wypłaty wszystkich kulek.' };
      const flight = plinkoFlight(seed(), rows);
      if (!player.debit(bet)) return { error: 'Nie udało się pobrać stawki.' };
      const ball = { id: nextId++, bet, risk, rows, flight, slot: flight.slot, maxPayout, multiplier: plinkoPaytable(risk, rows)[flight.slot] };
      pending.set(ball.id, ball);
      return { ball: { ...ball } };
    },
    land(id) {
      const ball = pending.get(id);
      if (!ball) return { round: null };
      player.refresh?.(false);
      ball.payout ??= round(ball.bet * ball.multiplier);
      const payout = ball.payout;
      if (player.getState().balance + payout > MAX_BALANCE) return { error: 'Brak miejsca w portfelu na pełną wypłatę. Ponów rozliczenie po zwolnieniu miejsca.' };
      if (payout && !player.credit(payout)) return { error: 'Nie udało się rozliczyć kulki. Ponów rozliczenie.' };
      pending.delete(id);
      const result = { id, bet: ball.bet, payout, multiplier: ball.multiplier, risk: ball.risk, slot: ball.slot, capped: false };
      history.unshift(result);
      history.splice(8);
      return { round: { ...result } };
    },
    getState() {
      return { active: pending.size, pendingStake: pendingStake(), availableBalance: player.getState().balance,
        ids: [...pending.keys()], history: history.map((round) => ({ ...round })) };
    },
    close() { closed = true; },
  };
}
