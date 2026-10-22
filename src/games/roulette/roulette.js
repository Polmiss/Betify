import './roulette.css';
import { BETS, WHEEL, colorOf, stakeTotal, drawPocket, settleRound, calculateResult } from './engine.js';
import { CHIPS, chipLabel, createBettingRack } from './betting.js';
import { createSpinPlan, sampleSpin } from './motion.js';
import { createRoundReporter } from '../../round-results.js';
import { createRouletteClock, BETTING_MS, SPIN_MS } from './round-clock.js';

const format = new Intl.NumberFormat('pl-PL');
const chips = CHIPS;

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

export function mountRoulette(root, { player, onRound }) {
  const roundReporter = createRoundReporter(onRound);
  const reportResult = () => { if (result) roundReporter.report({ phase: 'finished', bet: result.stake, payout: result.payout }); };
  root.classList.add('roulette-game');
  const events = new AbortController();
  const rack = createBettingRack();
  let previousStack = [];
  let selectedChip = 100;
  let allInSelected = false;
  let spinning = false;
  let releaseBalance;
  let settled = false;
  let wheelAngle = 0;
  let ballAngle = 0;
  let ballRadius = 188;
  let frame;
  let plan;
  let clockTimer;
  let spinError = '';
  let history = [];
  let result = null;
  let disposed = false;
  let betPage = 0;
  const clock = createRouletteClock({ onSpin: spin, onBetting: finish });

  const button = (id, label, extra = '') => `<button type="button" class="rt-bet ${extra}" data-rt-bet="${id}" aria-label="Postaw na: ${BETS[id].label}"><span>${label}</span><span class="rt-chip-stack" aria-hidden="true" hidden></span></button>`;
  root.innerHTML = `<div class="rt-root">
    <header class="rt-header"><div><span class="rt-eyebrow">BETIFY ORIGINALS · EUROPEJSKA</span><h2 id="dialog-title">Ruletka<span>.</span></h2><p>Automatyczny obrót co 15 sekund.</p></div><span class="rt-demo">TYLKO WIRTUALNE ŻETONY</span></header>
    <div class="rt-layout">
      <section class="rt-wheel-panel" aria-label="Koło ruletki"><div class="rt-wheel-top"><span><i></i> SINGLE ZERO</span><button class="rt-rules-toggle" aria-expanded="false">Zasady i wypłaty ⓘ</button></div>
        <div class="rt-wheel-stage"><div class="rt-wheel-wrap">${wheelMarkup()}<svg class="rt-ball-track" viewBox="0 0 400 400" aria-hidden="true"><defs><radialGradient id="rt-ball-light" cx="30%" cy="25%"><stop stop-color="#fff"/><stop offset=".6" stop-color="#fff7e1"/><stop offset="1" stop-color="#aa9983"/></radialGradient></defs><ellipse class="rt-ball-shadow" cx="202" cy="14" rx="6" ry="4" fill="#000" opacity=".4"/><circle class="rt-ball" cx="200" cy="12" r="5" fill="url(#rt-ball-light)"/></svg></div></div>
        <div class="rt-result" role="status" aria-live="polite"><span class="rt-result-number">?</span><div><strong data-rt-result-title>Stół jest Twój</strong><span data-rt-result-text>Wybierz żeton i postaw na planszy.</span></div></div>
        <div class="rt-history"><span>OSTATNIE WYNIKI</span><div data-rt-history><small>Tu pojawi się historia Twoich rund.</small></div></div>
      </section>
      <section class="rt-table-panel" aria-label="Obstawianie ruletki">
        <div class="rt-balance-row"><div><span>TWOJA WIRTUALNA PULA</span><strong><i>◈</i> <span data-rt-balance>${format.format(player.getState().balance)}</span></strong></div><span class="rt-limit">Maks. stawka<br><strong>Bez limitu</strong></span></div>
        <div class="rt-chips-label"><span>1. Wybierz żeton</span><small>LPM dodaje · PPM zdejmuje żeton</small></div>
        <div class="rt-chips" role="group" aria-label="Wartość żetonu">${chips.map((amount, i) => `<button class="rt-chip rt-chip-${i} ${amount === selectedChip ? 'rt-selected' : ''}" data-rt-chip="${amount}" aria-pressed="${amount === selectedChip}" aria-label="Żeton ${amount}"><span>${chipLabel(amount)}</span></button>`).join('')}<button class="rt-all-in" data-rt-action="all-in" aria-pressed="false" title="Postaw pozostałe saldo na wybrane pole">All in</button></div>
        <div class="rt-table-label"><span>2. Postaw na swoje pola</span><small>0–36 · jedno zero</small></div>
        <div class="rt-table">
          <div class="rt-number-board">${button('number-0', '0', 'rt-zero')}${Array.from({ length: 36 }, (_, i) => { const n = i + 1; return button(`number-${n}`, n, `rt-${colorOf(n)}`).replace('data-rt-bet', `style="--col:${Math.floor(i / 3) + 2};--row:${3 - i % 3};--mobile-col:${i % 3 + 1};--mobile-row:${Math.floor(i / 3) + 2}" data-rt-bet`); }).join('')}${[1, 2, 3].map((n) => button(`column-${n}`, '3,0525×', 'rt-column').replace('data-rt-bet', `style="--row:${4 - n};--mobile-col:${n}" data-rt-bet`)).join('')}</div>
          <div class="rt-dozens">${[1, 2, 3].map((n) => button(`dozen-${n}`, `${n}. tuzin <small>${(n - 1) * 12 + 1}–${n * 12}</small>`)).join('')}</div>
          <div class="rt-outside">${button('low', '1–18')}${button('even', 'Parzyste')}${button('red', '<i class="rt-diamond rt-red-diamond"></i><span class="rt-mobile-label">Czerwone</span>')}${button('black', '<i class="rt-diamond rt-black-diamond"></i><span class="rt-mobile-label">Czarne</span>')}${button('odd', 'Nieparzyste')}${button('high', '19–36')}</div>
        </div>
        <div class="rt-tools"><button data-rt-action="undo">↶ Cofnij</button><button data-rt-action="clear">Wyczyść stół</button><button data-rt-action="repeat">↻ Powtórz zakłady</button></div>
        <div class="rt-slip" aria-label="Podsumowanie zakładów"><div class="rt-slip-title"><h3>Twoje zakłady</h3><nav class="rt-bet-pages" aria-label="Strony zakładów"><button data-rt-action="bets-prev" aria-label="Poprzednie zakłady">‹</button><span data-rt-bet-count>Brak zakładów</span><button data-rt-action="bets-next" aria-label="Następne zakłady">›</button></nav></div><ul class="rt-bet-list" data-rt-bet-list></ul><div class="rt-slip-total"><span>Łączna stawka rundy</span><strong data-rt-total>0 <small>żetonów</small></strong></div></div>
        <p class="rt-message" role="status" aria-live="polite">Postaw żetony. Obrót rozpocznie się automatycznie.</p>
        <div class="rt-spin rt-round-clock" role="timer" aria-live="off" aria-label="Czas do zamknięcia zakładów"><span data-rt-clock-label>Zakłady otwarte</span><strong data-rt-seconds>10 s</strong><i class="rt-clock-progress" aria-hidden="true"></i></div>
        <p class="rt-footnote">Bez wpłat i wypłat. Żetony nie mają wartości pieniężnej.</p>
      </section>
    </div>
    <section class="rt-rules" hidden aria-label="Zasady ruletki"><h3>Jak gramy?</h3><p>Koło rusza automatycznie co 15 sekund: 10 sekund na zakłady, potem 5 sekund obrotu. Odliczanie pokazuje czas do zamknięcia lub ponownego otwarcia stołu. Podczas obrotu nie można zmieniać zakładów. Po wyniku stół jest czyszczony; powtórzenie stawek wymaga kliknięcia „Powtórz zakłady”. Koło obraca się także bez stawki — wtedy saldo i statystyki gracza pozostają bez zmian.</p><p>Wybierz nominał. Lewy przycisk myszy dodaje żeton, a prawy zdejmuje ostatni żeton z danego pola. Na telefonie możesz użyć minusa przy zakładzie. „Cofnij” usuwa ostatni dołożony żeton. „All in” pozwala postawić całe pozostałe saldo: wybierz przycisk, a potem pole. Wcześniejsze zakłady zostają na stole. Nie ma maksymalnej stawki; musisz mieć wystarczające saldo. Zakłady split, street i corner nie są dostępne w tej wersji.</p><div class="rt-payouts"><span>Jedna liczba <strong>36,63×</strong></span><span>Tuzin lub kolumna <strong>3,0525×</strong></span><span>Kolor, parzystość, 1–18 / 19–36 <strong>2,035×</strong></span></div><p>Wypłata obejmuje wygraną oraz zwrot zwycięskiej stawki (odpowiednio ×36,63, ×3,0525 lub ×2,035). Zero przegrywa wszystkie zakłady poza zakładem na samą liczbę 0. Każda liczba ma szansę 1/37; RTP wynosi 99%, a przewaga stołu 1%. Ułamkową sumę wypłat zaokrąglamy losowo do sąsiednich całych żetonów z zachowaniem wartości oczekiwanej.</p><p>Wynik jest rozliczany przy rozpoczęciu obrotu; widoczne saldo aktualizuje się po animacji. Animacja tylko pokazuje wynik — zamknięcie gry nie anuluje rundy ani nie zabiera wygranej.</p></section>
  </div>`;

  const find = (selector) => root.querySelector(selector);
  function message(text, error = false) { const node = find('.rt-message'); node.textContent = text; node.classList.toggle('rt-error', error); }
  function updateBalance() { if (!spinning) find('[data-rt-balance]').textContent = format.format(player.getState().balance); }
  const unsubscribe = player.subscribe(() => { updateBalance(); if (!spinning) renderBets(); });

  function renderChipSelection() {
    root.querySelectorAll('[data-rt-chip]').forEach((node) => {
      const selected = !allInSelected && Number(node.dataset.rtChip) === selectedChip;
      node.classList.toggle('rt-selected', selected); node.setAttribute('aria-pressed', String(selected));
    });
    find('[data-rt-action="all-in"]').setAttribute('aria-pressed', String(allInSelected));
  }

  function renderBets() {
    const bets = rack.totals();
    const entries = Object.entries(bets);
    const pageSize = window.matchMedia('(max-width: 700px), (max-height: 600px)').matches ? 1 : 2;
    betPage = Math.max(0, Math.min(betPage, Math.ceil(entries.length / pageSize) - 1));
    const total = stakeTotal(bets);
    root.querySelectorAll('[data-rt-bet]').forEach((node) => {
      const amount = bets[node.dataset.rtBet] || 0;
      const stack = rack.stack(node.dataset.rtBet);
      const badge = node.querySelector('.rt-chip-stack');
      badge.hidden = !stack.length;
      const visibleStack = stack.slice(-6);
      badge.innerHTML = visibleStack.map((value, level) => `<i class="rt-stack-token rt-chip-${Math.max(0, chips.indexOf(value))}" style="--level:${level}">${level === visibleStack.length - 1 ? `<span>${chipLabel(value)}</span>` : ''}</i>`).join('');
      node.title = `${BETS[node.dataset.rtBet].label}${amount ? ` · ${format.format(amount)} żetonów · ${stack.length} szt.` : ''}`;
      node.classList.toggle('rt-has-bet', !!amount);
      node.classList.toggle('rt-winning', settled && result?.winningIds.includes(node.dataset.rtBet));
      node.classList.toggle('rt-winning-number', settled && node.dataset.rtBet === `number-${result?.pocket}`);
      node.setAttribute('aria-label', `Postaw na: ${BETS[node.dataset.rtBet].label}${amount ? `, postawiono ${amount} żetonów` : ''}`);
      node.disabled = spinning;
    });
    find('[data-rt-total]').innerHTML = `${format.format(total)} <small>żetonów</small>`;
    find('[data-rt-bet-count]').textContent = entries.length ? `${betPage * pageSize + 1}–${Math.min((betPage + 1) * pageSize, entries.length)} / ${entries.length}` : 'Brak zakładów';
    find('[data-rt-action="bets-prev"]').disabled = betPage === 0;
    find('[data-rt-action="bets-next"]').disabled = (betPage + 1) * pageSize >= entries.length;
    find('[data-rt-bet-list]').innerHTML = entries.slice(betPage * pageSize, (betPage + 1) * pageSize).map(([id, amount]) => {
      const denominations = rack.stack(id).reduce((counts, value) => { counts[value] = (counts[value] || 0) + 1; return counts; }, {});
      return `<li><div><strong>${BETS[id].label}</strong><small>${Object.entries(denominations).map(([value, count]) => `${count} × ${format.format(Number(value))}`).join(' · ')}</small></div><span>${format.format(amount)}</span><button data-rt-remove="${id}" aria-label="Zdejmij ostatni żeton: ${BETS[id].label}" ${spinning ? 'disabled' : ''}>−</button></li>`;
    }).join('') || '<li class="rt-slip-empty">Wybierz pola na planszy. Każdy zakład pojawi się tutaj osobno.</li>';
    find('[data-rt-action="undo"]').disabled = spinning || !rack.size;
    find('[data-rt-action="clear"]').disabled = spinning || !total;
    find('[data-rt-action="repeat"]').disabled = spinning || !previousStack.length;
    root.querySelectorAll('[data-rt-chip]').forEach((node) => { node.disabled = spinning; });
    const available = Math.max(0, player.getState().balance - total);
    find('[data-rt-action="all-in"]').disabled = spinning || !available;
    find('[data-rt-action="all-in"]').title = `All in: ${format.format(available)} żetonów. Wybierz przycisk, a następnie pole.`;
  }

  function finish() {
    if (disposed || !spinning) return;
    cancelAnimationFrame(frame);
    if (plan) paint(sampleSpin(plan, 1));
    spinning = false;
    settled = true;
    releaseBalance?.();
    releaseBalance = undefined;
    reportResult();
    root.classList.remove('rt-spinning');
    if (result) {
      const resultNumber = find('.rt-result-number');
      resultNumber.textContent = result.pocket;
      resultNumber.className = `rt-result-number rt-${colorOf(result.pocket)}`;
      const colorName = result.pocket === 0 ? 'zielone' : colorOf(result.pocket) === 'red' ? 'czerwone' : 'czarne';
      find('[data-rt-result-title]').textContent = `${result.pocket} · ${colorName}`;
      find('[data-rt-result-text]').textContent = spinError ? 'Zakład nie został przyjęty.' : !result.stake ? 'Obrót bez zakładu.' : result.payout ? `Wypłata: ${format.format(result.payout)} żetonów` : 'Tym razem bez wygranej.';
      history.unshift(result.pocket); history = history.slice(0, 10);
      find('[data-rt-history]').innerHTML = history.map((n, i) => `<span class="rt-history-number rt-${colorOf(n)} ${i === 0 ? 'rt-latest' : ''}" aria-label="${i === 0 ? 'Ostatni wynik: ' : ''}${n}">${n}</span>`).join('');
    } else {
      find('.rt-result-number').textContent = '?';
      find('[data-rt-result-title]').textContent = 'Runda odwołana';
      find('[data-rt-result-text]').textContent = 'Nie pobrano stawki.';
    }
    message(spinError ? `${spinError} Możesz przygotować nowy zakład.` : result?.stake ? `Bilans rundy: ${result.net > 0 ? '+' : ''}${format.format(result.net)}. Zakłady ponownie otwarte.` : 'Zakłady otwarte. Wybierz żetony na następny obrót.', !!spinError);
    // Paid stakes are consumed. Repeating is an explicit action, never an automatic re-bet.
    rack.clear();
    updateBalance(); renderBets();
  }

  function spin(timing) {
    if (spinning || disposed) return;
    spinning = true;
    settled = false;
    spinError = ''; result = null; plan = undefined;
    try {
      const pocket = drawPocket();
      // Prepare animation before accepting any stake; randomness failures cost nothing.
      plan = createSpinPlan(pocket, wheelAngle, ballAngle, undefined, ballRadius, SPIN_MS);
      const bets = rack.totals();
      result = calculateResult({}, pocket);
      if (rack.size) {
        releaseBalance = player.beginAnimation?.();
        result = settleRound(player, bets, pocket);
        roundReporter.begin();
        previousStack = rack.snapshot();
      }
    } catch (error) {
      spinError = error.message;
      releaseBalance?.(); releaseBalance = undefined;
    }
    root.classList.add('rt-spinning');
    find('.rt-result-number').textContent = '…';
    find('.rt-result-number').className = 'rt-result-number';
    find('[data-rt-result-title]').textContent = 'Koło w ruchu';
    find('[data-rt-result-text]').textContent = spinError ? 'Zakład nie został przyjęty.' : result?.stake ? 'Zakłady zamknięte. Czekamy na kulkę.' : 'Obrót bez zakładu. Saldo bez zmian.';
    if (result?.stake) find('[data-rt-balance]').textContent = 'Rozliczanie…';
    message(spinError || 'Runda trwa. Nie można teraz zmieniać zakładów.', !!spinError);
    renderBets();
    root.dataset.spinDuration = SPIN_MS;
    root.dataset.roundNumber = timing.round;
    if (!plan || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animate = (now) => {
      if (disposed || !spinning) return;
      const progress = Math.min(1, (now - timing.startedAt) / SPIN_MS);
      paint(sampleSpin(plan, progress));
      if (progress < 1) frame = requestAnimationFrame(animate); else syncClock();
    };
    frame = requestAnimationFrame(animate);
  }

  function renderClock(state) {
    const active = state.phase === 'spinning';
    const timer = find('.rt-round-clock');
    timer.dataset.phase = state.phase;
    timer.style.setProperty('--remaining', Math.max(0, Math.min(1, state.remainingMs / (active ? SPIN_MS : BETTING_MS))));
    timer.setAttribute('aria-label', active ? 'Czas do otwarcia zakładów' : 'Czas do zamknięcia zakładów');
    find('[data-rt-clock-label]').textContent = active ? 'Koło w ruchu · zakłady zamknięte' : 'Zakłady otwarte · obrót za';
    const seconds = `${state.seconds} s`;
    if (find('[data-rt-seconds]').textContent !== seconds) find('[data-rt-seconds]').textContent = seconds;
    root.dataset.roundPhase = state.phase;
  }

  function syncClock() {
    clearTimeout(clockTimer);
    if (disposed) return;
    const state = clock.advance();
    renderClock(state);
    clockTimer = setTimeout(syncClock, Math.max(1, Math.min(100, state.remainingMs)));
  }

  function canBet() {
    const accepted = clock.canBet();
    renderClock(clock.getState());
    return !disposed && accepted;
  }

  function paint(sample) {
    wheelAngle = sample.wheelAngle; ballAngle = sample.ballAngle;
    ballRadius = sample.radius;
    find('.rt-wheel').style.transform = `rotate(${wheelAngle}deg)`;
    const ball = find('.rt-ball'); const shadow = find('.rt-ball-shadow');
    ball.setAttribute('cx', sample.x); ball.setAttribute('cy', sample.y);
    shadow.setAttribute('cx', sample.x + 1); shadow.setAttribute('cy', sample.y + 2);
  }

  function removeChip(id) {
    if (!canBet()) return;
    const chip = rack.remove(id);
    if (chip) { settled = false; renderBets(); message(`Zdjęto ${format.format(chip.amount)} żetonów: ${BETS[id].label}.`); }
  }
  root.addEventListener('contextmenu', (event) => {
    const target = event.target.closest('[data-rt-bet]');
    if (!target || !root.contains(target)) return;
    event.preventDefault(); removeChip(target.dataset.rtBet);
  }, { signal: events.signal });

  root.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target || !root.contains(target)) return;
    if (target.classList.contains('rt-rules-toggle')) { const rules = find('.rt-rules'); rules.hidden = !rules.hidden; target.setAttribute('aria-expanded', String(!rules.hidden)); return; }
    if (target.dataset.rtAction === 'bets-prev' || target.dataset.rtAction === 'bets-next') {
      betPage += target.dataset.rtAction === 'bets-prev' ? -1 : 1; renderBets(); return;
    }
    if (!canBet()) return;
    if (target.dataset.rtRemove) { removeChip(target.dataset.rtRemove); return; }
    if (target.dataset.rtChip) {
      selectedChip = Number(target.dataset.rtChip);
      allInSelected = false; renderChipSelection();
      message(`Wybrano żeton ${format.format(selectedChip)}. Kliknij pole na planszy.`);
    }
    if (target.dataset.rtBet) {
      const id = target.dataset.rtBet;
      let amount = selectedChip;
      const wasAllIn = allInSelected;
      try {
        player.refresh?.(false);
        if (wasAllIn) amount = rack.allIn(id, player.getState().balance);
        else rack.add(id, selectedChip, player.getState().balance);
      }
      catch (error) { message(error.message, true); return; }
      settled = false;
      allInSelected = false; renderChipSelection();
      message(`${wasAllIn ? 'All in' : 'Dodano'}: ${format.format(amount)} żetonów · ${BETS[id].label}.`);
      renderBets();
    }
    switch (target.dataset.rtAction) {
      case 'all-in':
        allInSelected = !allInSelected; renderChipSelection();
        message(allInSelected ? 'All in wybrane. Kliknij pole, aby postawić na nim pozostałe saldo.' : `Wybrano żeton ${format.format(selectedChip)}.`);
        break;
      case 'clear': rack.clear(); settled = false; renderBets(); message('Stół wyczyszczony. Wybierz nowe pola.'); break;
      case 'undo': {
        rack.undo();
        settled = false; renderBets(); message('Cofnięto ostatni żeton.'); break;
      }
      case 'repeat': {
        try { rack.restore(previousStack, player.getState().balance); }
        catch (error) { message(error.message, true); break; }
        settled = false;
        renderBets(); message('Przywrócono zakłady z poprzedniej rundy.'); break;
      }
    }
  }, { signal: events.signal });
  renderBets();
  syncClock();
  window.addEventListener('resize', renderBets, { signal: events.signal });
  document.addEventListener('visibilitychange', syncClock, { signal: events.signal });

  return () => {
    disposed = true;
    clock.close();
    clearTimeout(clockTimer);
    cancelAnimationFrame(frame);
    events.abort();
    unsubscribe();
    releaseBalance?.();
    reportResult();
    root.classList.remove('roulette-game');
  };
}
