import { createHighLow, ranks, MAX_SKIPS } from './engine.js';
import { showGameHelp } from '../../game-help.js';
import './high-low.css';
import { createRoundReporter } from '../../round-results.js';
import { payoutLabel } from '../../rtp.js';

const format = new Intl.NumberFormat('pl-PL');
const multiplier = (value) => `${value.toFixed(3).replace('.', ',')}×`;
const percent = (value) => `${(value * 100).toFixed(2).replace('.', ',')}%`;
const suitNames = { '♠': 'pik', '♥': 'kier', '♦': 'karo', '♣': 'trefl' };
const cardFace = (card) => `<span>${ranks[card.rank - 1]}<small>${card.suit}</small></span><b>${card.suit}</b><span>${ranks[card.rank - 1]}<small>${card.suit}</small></span>`;
const red = (card) => ['♥', '♦'].includes(card.suit);

export function mountHighLow(root, player, { onRound } = {}) {
  const game = createHighLow(player);
  const roundReporter = createRoundReporter(onRound);
  let busy = false;
  let releaseBalance;
  let disposed = false;
  let preview;
  let error = '';
  let pendingTimer;
  let resolveWait;
  let closeHelp;
  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.innerHTML = `<section class="hl-root" aria-label="High Low">
    <header class="hl-header"><div><h1>High Low<span>.</span></h1><p>Wyżej czy niżej? Rozegraj swoją serię.</p></div><span class="hl-demo">TYLKO WIRTUALNE ŻETONY</span></header>
    <div class="hl-board">
      <div class="hl-stage"><div class="hl-rank-note"><span>NAJNIŻSZA</span><strong>A</strong><i>↓</i><strong>K</strong><span>NAJWYŻSZA</span></div>
        <div class="hl-card-area"><span class="hl-current-caption">AKTUALNA KARTA</span><div class="hl-card" role="img"><div class="hl-card-turn"><div class="hl-face" aria-hidden="true"></div><div class="hl-back" aria-hidden="true">b♠</div></div></div><div class="hl-message" role="status" aria-live="polite" aria-atomic="true"></div></div>
        <div class="hl-shoe" aria-hidden="true"><span>b♠</span><small>LOSOWANIE<br>ZE ZWRACANIEM</small></div></div>
      <div class="hl-history" aria-label="Historia kart"></div>
    </div>
    <div class="hl-controls">
      <div class="hl-stats"><span>Stawka<strong class="hl-stake-value">—</strong></span><span>Mnożnik serii<strong class="hl-multiplier">1,000×</strong></span><span>Do odebrania<strong class="hl-payout">0</strong></span><span>Trafienia<strong class="hl-wins">0</strong></span></div>
      <div class="hl-betting"><label for="hl-bet">Stawka w żetonach <small>10–5 000</small><input id="hl-bet" type="number" min="10" max="5000" step="1" value="100" inputmode="numeric"/></label><div class="hl-chips">${[10, 50, 100, 500].map((amount) => `<button data-hl-bet="${amount}" aria-pressed="${amount === 100}">${amount}</button>`).join('')}</div><button class="button button-primary" data-hl="start">Rozpocznij serię ↗</button></div>
      <div class="hl-decisions"><button class="hl-choice" data-hl="high"><span class="hl-direction">↑</span><span><strong></strong><small></small></span></button><button class="hl-choice" data-hl="low"><span class="hl-direction">↓</span><span><strong></strong><small></small></span></button><button class="button button-primary hl-cashout" data-hl="cashout">Odbierz żetony</button></div>
      <p class="hl-error" role="alert"></p><div class="hl-footer"><button class="hl-skip" data-hl="skip">Pomiń kartę →</button><span class="hl-skip-note"></span><button class="hl-rules" data-hl="rules">Zasady gry ⓘ</button></div>
    </div></section>`;
  const $ = (selector) => root.querySelector(selector);
  const unsubscribe = player.subscribe(() => { if (!disposed && !busy) render(); });

  function render() {
    if (disposed) return;
    const state = preview || game.getState();
    if (!busy) roundReporter.report(state);
    const playing = state.phase === 'playing';
    $('.hl-root').setAttribute('aria-busy', String(busy));
    const card = $('.hl-card');
    card.classList.toggle('hl-red', red(state.card));
    card.setAttribute('aria-label', `${ranks[state.card.rank - 1]} ${suitNames[state.card.suit]}`);
    $('.hl-face').innerHTML = cardFace(state.card);
    const resultText = state.outcome === 'lose' ? `Nietrafiony typ. Bilans: −${format.format(state.bet)} żetonów.` : state.outcome === 'limit' ? `Limit serii! Odebrano ${format.format(state.payout)} żetonów.` : state.outcome === 'cashout' ? `Odebrano ${format.format(state.payout)} żetonów. Bilans: ${state.payout - state.bet >= 0 ? '+' : ''}${format.format(state.payout - state.bet)}.` : '';
    $('.hl-message').textContent = busy ? 'Odkrywanie następnej karty…' : resultText || (playing ? state.wins ? 'Trafiony typ! Kontynuujesz czy odbierasz?' : 'Wybierz kierunek pierwszej karty.' : 'Wybierz stawkę. Możesz też zmienić kartę startową.');
    $('.hl-board').dataset.outcome = busy ? '' : state.outcome || '';
    $('.hl-stake-value').textContent = state.bet ? format.format(state.bet) : '—';
    $('.hl-multiplier').textContent = multiplier(state.multiplier);
    $('.hl-payout').textContent = (state.phase === 'finished' ? format.format(state.payout) : state.wins ? payoutLabel(state.bet * state.multiplier) : '0');
    $('.hl-wins').textContent = state.wins;
    $('.hl-betting').hidden = playing || busy;
    $('.hl-decisions').hidden = !playing && !busy;
    $('[data-hl="start"]').textContent = state.phase === 'finished' ? 'Nowa seria ↗' : 'Rozpocznij serię ↗';
    for (const direction of ['high', 'low']) {
      const offer = state.offers[direction];
      const button = $(`[data-hl="${direction}"]`);
      button.querySelector('strong').textContent = offer.label;
      button.querySelector('small').textContent = `${percent(offer.probability)} · seria po trafieniu ${multiplier(offer.multiplier)}`;
      button.disabled = busy || !playing;
    }
    $('[data-hl="cashout"]').disabled = busy || !playing || state.wins === 0;
    $('[data-hl="cashout"]').textContent = state.wins ? `Odbierz ${payoutLabel(state.bet * state.multiplier)} żetonów` : 'Odbierz po trafieniu';
    $('[data-hl="skip"]').disabled = busy || (playing && state.skips >= MAX_SKIPS);
    $('.hl-skip-note').textContent = playing ? `Pominięcia: ${state.skips}/${MAX_SKIPS} · bez zmiany mnożnika` : 'A = 1 · J = 11 · Q = 12 · K = 13';
    $('.hl-error').textContent = error;
    $('.hl-history').innerHTML = state.history.length ? state.history.slice(-8).map((entry) => `<span class="hl-history-card ${red(entry.card) ? 'hl-history-red' : ''}" data-result="${entry.result}" aria-label="${ranks[entry.card.rank - 1]} ${suitNames[entry.card.suit]}, ${{ start: 'start', win: 'trafienie', lose: 'błąd', skip: 'pominięta' }[entry.result]}"><b>${ranks[entry.card.rank - 1]}${entry.card.suit}</b><small>${{ start: 'START', win: '✓', lose: '×', skip: '→' }[entry.result]}</small></span>`).join('') : '<span class="hl-empty-history">Tutaj pojawi się historia Twojej serii.</span>';
  }

  function wait(ms) {
    return new Promise((resolve) => {
      resolveWait = resolve;
      pendingTimer = setTimeout(() => { resolveWait = undefined; resolve(!disposed); }, motion.matches ? 0 : ms);
    });
  }
  function help() {
    closeHelp?.();
    closeHelp = showGameHelp('High Low — zasady', [
      '<p>Odgadnij rangę następnej karty. Kolejność: A, 2–10, J, Q, K. Kolor nie wpływa na wynik. Losujemy ze zwracaniem: każda ranga ma zawsze szansę 1/13, karty mogą się powtarzać.</p><p>Rangi 2–Q: „wyżej lub taka sama” i „niżej lub taka sama” zaliczają remis jako trafienie. Przy A wybierasz „wyżej” albo „taka sama”; przy K „niżej” albo „taka sama”.</p>',
      '<p>Po trafieniu możesz odebrać żetony lub kontynuować. Nietrafiony typ kończy serię i traci całą stawkę oraz nieodebrane żetony.</p><p>Szanse i łączny mnożnik po kolejnym trafieniu są widoczne przed wyborem. Mnożnik wynosi 0,99 / iloczyn szans trafionych typów. RTP 99%. Wypłata zawiera stawkę. Ułamki zaokrąglamy losowo do sąsiednich całych żetonów z zachowaniem średniej; panel pokazuje zakres.</p>',
      '<p>Pominięcie wymienia aktualną kartę i nie zmienia mnożnika. Limit: 52 pominięcia w aktywnej rundzie. Przed rozpoczęciem możesz zmieniać kartę bez limitu.</p><p>Stawka: 10–5 000. Jeśli po trafieniu lub pominięciu następna wygrana w którymkolwiek kierunku przekroczyłaby 1 000× lub 1 000 000 żetonów, automatycznie odbieramy pełną bieżącą wygraną. Nie obcinamy mnożników.</p>',
      '<p>Przy wyjściu ze strony odbieramy żetony po trafieniach; jeśli jeszcze nie typowano, zwracamy stawkę. Reset salda kończy serię i przywraca 10 000 żetonów. Awaryjne zamknięcie przeglądarki może uniemożliwić rozliczenie.</p><p>To demonstracyjna gra wyłącznie na wirtualne żetony.</p>',
    ]);
  }

  async function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || disposed) return;
    if (button.dataset.hl === 'rules') { help(); return; }
    if (busy) return;
    if (button.dataset.hlBet) {
      $('#hl-bet').value = button.dataset.hlBet;
      root.querySelectorAll('[data-hl-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(chip === button)));
      error = ''; render(); return;
    }
    const action = button.dataset.hl;
    error = '';
    if (action === 'start') { error = game.start(Number($('#hl-bet').value)) || ''; if (!error) roundReporter.begin(); render(); return; }
    if (action === 'cashout') { error = game.cashout() || ''; render(); return; }
    if (!['high', 'low', 'skip'].includes(action)) return;
    const before = game.getState();
    busy = true;
    releaseBalance = player.beginAnimation?.();
    error = (action === 'skip' ? game.skip() : game.predict(action)) || '';
    if (error) { busy = false; releaseBalance?.(); render(); return; }
    preview = before;
    render();
    $('.hl-card').classList.add('hl-turning');
    if (!(await wait(230))) return;
    preview = undefined;
    render();
    $('.hl-card').classList.remove('hl-turning');
    if (!(await wait(280))) return;
    busy = false;
    releaseBalance?.();
    render();
  }
  root.addEventListener('click', onClick, { signal: events.signal });
  $('#hl-bet').addEventListener('input', () => {
    root.querySelectorAll('[data-hl-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.hlBet) === Number($('#hl-bet').value))));
  }, { signal: events.signal });
  render();
  return () => {
    disposed = true;
    clearTimeout(pendingTimer);
    resolveWait?.(false);
    closeHelp?.();
    events.abort(); unsubscribe();
    game.close();
    releaseBalance?.();
    roundReporter.report(game.getState());
  };
}
