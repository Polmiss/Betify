import { games } from './catalog.js';
import { createRoundResults, ROUND_HISTORY_LIMIT } from './round-results.js';
import './round-history.css';

const number = new Intl.NumberFormat('pl-PL');
const signed = (amount) => `${amount > 0 ? '+' : amount < 0 ? '−' : ''}${number.format(Math.abs(amount))}`;
const names = { win: 'Wygrana', lose: 'Przegrana', draw: 'Remis' };

export function mountRoundHistory(root) {
  const results = createRoundResults();
  let active;
  root.innerHTML = `<div class="round-summary"><span class="round-caption" title="Wyniki tej gry w bieżącej karcie. Odświeżenie rozpoczyna nową sesję.">WYNIKI</span><span class="round-count round-win">Wygrane <b data-round-wins>0</b></span><span class="round-count round-lose">Przegrane <b data-round-losses>0</b></span><span class="round-count round-draw">Remisy <b data-round-draws>0</b></span></div><div class="round-recent" role="list" aria-label="Ostatnie ${ROUND_HISTORY_LIMIT} rund, najnowsze z lewej"></div><div class="round-total"><span>Bilans sesji</span><strong>0</strong></div><span class="round-announcement" role="status" aria-live="polite" aria-atomic="true"></span>`;
  const $ = (selector) => root.querySelector(selector);
  function render() {
    const state = results.get(active);
    $('[data-round-wins]').textContent = number.format(state.wins);
    $('[data-round-losses]').textContent = number.format(state.losses);
    $('[data-round-draws]').textContent = number.format(state.draws);
    $('.round-total strong').textContent = signed(state.net);
    $('.round-total').dataset.result = state.net > 0 ? 'win' : state.net < 0 ? 'lose' : 'draw';
    $('.round-recent').innerHTML = state.recent.length ? state.recent.map((round) => `<span role="listitem" class="round-chip round-${round.result}" data-result="${round.result}" title="Runda ${round.number} · Stawka: ${number.format(round.bet)} · Wypłata: ${number.format(round.payout)}" aria-label="Runda ${round.number}: ${names[round.result]}, bilans ${signed(round.net)} żetonów"><i aria-hidden="true">${round.result === 'win' ? '↗' : round.result === 'lose' ? '↘' : '='}</i>${signed(round.net)}</span>`).join('') : '<span class="round-empty">Pierwszy wynik pojawi się po zakończeniu rundy.</span>';
    $('.round-recent').scrollLeft = 0;
  }
  return {
    select(id) {
      active = id;
      const name = games.find((game) => game.id === id)?.name || 'Gra';
      root.setAttribute('aria-label', `${name} — wygrane i przegrane w tej karcie`);
      $('.round-announcement').textContent = '';
      render();
    },
    forGame(id) {
      return (round) => {
        if (!results.record(id, round) || active !== id) return;
        render();
        const latest = results.get(id).recent[0];
        $('.round-announcement').textContent = `Runda ${latest.number}: ${names[latest.result]}, bilans ${signed(latest.net)} żetonów.`;
      };
    },
  };
}
