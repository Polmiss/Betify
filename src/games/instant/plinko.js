import { createPlinkoSession } from './plinko-session.js';
import { addPlinkoBall, plinkoBoard, riskNames } from './plinko-board.js';
import { samplePlinkoMotion, PLINKO_ROWS_OPTIONS } from './plinko-physics.js';
import { plinkoPaytable, MIN_BET } from './engine.js';
import { showGameHelp } from '../../game-help.js';
import './instant.css';
import './plinko.css';

const format = new Intl.NumberFormat('pl-PL');
const times = (value) => `${value.toLocaleString('pl-PL', { maximumFractionDigits: 4 })}×`;

export function mountPlinko(root, player, { onRound } = {}) {
  const session = createPlinkoSession(player);
  const flights = new Map();
  const events = new AbortController();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let frame, disposed = false, closeHelp;
  root.classList.add('instant-game');
  root.innerHTML = `<section class="ig-root ig-plinko" aria-label="Plinko">
    <header class="ig-header"><div><span class="ig-eyebrow">BETIFY ORIGINALS</span><h1>Plinko<span>.</span></h1><p>Wiele kulek. Bez czekania.</p></div><button class="ig-help" data-ig="help">Zasady gry ⓘ</button></header>
    <div class="ig-layout"><div class="ig-arena"><div class="ig-stage"></div><div class="ig-message" role="status" aria-live="polite" aria-atomic="true">Klikaj wybrany kolor, aby puszczać kolejne kulki.</div><div class="ig-history" aria-label="Historia kulek"></div></div>
    <aside class="ig-controls" aria-label="Sterowanie grą">
      <div class="ig-stats"><span>Ostatni mnożnik<strong data-stat="multiplier">—</strong></span><span>Ostatnia wypłata<strong data-stat="payout">—</strong></span></div>
      <div class="ig-setup"><label for="ig-bet">Stawka za kulkę <small>od 10</small></label><input id="ig-bet" type="number" value="100" min="10" step="1" inputmode="numeric"><div class="ig-chips">${[10, 50, 100, 500].map((value) => `<button data-chip="${value}" aria-pressed="${value === 100}">${value}</button>`).join('')}</div>
      <label for="ig-rows">Liczba rzędów</label><select id="ig-rows">${PLINKO_ROWS_OPTIONS.map((rows) => `<option value="${rows}" ${rows === 12 ? 'selected' : ''}>${rows} rzędów</option>`).join('')}</select></div>
      <div class="ig-offer"><div class="ig-flight-count">Kulki w grze <strong data-stat="active">0</strong></div><div>Zarezerwowano: <b data-stat="reserved">0</b></div><div>Dostępne na kolejne: <b data-stat="available">0</b></div></div>
      <div class="ig-plinko-drops" role="group" aria-label="Puść kulkę — wybierz ryzyko">${Object.entries(riskNames).map(([risk, name]) => `<button type="button" data-plinko-risk="${risk}" aria-label="Puść kulkę: ${name.toLowerCase()} ryzyko"><i aria-hidden="true">●</i><strong>${name}</strong><small></small></button>`).join('')}</div>
      <button class="button button-primary" data-ig="retry" hidden>Ponów rozliczenie</button><p class="ig-error" role="alert"></p><p class="ig-limit">Bez limitu liczby kulek — każda wymaga stawki.<br>Saldo zmienia się po zakończeniu animacji każdej kulki. Tylko wirtualne żetony.</p>
    </aside></div></section>`;
  const $ = (selector) => root.querySelector(selector);
  const rows = () => Number($('#ig-rows').value);
  const bet = () => Number($('#ig-bet').value);
  const validBet = () => Number.isSafeInteger(bet()) && bet() >= MIN_BET;
  const board = () => { $('.ig-stage').innerHTML = plinkoBoard(rows()); };

  function render() {
    if (disposed) return;
    const state = session.getState();
    $('[data-stat="active"]').textContent = format.format(state.active);
    $('[data-stat="reserved"]').textContent = format.format(state.pendingStake);
    $('[data-stat="available"]').textContent = format.format(state.availableBalance);
    $('#ig-rows').disabled = state.active > 0;
    root.querySelectorAll('[data-plinko-risk]').forEach((button) => {
      button.disabled = !validBet() || state.availableBalance < bet();
      button.querySelector('small').textContent = `do ${times(Math.max(...plinkoPaytable(button.dataset.plinkoRisk, rows())))}`;
    });
    root.querySelectorAll('[data-chip]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.chip) === bet())));
    $('[data-ig="retry"]').hidden = ![...flights.values()].some((flight) => flight.failed);
    const last = state.history[0];
    if (last) {
      $('[data-stat="multiplier"]').textContent = times(last.multiplier);
      $('[data-stat="payout"]').textContent = format.format(last.payout);
      $('.ig-history').innerHTML = '<span>OSTATNIE KULKI</span>' + state.history.map((round) => `<span class="ig-history-item" data-positive="${round.payout >= round.bet}" title="Stawka ${round.bet}, wypłata ${round.payout}">${times(round.multiplier)}</span>`).join('');
    }
  }

  function settle(flight) {
    const release = player.beginAnimation?.();
    try {
      const result = session.land(flight.ball.id);
      if (result.error) {
        flight.failed = true;
        if (!disposed) $('.ig-error').textContent = result.error;
        return;
      }
      flight.releaseDebit?.();
      flights.delete(flight.ball.id);
      flight.view.group.remove();
      if (result.round) {
        onRound?.(result.round);
        if (!disposed) {
          const { payout, bet: stake, multiplier, capped } = result.round;
          $('.ig-arena').dataset.outcome = payout >= stake ? 'win' : 'lose';
          $('.ig-message').textContent = `Kulka #${flight.ball.id} · ${times(multiplier)} · wypłata ${format.format(payout)} żetonów${capped ? ' (limit salda lub wypłaty)' : ''}.`;
          $('.ig-error').textContent = '';
        }
      }
    } finally { release?.(); }
  }

  function tick(now) {
    frame = undefined;
    let changed = false;
    const svg = $('.ig-plinko-board');
    for (const flight of flights.values()) {
      if (flight.failed) continue;
      const elapsed = now - flight.start;
      const plan = flight.ball.flight;
      const position = samplePlinkoMotion(plan, elapsed);
      flight.view.ball.setAttribute('transform', `translate(${position.x} ${position.y}) rotate(${position.angle * 180 / Math.PI})`);
      flight.view.trail.forEach((dot, index) => {
        const previous = samplePlinkoMotion(plan, elapsed - (index + 1) * 22);
        dot.setAttribute('cx', previous.x); dot.setAttribute('cy', previous.y);
        dot.style.opacity = position.landed || flights.size > 30 ? '0' : String((1 - index / 3) * .24);
      });
      while (flight.impact < plan.impacts.length && plan.impacts[flight.impact].t <= elapsed) {
        const impact = plan.impacts[flight.impact++];
        if (elapsed - impact.t < 180) svg.querySelector(`[data-peg="${impact.peg}"]`)?.classList.add('ig-peg-hit');
      }
      if (elapsed >= plan.landingAt && !flight.landed) {
        flight.landed = true;
        const slot = svg.querySelector(`[data-slot="${plan.slot}"][data-risk="${flight.ball.risk}"]`);
        slot?.classList.add('ig-slot-impact');
      }
      if (elapsed >= plan.duration) { settle(flight); changed = true; }
    }
    if (changed) render();
    if ([...flights.values()].some((flight) => !flight.failed)) frame = requestAnimationFrame(tick);
  }

  function drop(risk) {
    if (!validBet()) { $('.ig-error').textContent = 'Wpisz całkowitą stawkę od 10 żetonów.'; return; }
    const releaseDebit = player.deferDebit?.(bet());
    let result;
    try { result = session.drop(bet(), { risk, rows: rows() }); }
    catch { result = { error: 'Nie udało się uruchomić kulki. Spróbuj ponownie.' }; }
    if (result.error) { releaseDebit?.(); $('.ig-error').textContent = result.error; render(); return; }
    const ball = result.ball;
    const flight = { ball, releaseDebit, view: addPlinkoBall($('.ig-plinko-board'), ball), start: performance.now(), impact: 0 };
    flights.set(ball.id, flight);
    $('.ig-error').textContent = '';
    if (reducedMotion.matches) settle(flight);
    else if (frame === undefined) frame = requestAnimationFrame(tick);
    render();
  }

  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.plinkoRisk) drop(button.dataset.plinkoRisk);
    if (button.dataset.chip) { $('#ig-bet').value = button.dataset.chip; render(); }
    if (button.dataset.ig === 'retry') { for (const flight of flights.values()) if (flight.failed) settle(flight); render(); }
    if (button.dataset.ig === 'help') {
      closeHelp?.();
      closeHelp = showGameHelp('Zasady Plinko', [
        '<p>Wybierz stawkę za kulkę i 8, 12 albo 16 rzędów. Zielony, żółty i czerwony przycisk puszczają kulki o niskim, średnim i wysokim ryzyku. Tabele mnożników widać pod planszą.</p>',
        '<p>Możesz puszczać dowolną liczbę kulek jednocześnie, o ile masz dostępne żetony na ich stawki. Kulki są rozliczane niezależnie. Rzędy można zmienić po zakończeniu wszystkich lotów.</p>',
        '<p>Losujemy jeden z 32 768 równoprawdopodobnych startów. Stała grawitacja i zderzenia z kołkami, prowadnicami oraz przegrodami wyznaczają tor i końcowe pole. Przy odbiciach kulka traci energię. Tabele dla każdego koloru i liczby rzędów mają RTP 99%; etykiety na planszy są skrócone, dokładny mnożnik jest w opisie pola.</p>',
        '<p>Stawka jest rezerwowana przy zrzucie. Saldo i historia uwzględniają wynik dopiero po animacji każdej kulki. Wypłata to stawka razy dokładny mnożnik pola i zawiera stawkę. Ułamki zaokrąglamy losowo z zachowaniem średniej. Nie ma maksymalnej stawki; przed przyjęciem zakładu sprawdzamy miejsce na pełne wypłaty wszystkich kulek. Wyjście z gry rozlicza lecące kulki. Własny wariant demonstracyjny Betify.</p>',
      ]);
    }
  }, { signal: events.signal });
  $('#ig-bet').addEventListener('input', render, { signal: events.signal });
  root.addEventListener('animationend', (event) => {
    if (event.animationName === 'ig-peg-ring') event.target.closest('.ig-peg')?.classList.remove('ig-peg-hit');
    if (event.animationName === 'ig-slot-impact') event.target.classList.remove('ig-slot-impact');
  }, { signal: events.signal });
  $('#ig-rows').addEventListener('change', () => { if (!session.getState().active) board(); render(); }, { signal: events.signal });
  const unsubscribe = player.subscribe(render);
  board(); render();
  return () => {
    disposed = true;
    cancelAnimationFrame(frame); events.abort(); unsubscribe(); closeHelp?.(); session.close();
    for (const flight of flights.values()) settle(flight);
  };
}
