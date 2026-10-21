import { MAX_BALANCE } from '../store.js';
import { roundPayout, uniformInteger } from '../rtp.js';
import { BLACKJACK_RETURN, BLACKJACK_WIN_RETURN, blackjackRecommendation } from './blackjack-math.js';

export const MIN_BET = 10;
export const MAX_BET = 5000;
const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const { rank } of cards) {
    if (rank === 'A') { total += 11; aces++; }
    else total += ['J', 'Q', 'K'].includes(rank) ? 10 : Number(rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return { total, soft: aces > 0 };
}

export function drawBlackjackCard(random = globalThis.crypto) {
  const index = uniformInteger(52, random);
  return { rank: ranks[index % 13], suit: suits[Math.floor(index / 13)] };
}

export function createBlackjack(player, { shoeFactory, drawCard = drawBlackjackCard, round = roundPayout } = {}) {
  let shoe = [];
  let pending;
  let state = { phase: 'ready', player: [], dealer: [], bet: 0, outcome: null, payout: 0, doubled: false };
  // Independent draws keep the published strategy/RTP constant across rounds.
  // A custom shoe is available only as an injected deterministic test fixture.
  const draw = () => shoeFactory ? shoe.pop() : drawCard();
  const natural = (hand) => hand.length === 2 && handValue(hand).total === 21;

  function finish(outcome, payout) {
    if (!['playing', 'dealer'].includes(state.phase)) return;
    // Start/double reserve room for the largest possible payout in the wallet.
    pending ??= { outcome, payout: round(payout) };
    const paid = pending.payout;
    if (paid > 0 && !player.credit(paid)) throw new Error('Nie udało się rozliczyć żetonów.');
    state = { ...state, phase: 'finished', outcome: pending.outcome, payout: paid };
    pending = undefined;
  }

  function resolveOpening() {
    if (state.phase !== 'dealing') return false;
    state.phase = 'playing';
    if (natural(state.player) && natural(state.dealer)) finish('push', state.bet);
    else if (natural(state.dealer)) finish('lose', 0);
    else if (natural(state.player)) finish('blackjack', state.bet * BLACKJACK_RETURN);
    return true;
  }

  function beginStand() {
    if (pending) { finish(pending.outcome, pending.payout); return true; }
    if (state.phase !== 'playing') return false;
    state.phase = 'dealer';
    return true;
  }

  // One dealer action per step lets the UI animate without settling early.
  function dealerStep() {
    if (pending) { finish(pending.outcome, pending.payout); return true; }
    if (state.phase !== 'dealer') return false;
    if (handValue(state.dealer).total < 17) { state.dealer.push(draw()); return true; }
    const dealerTotal = handValue(state.dealer).total;
    const playerTotal = handValue(state.player).total;
    if (dealerTotal > 21 || playerTotal > dealerTotal) finish('win', state.bet * BLACKJACK_WIN_RETURN);
    else if (playerTotal === dealerTotal) finish('push', state.bet);
    else finish('lose', 0);
    return true;
  }

  function stand() {
    if (pending) { finish(pending.outcome, pending.payout); return true; }
    resolveOpening();
    if (state.phase === 'playing') beginStand();
    if (state.phase !== 'dealer') return false;
    while (state.phase === 'dealer') dealerStep();
    return true;
  }

  function canDouble() {
    return !pending && state.phase === 'playing' && state.player.length === 2 && !state.doubled &&
      player.getState().balance >= state.bet && player.getState().balance + state.bet * 3 <= MAX_BALANCE;
  }

  return {
    getState() {
      const hidden = ['playing', 'dealing'].includes(state.phase);
      return { ...state, player: state.player.map((card) => ({ ...card })),
        dealer: (hidden ? state.dealer.slice(0, 1) : state.dealer).map((card) => ({ ...card })), hidden, canDouble: canDouble(),
        recommendation: state.phase === 'playing' ? blackjackRecommendation(state.player, state.dealer[0], canDouble()) : null };
    },
    start(bet, { deferOpening = false } = {}) {
      if (!['ready', 'finished'].includes(state.phase)) return 'Najpierw dokończ obecną rundę.';
      if (!Number.isSafeInteger(bet) || bet < MIN_BET || bet > MAX_BET || bet % 2 !== 0) return 'Wybierz parzystą stawkę od 10 do 5 000 żetonów.';
      if (player.getState().balance < bet) return 'Za mało żetonów. Zresetuj saldo w portfelu.';
      if (player.getState().balance + bet * 2 > MAX_BALANCE) return 'Saldo jest zbyt blisko limitu portfela na pełną wypłatę z podwojenia. Wybierz mniejszą stawkę.';
      if (shoeFactory) {
        if (shoe.length < 60) shoe = shoeFactory();
        if (!Array.isArray(shoe) || shoe.length < 4) throw new Error('Brak kart w talii.');
      }
      if (!player.debit(bet)) return 'Nie udało się pobrać stawki.';
      pending = undefined;
      state = { phase: 'dealing', player: [draw()], dealer: [draw()], bet, outcome: null, payout: 0, doubled: false };
      state.player.push(draw()); state.dealer.push(draw());
      if (!deferOpening) resolveOpening();
      return null;
    },
    resolveOpening,
    beginStand,
    dealerStep,
    hit({ deferDealer = false } = {}) {
      if (state.phase !== 'playing' || pending) return false;
      state.player.push(draw());
      const { total } = handValue(state.player);
      if (total > 21) finish('bust', 0);
      else if (total === 21) { if (deferDealer) beginStand(); else stand(); }
      return true;
    },
    stand,
    double({ deferDealer = false } = {}) {
      if (!canDouble() || !player.debit(state.bet)) return false;
      state.bet *= 2; state.doubled = true; state.player.push(draw());
      if (handValue(state.player).total > 21) finish('bust', 0);
      else if (deferDealer) beginStand();
      else stand();
      return true;
    },
  };
}
