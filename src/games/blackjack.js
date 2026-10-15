import { createBlackjack, handValue } from './blackjack-engine.js';
import './blackjack.css';

const number = new Intl.NumberFormat('pl-PL');
const outcomes = { blackjack: 'Blackjack! Idealne rozdanie.', win: 'Wygrywasz tę rundę!', push: 'Remis. Stawka wraca do Ciebie.', lose: 'Tym razem wygrywa krupier.', bust: 'Ponad 21. Wygrywa krupier.' };

export function mountBlackjack(root, player) {
  const game = createBlackjack(player);
  let selectedBet = 100;
  let error = '';
  let rounds = 0;
  let countedRound = false;
  const history = [];

  root.innerHTML = `
    <section class="blackjack" aria-label="Stół do blackjacka">
      <header class="bj-header"><div><span class="eyebrow">BETIFY ORIGINALS · GRY KARCIANE</span><h2 id="dialog-title">Blackjack<span class="mint">.</span></h2><p>Twój ruch. Twoje dwadzieścia jeden.</p></div><span class="bj-table-number">STÓŁ<br><strong>01</strong></span></header>
      <div class="bj-table">
        <div class="bj-seat"><div class="bj-hand-heading"><h3>Krupier</h3><span id="bj-dealer-score" class="bj-score"></span></div><div id="bj-dealer" class="bj-hand" aria-label="Karty krupiera"></div></div>
        <div class="bj-table-brand" aria-hidden="true"><span>♠</span><strong>BLACKJACK PAYS 3:2</strong><small>KRUPIER STOI NA 17 · 6 TALII</small></div>
        <div class="bj-seat"><div class="bj-hand-heading"><h3>Twoje karty</h3><span id="bj-player-score" class="bj-score"></span></div><div id="bj-player" class="bj-hand" aria-label="Twoje karty"></div></div>
        <div class="bj-result" role="status" aria-live="polite" aria-atomic="true"><strong id="bj-message"></strong><span id="bj-detail"></span></div>
      </div>
      <div class="bj-controls">
        <div class="bj-wallet"><span>Twoja pula<strong class="balance-value">${number.format(player.getState().balance)}</strong></span><span>Stawka w grze<strong id="bj-in-play">—</strong></span><span>Rozdania<strong id="bj-rounds">0</strong></span></div>
        <div id="bj-betting"><label class="bj-bet-label" for="bj-bet">STAWKA <span>10–5 000 żetonów · parzysta</span></label><div class="bj-bet-row"><input id="bj-bet" type="number" min="10" max="5000" step="2" value="100" inputmode="numeric" aria-describedby="bj-error"/><div class="bj-chips">${[10, 50, 100, 500].map((amount) => `<button type="button" data-bj-bet="${amount}" aria-pressed="${amount === 100}">${amount}</button>`).join('')}</div></div></div>
        <p id="bj-error" class="bj-error" role="alert"></p>
        <div class="bj-actions"><button class="button button-primary" id="bj-deal">Rozdaj karty <span aria-hidden="true">↗</span></button><button class="button button-primary" id="bj-hit">Dobierz <span aria-hidden="true">＋</span></button><button class="button button-secondary" id="bj-stand">Pasuj <span aria-hidden="true">✓</span></button><button class="button button-secondary" id="bj-double" title="Podwój stawkę i dobierz dokładnie jedną kartę">Podwój ×2</button></div>
        <div class="bj-history" aria-label="Ostatnie wyniki"><span>OSTATNIE RUNDY</span><div id="bj-history">Jeszcze wszystko przed Tobą.</div></div>
        <details class="bj-rules"><summary>Zasady stołu</summary><ul><li>As ma wartość 1 lub 11. Figury mają wartość 10.</li><li>Blackjack to as i karta o wartości 10 na starcie. Zysk: 3:2. Zwykła wygrana: 1:1. Remis zwraca stawkę.</li><li>Krupier dobiera do 16 i stoi na każdym 17, także miękkim.</li><li>Podwojenie tylko przy pierwszych dwóch kartach, jeśli wystarczy salda; potem jedna karta i pas.</li><li>Bez podziału par, ubezpieczenia i poddania. Karty tasujemy ponownie przed rundą, gdy w bucie zostaje mniej niż 60 kart.</li><li>Zamknięcie stołu automatycznie pasuje i rozlicza rundę. Odświeżenie strony podczas rundy oznacza utratę postawionych żetonów.</li></ul></details>
        <p class="bj-footnote">Wyłącznie wirtualne żetony · Bez wpłat i wypłat</p>
      </div>
    </section>`;

  const $ = (selector) => root.querySelector(selector);
  function cards(hand, hidden = false) {
    if (!hand.length) return '<span class="bj-card-placeholder" aria-label="Miejsce na karty">♠</span>';
    return hand.map((card) => `<span class="bj-card ${['♥', '♦'].includes(card.suit) ? 'bj-card-red' : ''}" aria-label="${card.rank} ${{ '♠': 'pik', '♥': 'kier', '♦': 'karo', '♣': 'trefl' }[card.suit]}"><span>${card.rank}<small>${card.suit}</small></span><b aria-hidden="true">${card.suit}</b><span aria-hidden="true">${card.rank}<small>${card.suit}</small></span></span>`).join('') + (hidden ? '<span class="bj-card bj-card-back" aria-label="Zakryta karta krupiera"><span aria-hidden="true">b♠</span></span>' : '');
  }
  function render() {
    const state = game.getState();
    const playing = state.phase === 'playing';
    const finished = state.phase === 'finished';
    if (finished && !countedRound) {
      countedRound = true; rounds++;
      history.unshift(state.payout - state.bet); history.splice(5);
    }
    $('#bj-dealer').innerHTML = cards(state.dealer, state.hidden);
    $('#bj-player').innerHTML = cards(state.player);
    const score = (hand) => { const { total, soft } = handValue(hand); return hand.length ? `${total}${soft && total <= 21 ? ' / miękkie' : ''}` : '—'; };
    $('#bj-dealer-score').textContent = state.hidden ? `${handValue(state.dealer).total} + ?` : score(state.dealer);
    $('#bj-player-score').textContent = score(state.player);
    $('#bj-message').textContent = finished ? outcomes[state.outcome] : playing ? 'Dobierasz czy pasujesz?' : 'Zajmij miejsce przy stole.';
    const net = state.payout - state.bet;
    $('#bj-detail').textContent = finished ? `Bilans rundy: ${net > 0 ? '+' : ''}${number.format(net)} żetonów${state.payout ? ` · Zwrot łącznie: ${number.format(state.payout)}` : ''}` : playing ? 'Zbliż się do 21. Nie przekraczaj granicy.' : 'Wybierz stawkę i rozdaj pierwsze karty.';
    $('.bj-result').dataset.result = finished ? state.outcome : '';
    $('#bj-in-play').textContent = playing ? number.format(state.bet) : '—';
    $('#bj-rounds').textContent = rounds;
    $('#bj-betting').hidden = playing;
    $('#bj-deal').hidden = playing;
    $('#bj-deal').textContent = finished ? 'Następne rozdanie ↗' : 'Rozdaj karty ↗';
    for (const id of ['hit', 'stand', 'double']) $(`#bj-${id}`).hidden = !playing;
    $('#bj-double').disabled = !state.canDouble;
    $('#bj-error').textContent = error;
    $('#bj-history').innerHTML = history.length ? history.map((net) => `<span class="bj-history-result ${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}">${net > 0 ? '+' : ''}${number.format(net)}</span>`).join('') : 'Jeszcze wszystko przed Tobą.';
  }
  function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.dataset.bjBet) {
      selectedBet = Number(button.dataset.bjBet); $('#bj-bet').value = selectedBet;
      root.querySelectorAll('[data-bj-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.bjBet) === selectedBet)));
      error = ''; render(); return;
    }
    error = '';
    if (button.id === 'bj-deal') { selectedBet = Number($('#bj-bet').value); error = game.start(selectedBet) || ''; if (!error) countedRound = false; }
    else if (button.id === 'bj-hit') game.hit();
    else if (button.id === 'bj-stand') game.stand();
    else if (button.id === 'bj-double') game.double();
    else return;
    render();
    if (error) $('#bj-bet').focus();
    else (game.getState().phase === 'playing' ? $('#bj-hit') : $('#bj-deal')).focus();
  }
  root.addEventListener('click', onClick);
  function onBetInput() {
    selectedBet = Number($('#bj-bet').value);
    root.querySelectorAll('[data-bj-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.bjBet) === selectedBet)));
    error = ''; $('#bj-error').textContent = '';
  }
  $('#bj-bet').addEventListener('input', onBetInput);
  render();
  return () => { game.stand(); root.removeEventListener('click', onClick); $('#bj-bet').removeEventListener('input', onBetInput); };
}
