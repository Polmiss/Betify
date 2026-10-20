import { games } from './catalog.js';

export const ROUND_HISTORY_LIMIT = 12;
const ids = new Set(games.map((game) => game.id));
const validAmounts = ({ bet, payout }) => Number.isSafeInteger(bet) && bet > 0 && Number.isSafeInteger(payout) && payout >= 0;
const refunded = (round) => round.outcome === 'cancelled' && round.payout === round.bet;
const empty = () => ({ wins: 0, losses: 0, draws: 0, net: 0, rounds: 0, recent: [] });

// A page-session history, deliberately separate from the shared wallet.
export function createRoundResults() {
  const sessions = new Map();
  return {
    record(id, round) {
      if (!ids.has(id) || !validAmounts(round) || refunded(round)) return false;
      const session = sessions.get(id) || empty();
      const net = round.payout - round.bet;
      const result = net > 0 ? 'win' : net < 0 ? 'lose' : 'draw';
      session[result === 'win' ? 'wins' : result === 'lose' ? 'losses' : 'draws']++;
      session.rounds++;
      session.net += net;
      session.recent.unshift({ number: session.rounds, bet: round.bet, payout: round.payout, net, result });
      session.recent.splice(ROUND_HISTORY_LIMIT);
      sessions.set(id, session);
      return true;
    },
    get(id) {
      const session = sessions.get(id) || empty();
      return { ...session, recent: session.recent.map((round) => ({ ...round })) };
    },
  };
}

// The UI starts this after a successful stake, and reports once its reveal ends.
// Re-renders, failed bets and cashout retries must not duplicate a result.
export function createRoundReporter(onRound = () => {}) {
  let pending = false;
  return {
    begin() { pending = true; },
    report(state) {
      if (!pending || state.phase !== 'finished') return false;
      pending = false;
      if (!validAmounts(state) || refunded(state)) return false;
      onRound({ bet: state.bet, payout: state.payout, outcome: state.outcome });
      return true;
    },
  };
}
