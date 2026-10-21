import { MAX_BALANCE } from '../../store.js';
import { MIN_BET, MAX_BET, payoutFor, drawInteger } from './engine.js';
import { simulatePlinko, PLINKO_ROWS_OPTIONS } from './plinko-physics.js';
import { plinkoPaytable } from './plinko-tables.js';

export function createPlinkoSession(player, { seed = () => drawInteger(2 ** 32) } = {}) {
  const pending = new Map();
  const history = [];
  let nextId = 1;
  let closed = false;
  const pendingStake = () => [...pending.values()].reduce((sum, ball) => sum + ball.bet, 0);
  return {
    drop(bet, { risk = 'low', rows = 12 } = {}) {
      if (closed) return { error: 'Gra jest zamknięta.' };
      if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET) return { error: 'Wpisz całkowitą stawkę od 10 do 5 000 żetonów.' };
      if (!PLINKO_ROWS_OPTIONS.includes(rows) || !['low', 'medium', 'high'].includes(risk)) return { error: 'Wybierz poprawny kolor i liczbę rzędów.' };
      if (pending.size && [...pending.values()][0].rows !== rows) return { error: 'Poczekaj na kulki przed zmianą liczby rzędów.' };
      player.refresh?.(false);
      if (player.getState().balance < bet) return { error: 'Za mało dostępnych żetonów na kolejną kulkę.' };
      const flight = simulatePlinko(seed(), rows);
      if (!player.debit(bet)) return { error: 'Nie udało się pobrać stawki.' };
      const ball = { id: nextId++, bet, risk, rows, flight, slot: flight.slot, multiplier: plinkoPaytable(risk, rows)[flight.slot] };
      pending.set(ball.id, ball);
      return { ball: { ...ball } };
    },
    land(id) {
      const ball = pending.get(id);
      if (!ball) return { round: null };
      player.refresh?.(false);
      const desired = payoutFor(ball.bet, ball.multiplier);
      const room = Math.max(0, MAX_BALANCE - player.getState().balance - (pendingStake() - ball.bet));
      const payout = Math.min(desired, room);
      if (payout && !player.credit(payout)) return { error: 'Nie udało się rozliczyć kulki. Ponów rozliczenie.' };
      pending.delete(id);
      const round = { id, bet: ball.bet, payout, multiplier: ball.multiplier, risk: ball.risk, slot: ball.slot, capped: payout < desired };
      history.unshift(round);
      history.splice(8);
      return { round: { ...round } };
    },
    getState() {
      return { active: pending.size, pendingStake: pendingStake(), availableBalance: player.getState().balance,
        ids: [...pending.keys()], history: history.map((round) => ({ ...round })) };
    },
    close() { closed = true; },
  };
}
