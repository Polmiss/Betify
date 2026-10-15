import './roulette.css';
import { BETS, WHEEL, ROUND_LIMIT, colorOf, stakeTotal, drawPocket, settleRound } from './engine.js';

const format = new Intl.NumberFormat('pl-PL');
const chips = [10, 50, 100, 500, 1000];
const duration = 4800;

function wheelMarkup() {
  const point = (angle, radius) => `${200 + radius * Math.sin(angle)},${200 - radius * Math.cos(angle)}`;
  const step = Math.PI * 2 / WHEEL.length;
  const segments = WHEEL.map((n, index) => {
    const angle = index * step;
    const fill = n === 0 ? '#3e865d' : colorOf(n) === 'red' ? '#a4404c' : '#1b2924';
    return `<g><path d="M200,200 L${point(angle - step / 2, 178)} A178,178 0 0,1 ${point(angle + step / 2, 178)} Z" fill="${fill}" stroke="#c6ae7a" stroke-width=".7"/><text x="200" y="39" transform="rotate(${index * 360 / 37} 200 200)" fill="#f6efdb" font-size="12" font-family="Arial,sans-serif" text-anchor="middle" dominant-baseline="middle">${n}</text></g>`;
  }).join('');
  return `<svg class="rt-wheel" viewBox="0 0 400 400" aria-hidden="true"><defs><radialGradient id="rt-center"><stop stop-color="#425c40"/><stop offset="1" stop-color="#182c23"/></radialGradient><linearGradient id="rt-rim" x2="1" y2="1"><stop stop-color="#f4dfab"/><stop offset=".5" stop-color="#8a6c3d"/><stop offset="1" stop-color="#e2c591"/></linearGradient></defs><circle cx="200" cy="200" r="195" fill="#0d1914"/><circle cx="200" cy="200" r="188" fill="url(#rt-rim)"/>${segments}<circle cx="200" cy="200" r="146" fill="none" stroke="#dfc58f" stroke-width="2"/><circle cx="200" cy="200" r="126" fill="url(#rt-center)" stroke="#ad915f" stroke-width="5"/><circle cx="200" cy="200" r="112" fill="none" stroke="#bd9c65" stroke-opacity=".3"/><circle cx="200" cy="200" r="70" fill="#172a21" stroke="#aa8c56"/><path d="M125 200h150M200 125v150" stroke="url(#rt-rim)" stroke-width="6" stroke-linecap="round"/><circle cx="200" cy="200" r="22" fill="url(#rt-rim)"/><circle cx="200" cy="200" r="10" fill="#82714b"/></svg>`;
}

export function mountRoulette(root, { player }) {
  const dialog = root.closest('dialog');
  dialog.classList.add('roulette-dialog');
  const events = new AbortController();
  let bets = {};
  let previousBets = {};
  let moves = [];
  let selectedChip = 100;
  let spinning = false;
  let settled = false;
  let rotation = 0;
  let spinTimer;
  let history = [];
  let result = null;
  let disposed = false;

  const button = (id, label, extra = '') => `<button type="button" class="rt-bet ${extra}" data-rt-bet="${id}" aria-label="Postaw na: ${BETS[id].label}"><span>${label}</span><span class="rt-bet-chip" hidden></span></button>`;
  root.innerHTML = `<div class="rt-root">
    <header class="rt-header"><div><span class="rt-eyebrow">BETIFY ORIGINALS · EUROPEJSKA</span><h2 id="dialog-title">Ruletka<span>.</span></h2><p>Jeden obrót. Twój moment.</p></div><span class="rt-demo">TYLKO WIRTUALNE ŻETONY</span></header>
    <div class="rt-layout">
      <section class="rt-wheel-panel" aria-label="Koło ruletki"><div class="rt-wheel-top"><span><i></i> SINGLE ZERO</span><button class="rt-rules-toggle" aria-expanded="false">Zasady i wypłaty ⓘ</button></div>
        <div class="rt-wheel-wrap">${wheelMarkup()}<span class="rt-pointer" aria-hidden="true"></span><span class="rt-ball" aria-hidden="true"></span></div>
        <div class="rt-result" role="status" aria-live="polite"><span class="rt-result-number">?</span><div><strong data-rt-result-title>Stół jest Twój</strong><span data-rt-result-text>Wybierz żeton i postaw na planszy.</span></div></div>
        <div class="rt-history"><span>OSTATNIE WYNIKI</span><div data-rt-history><small>Tu pojawi się historia Twoich rund.</small></div></div>
      </section>
      <section class="rt-table-panel" aria-label="Obstawianie ruletki">
        <div class="rt-balance-row"><div><span>TWOJA WIRTUALNA PULA</span><strong><i>◈</i> <span data-rt-balance>${format.format(player.getState().balance)}</span></strong></div><span class="rt-limit">Limit rundy<br><strong>100 000</strong></span></div>
        <div class="rt-chips-label"><span>1. Wybierz żeton</span><small>Kliknięcia na polu sumują stawkę</small></div>
        <div class="rt-chips" role="group" aria-label="Wartość żetonu">${chips.map((amount, i) => `<button class="rt-chip rt-chip-${i} ${amount === selectedChip ? 'rt-selected' : ''}" data-rt-chip="${amount}" aria-pressed="${amount === selectedChip}" aria-label="Żeton ${amount}">${amount === 1000 ? '1k' : amount}</button>`).join('')}</div>
        <div class="rt-table-label"><span>2. Postaw na swoje pola</span><small>0–36 · jedno zero</small></div>
        <div class="rt-table">
          <div class="rt-number-board">${button('number-0', '0', 'rt-zero')}${Array.from({ length: 36 }, (_, i) => { const n = i + 1; return button(`number-${n}`, n, `rt-${colorOf(n)}`).replace('data-rt-bet', `style="--col:${Math.floor(i / 3) + 2};--row:${3 - i % 3};--mobile-col:${i % 3 + 1};--mobile-row:${Math.floor(i / 3) + 2}" data-rt-bet`); }).join('')}${[1, 2, 3].map((n) => button(`column-${n}`, '2:1', 'rt-column').replace('data-rt-bet', `style="--row:${4 - n};--mobile-col:${n}" data-rt-bet`)).join('')}</div>
          <div class="rt-dozens">${[1, 2, 3].map((n) => button(`dozen-${n}`, `${n}. tuzin <small>${(n - 1) * 12 + 1}–${n * 12}</small>`)).join('')}</div>
          <div class="rt-outside">${button('low', '1–18')}${button('even', 'Parzyste')}${button('red', '<i class="rt-diamond rt-red-diamond"></i><span class="rt-mobile-label">Czerwone</span>')}${button('black', '<i class="rt-diamond rt-black-diamond"></i><span class="rt-mobile-label">Czarne</span>')}${button('odd', 'Nieparzyste')}${button('high', '19–36')}</div>
        </div>
        <div class="rt-tools"><button data-rt-action="undo">↶ Cofnij</button><button data-rt-action="clear">Wyczyść stół</button><button data-rt-action="repeat">↻ Powtórz zakłady</button></div>
        <div class="rt-slip" aria-label="Podsumowanie zakładów"><div><span>STAWKA RUNDY</span><strong data-rt-total>0 <small>żetonów</small></strong></div><span data-rt-bet-count>Brak zakładów</span></div>
        <p class="rt-message" role="status" aria-live="polite">Postaw żetony, aby rozpocząć rundę.</p>
        <button class="rt-spin" data-rt-action="spin" disabled><span>Zakręć kołem</span><span aria-hidden="true">↗</span></button>
        <p class="rt-footnote">Bez wpłat i wypłat. Żetony nie mają wartości pieniężnej.</p>
      </section>
    </div>
    <section class="rt-rules" hidden aria-label="Zasady ruletki"><h3>Jak gramy?</h3><p>Kliknij żeton, a potem wybrane pola. Możesz obstawić kilka pól naraz. „Cofnij” usuwa ostatni dołożony żeton. Zakłady na sąsiadujące liczby (split, street, corner) nie są dostępne w tej wersji.</p><div class="rt-payouts"><span>Jedna liczba <strong>35:1</strong></span><span>Tuzin lub kolumna <strong>2:1</strong></span><span>Kolor, parzystość, 1–18 / 19–36 <strong>1:1</strong></span></div><p>Wypłata obejmuje wygraną oraz zwrot zwycięskiej stawki (odpowiednio ×36, ×3 lub ×2). Zero przegrywa wszystkie zakłady poza zakładem na samą liczbę 0. Każda liczba ma szansę 1/37; przewaga stołu wynosi około 2,70%.</p><p>Wynik i saldo są rozliczane przy rozpoczęciu obrotu. Animacja tylko pokazuje wynik — zamknięcie gry nie anuluje rundy ani nie zabiera wygranej.</p></section>
  </div>`;

  const find = (selector) => root.querySelector(selector);
  function message(text, error = false) { const node = find('.rt-message'); node.textContent = text; node.classList.toggle('rt-error', error); }
  function updateBalance() { if (!spinning) find('[data-rt-balance]').textContent = format.format(player.getState().balance); }
  const unsubscribe = player.subscribe(updateBalance);

  function renderBets() {
    const total = stakeTotal(bets);
    root.querySelectorAll('[data-rt-bet]').forEach((node) => {
      const amount = bets[node.dataset.rtBet] || 0;
      const badge = node.querySelector('.rt-bet-chip');
      badge.hidden = !amount;
      badge.textContent = amount >= 10000 ? `${(amount / 1000).toFixed(1)}k` : format.format(amount);
      node.classList.toggle('rt-has-bet', !!amount);
      node.classList.toggle('rt-winning', settled && result?.winningIds.includes(node.dataset.rtBet));
      node.classList.toggle('rt-winning-number', settled && node.dataset.rtBet === `number-${result?.pocket}`);
      node.setAttribute('aria-label', `Postaw na: ${BETS[node.dataset.rtBet].label}${amount ? `, postawiono ${amount} żetonów` : ''}`);
      node.disabled = spinning;
    });
    find('[data-rt-total]').innerHTML = `${format.format(total)} <small>żetonów</small>`;
    find('[data-rt-bet-count]').textContent = Object.keys(bets).length ? `Obstawione pola: ${Object.keys(bets).length}` : 'Brak zakładów';
    find('[data-rt-action="spin"]').disabled = spinning || total === 0 || total > player.getState().balance;
    find('[data-rt-action="undo"]').disabled = spinning || !moves.length;
    find('[data-rt-action="clear"]').disabled = spinning || !total;
    find('[data-rt-action="repeat"]').disabled = spinning || !Object.keys(previousBets).length;
    root.querySelectorAll('[data-rt-chip]').forEach((node) => { node.disabled = spinning; });
  }

  function finish() {
    if (disposed) return;
    spinning = false;
    settled = true;
    root.classList.remove('rt-spinning');
    const resultNumber = find('.rt-result-number');
    resultNumber.textContent = result.pocket;
    resultNumber.className = `rt-result-number rt-${colorOf(result.pocket)}`;
    const colorName = result.pocket === 0 ? 'zielone' : colorOf(result.pocket) === 'red' ? 'czerwone' : 'czarne';
    find('[data-rt-result-title]').textContent = `${result.pocket} · ${colorName}`;
    find('[data-rt-result-text]').textContent = result.payout ? `Wypłata: ${format.format(result.payout)} żetonów` : 'Tym razem bez wygranej.';
    message(`Bilans rundy: ${result.net > 0 ? '+' : ''}${format.format(result.net)} żetonów. ${result.payout ? 'Wypłata zawiera zwrot zwycięskiej stawki.' : 'Możesz przygotować kolejne zakłady.'}`);
    history.unshift(result.pocket); history = history.slice(0, 10);
    find('[data-rt-history]').innerHTML = history.map((n, i) => `<span class="rt-history-number rt-${colorOf(n)} ${i === 0 ? 'rt-latest' : ''}" aria-label="${i === 0 ? 'Ostatni wynik: ' : ''}${n}">${n}</span>`).join('');
    // Paid stakes are consumed. Repeating is an explicit action, never an automatic re-bet.
    bets = {};
    moves = [];
    updateBalance(); renderBets();
    find('[data-rt-action="spin"]').innerHTML = '<span>Zakręć kołem</span><span aria-hidden="true">↗</span>';
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    settled = false;
    try { result = settleRound(player, bets, drawPocket()); }
    catch (error) { spinning = false; message(error.message, true); updateBalance(); renderBets(); return; }
    previousBets = { ...bets };
    root.classList.add('rt-spinning');
    find('.rt-result-number').textContent = '…';
    find('.rt-result-number').className = 'rt-result-number';
    find('[data-rt-result-title]').textContent = 'Koło w ruchu';
    find('[data-rt-result-text]').textContent = 'Zakłady zamknięte. Czekamy na kulkę.';
    find('[data-rt-action="spin"]').innerHTML = '<span>Koło się kręci…</span><span aria-hidden="true">◌</span>';
    find('[data-rt-balance]').textContent = 'Rozliczanie…';
    message('Runda trwa. Nie można teraz zmieniać zakładów.');
    renderBets();
    const index = WHEEL.indexOf(result.pocket);
    rotation = (Math.floor(rotation / 360) + 6) * 360 + (360 - index * 360 / 37) % 360;
    find('.rt-wheel').style.transform = `rotate(${rotation}deg)`;
    const wait = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : duration;
    spinTimer = setTimeout(finish, wait);
  }

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || !root.contains(target)) return;
    if (target.classList.contains('rt-rules-toggle')) { const rules = find('.rt-rules'); rules.hidden = !rules.hidden; target.setAttribute('aria-expanded', String(!rules.hidden)); return; }
    if (spinning) return;
    if (target.dataset.rtChip) {
      selectedChip = Number(target.dataset.rtChip);
      root.querySelectorAll('[data-rt-chip]').forEach((node) => { const selected = Number(node.dataset.rtChip) === selectedChip; node.classList.toggle('rt-selected', selected); node.setAttribute('aria-pressed', String(selected)); });
    }
    if (target.dataset.rtBet) {
      const total = stakeTotal(bets);
      if (total + selectedChip > ROUND_LIMIT) { message('Limit rundy to 100 000 żetonów.', true); return; }
      if (total + selectedChip > player.getState().balance) { message('Nie masz wystarczającej liczby żetonów na ten zakład.', true); return; }
      settled = false;
      const id = target.dataset.rtBet;
      bets[id] = (bets[id] || 0) + selectedChip;
      moves.push({ id, amount: selectedChip });
      message(`Dodano ${format.format(selectedChip)} żetonów: ${BETS[id].label}.`);
      renderBets();
    }
    switch (target.dataset.rtAction) {
      case 'spin': spin(); break;
      case 'clear': bets = {}; moves = []; settled = false; renderBets(); message('Stół wyczyszczony. Wybierz nowe pola.'); break;
      case 'undo': {
        const move = moves.pop();
        if (move) { bets[move.id] -= move.amount; if (!bets[move.id]) delete bets[move.id]; }
        settled = false; renderBets(); message('Cofnięto ostatni żeton.'); break;
      }
      case 'repeat': {
        if (stakeTotal(previousBets) > player.getState().balance) { message('Za mało żetonów, aby powtórzyć poprzednią stawkę.', true); break; }
        bets = { ...previousBets }; moves = Object.entries(bets).map(([id, amount]) => ({ id, amount })); settled = false;
        renderBets(); message('Przywrócono zakłady z poprzedniej rundy.'); break;
      }
    }
  }, { signal: events.signal });
  renderBets();

  return () => {
    disposed = true;
    clearTimeout(spinTimer);
    events.abort();
    unsubscribe();
    dialog.classList.remove('roulette-dialog');
  };
}
