import { createInstantGame, diceOffer, minesOffer, goalOffer, payoutFor, PLINKO_PAYTABLES, PLINKO_ROWS, GOAL_SHOTS } from './engine.js';
import { showGameHelp } from '../../game-help.js';
import './instant.css';

const format = new Intl.NumberFormat('pl-PL');
const number = (value, digits = 2) => value.toLocaleString('pl-PL', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const times = (value) => `${number(value, 4)}×`;
const percent = (value) => `${number(value * 100)}%`;
const zoneNames = ['Lewy róg', 'Lewa strona', 'Środek', 'Prawa strona', 'Prawy róg'];
const copy = {
  dice: { title: 'Dice', subtitle: 'Wybierz swoją szansę.', action: 'Rzuć kośćmi', intro: 'Ustaw próg i wybierz kierunek zakładu.',
    rules: '<p>Losujemy jedną ze 10 000 równych wartości od 0,00 do 99,99. „Poniżej” wygrywa przy wyniku mniejszym od progu, „Od progu” przy wyniku równym progowi lub większym. Próg: 2–98.</p><p>Mnożnik: 0,99 / szansa. Szansa, mnożnik i wypłata po trafieniu są widoczne przed rzutem.</p>' },
  mines: { title: 'Mines', subtitle: 'Diament za diamentem.', action: 'Rozpocznij rundę', intro: 'Wybierz liczbę min. Odkrywaj diamenty i odbierz wygraną na czas.',
    rules: '<p>Plansza ma 25 pól i od 1 do 24 min. Układ jest losowany raz przed rundą i pozostaje stały. Każde bezpieczne pole zwiększa mnożnik. Mina kończy rundę ze stratą stawki i nieodebranej wygranej.</p><p>Po diamentach możesz odebrać żetony. Mnożnik to 0,99 podzielone przez prawdopodobieństwo odkrycia dotychczasowych bezpiecznych pól bez zwracania. Wszystkie diamenty lub limit wypłaty kończą rundę automatycznie.</p>' },
  trader: { title: 'Trader', subtitle: 'Twój typ. Następny ruch.', action: 'Sprawdź kierunek', intro: 'Wybierz wzrost albo spadek fikcyjnego kursu.',
    rules: '<p>Każda runda to niezależny ruch fikcyjnego kursu. Wzrost i spadek mają po 50% szans. Wykres historyczny nie przewiduje kolejnego ruchu. Nie korzystamy z giełdy ani rzeczywistych notowań.</p><p>Trafienie wypłaca 1,98× stawki. Zmiana wynosi od 1% do 5% poprzedniego kursu; jej wielkość nie zmienia wypłaty. Wskaźnik ma charakter ilustracyjny.</p>' },
  goal: { title: 'Goal', subtitle: 'Strzelaj. Trafiaj. Decyduj.', action: 'Rozpocznij serię', intro: 'Wybierz stawkę, a potem miejsce strzału.',
    rules: '<p>Wybierz jedno z pięciu miejsc strzału. Bramkarz niezależnie losuje jedno z nich, każde z szansą 20%. Zgodność oznacza obronę; pozostałe cztery miejsca oznaczają gola. Każdy strzał ma 80% szans powodzenia.</p><p>Po golu odbierz żetony lub kontynuuj. Obrona traci całą serię. Mnożnik po n golach: 0,99 / 0,8ⁿ. Po 10 golach automatycznie odbieramy wygraną. To własny demonstracyjny wariant Betify.</p>' },
  plinko: { title: 'Plinko', subtitle: 'Jedna kulka. Wiele dróg.', action: 'Puść kulkę', intro: 'Wybierz ryzyko i obserwuj drogę kulki do mnożnika.',
    rules: '<p>Kulka przechodzi przez 12 rzędów kołków. Każdy krok to niezależne losowanie w lewo albo w prawo z szansą 50%. Liczba kroków w prawo wyznacza jedno z 13 pól końcowych. Środkowe pola występują częściej niż skrajne.</p><p>Wypłata to stawka razy mnożnik z wybranego poziomu ryzyka. Tabela jest widoczna na planszy przed grą. Niskie ryzyko: 0,7–8×, wysokie: 0,1–100×. Również przegrana może zwrócić część stawki. Animacja pokazuje wylosowaną drogę.</p>' },
};

export function mountInstant(root, player, id) {
  const game = createInstantGame(id, player);
  const text = copy[id];
  let busy = false;
  let disposed = false;
  let preview;
  let error = '';
  let closeHelp;
  let timer;
  let resolveWait;
  let ballAnimation;
  const events = new AbortController();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  root.classList.add('instant-game');
  root.innerHTML = `<section class="ig-root ig-${id}" aria-label="${text.title}">
    <header class="ig-header"><div><span class="ig-eyebrow">BETIFY ORIGINALS</span><h1>${text.title}<span>.</span></h1><p>${text.subtitle}</p></div><button class="ig-help" data-ig="help">Zasady gry ⓘ</button></header>
    <div class="ig-layout"><div class="ig-arena"><div class="ig-stage"></div><div class="ig-message" role="status" aria-live="polite" aria-atomic="true"></div><div class="ig-history" aria-label="Historia rund"></div></div>
    <aside class="ig-controls" aria-label="Sterowanie grą">
      <div class="ig-stats"><span>Mnożnik<strong data-stat="multiplier">1×</strong></span><span data-payout-label>Wypłata po trafieniu<strong data-stat="payout">0</strong></span></div>
      <div class="ig-setup"><label for="ig-bet">Stawka w żetonach <small>10–5 000</small></label><input id="ig-bet" type="number" value="100" min="10" max="5000" step="1" inputmode="numeric"><div class="ig-chips">${[10, 50, 100, 500].map((value) => `<button data-chip="${value}" aria-pressed="${value === 100}">${value}</button>`).join('')}</div>
      ${id === 'dice' ? '<label for="ig-threshold">Próg <output id="ig-threshold-label">50</output></label><input id="ig-threshold" type="range" value="50" min="2" max="98" step="1"><div class="ig-directions" role="group" aria-label="Kierunek zakładu"><button data-direction="under" aria-pressed="true">↓ Poniżej</button><button data-direction="over" aria-pressed="false">↑ Od progu</button></div>' : ''}
      ${id === 'mines' ? '<label for="ig-mines">Liczba min</label><select id="ig-mines">' + Array.from({ length: 24 }, (_, index) => `<option ${index === 2 ? 'selected' : ''}>${index + 1}</option>`).join('') + '</select>' : ''}
      ${id === 'trader' ? '<div class="ig-directions" role="group" aria-label="Kierunek kursu"><button data-direction="up" aria-pressed="true">↑ Wzrost</button><button data-direction="down" aria-pressed="false">↓ Spadek</button></div>' : ''}
      ${id === 'plinko' ? '<label for="ig-risk">Poziom ryzyka</label><select id="ig-risk"><option value="low">Niskie · 0,7–8×</option><option value="high">Wysokie · 0,1–100×</option></select>' : ''}
      </div><div class="ig-offer"></div>${id === 'plinko' ? '<details class="ig-paytable"><summary>Tabela mnożników (od lewej)</summary><ol></ol></details>' : ''}<button class="button button-primary ig-play" data-ig="play">${text.action} ↗</button>
      <button class="button button-primary ig-cashout" data-ig="cashout" hidden>Odbierz żetony</button><button class="button button-primary" data-ig="retry" hidden>Ponów rozliczenie</button>
      <p class="ig-error" role="alert"></p><p class="ig-limit">Tylko wirtualne żetony.<br>Wypłata zawiera stawkę. Kwoty zaokrąglamy w dół.</p>
    </aside></div></section>`;
  const $ = (selector) => root.querySelector(selector);
  const options = () => ({ threshold: Number($('#ig-threshold')?.value || 50), mines: Number($('#ig-mines')?.value || 3),
    direction: $('[data-direction][aria-pressed="true"]')?.dataset.direction, risk: $('#ig-risk')?.value || 'low' });
  function wait(ms) {
    return new Promise((resolve) => {
      resolveWait = resolve;
      timer = setTimeout(() => { resolveWait = undefined; resolve(!disposed); }, reducedMotion.matches ? 0 : ms);
    });
  }
  function plinkoBoard(state) {
    const risk = options().risk;
    const pegs = Array.from({ length: PLINKO_ROWS }, (_, row) => Array.from({ length: row + 1 }, (_, column) => `<circle cx="${300 + (2 * column - row) * 20}" cy="${34 + row * 24}" r="3"/>`).join('')).join('');
    const slots = PLINKO_PAYTABLES[risk].map((value, slot) => `<g class="ig-slot ${state.result?.slot === slot && state.result.risk === risk && !busy ? 'ig-landed' : ''}"><rect x="${42 + slot * 40}" y="333" width="36" height="31" rx="5"/><text x="${60 + slot * 40}" y="353">${number(value, value % 1 ? 1 : 0)}×</text></g>`).join('');
    return `<svg viewBox="0 0 600 380" class="ig-plinko" role="img" aria-label="Plansza Plinko, 12 rzędów. Mnożniki od lewej: ${PLINKO_PAYTABLES[risk].join(', ')}"><g class="ig-pegs">${pegs}</g>${slots}<circle class="ig-ball" cx="0" cy="0" r="7" transform="translate(${state.result && !busy ? 60 + state.result.slot * 40 : 300} ${state.result && !busy ? 322 : 14})"/></svg>`;
  }
  function stage(state) {
    const playing = state.phase === 'playing';
    if (id === 'dice') {
      const { threshold, direction } = state.result || options();
      return `<div class="ig-dice"><span class="ig-board-caption">WYNIK RZUTU</span><strong class="ig-dice-value">${state.result ? number(state.result.roll / 100) : '—,—'}</strong><div class="ig-dice-track ${direction}" style="--threshold:${threshold}%"><span class="ig-threshold-marker">${threshold}</span>${state.result ? `<i style="left:${Math.max(1, Math.min(99, state.result.roll / 100))}%"></i>` : ''}</div><div class="ig-track-labels"><span>0,00</span><span>99,99</span></div><p>Wygrywa wynik ${direction === 'under' ? 'poniżej' : 'od'} <b>${threshold},00</b>${direction === 'over' ? ' włącznie' : ''}</p></div>`;
    }
    if (id === 'mines') {
      return `<div class="ig-mine-grid" role="group" aria-label="Plansza Mines, 5 na 5">${Array.from({ length: 25 }, (_, index) => {
        const bomb = state.bombs.includes(index);
        const revealed = state.revealed?.includes(index);
        const ended = ['finished', 'settling'].includes(state.phase);
        return `<button data-cell="${index}" class="ig-mine ${revealed ? 'ig-open' : ''} ${bomb ? 'ig-bomb' : ''} ${state.hit === index ? 'ig-hit' : ''}" ${!playing || busy || revealed ? 'disabled' : ''} aria-label="Pole ${index + 1}${bomb ? ', mina' : revealed ? ', diament' : ended ? ', bezpieczne' : ', zakryte'}">${bomb ? '✹' : revealed ? '◆' : ended ? '◇' : '<span aria-hidden="true">·</span>'}</button>`;
      }).join('')}</div>`;
    }
    if (id === 'trader') {
      const prices = state.result?.prices || [1000, 1000, 1000, 1000];
      const min = Math.min(...prices) * 0.995;
      const max = Math.max(...prices) * 1.005;
      const points = prices.map((price, index) => `${30 + index * 540 / (prices.length - 1)},${250 - (price - min) / (max - min) * 200}`).join(' ');
      return `<div class="ig-market-caption"><span>BET / DEMO · FIKCYJNY KURS</span><strong>${number(prices.at(-1))}</strong><small>${state.result ? `${state.result.movement === 'up' ? '↑' : '↓'} ${number(Math.abs((state.result.price / state.result.previous - 1) * 100))}% · ostatni ruch` : 'Każdy ruch jest niezależny'}</small></div><svg class="ig-chart" viewBox="0 0 600 300" role="img" aria-label="Fikcyjny kurs ${number(prices.at(-1))}, ${state.result?.movement === 'down' ? 'ostatni ruch w dół' : state.result ? 'ostatni ruch w górę' : 'oczekiwanie na pierwszy typ'}"><path class="ig-chart-grid" d="M30 50H570 M30 100H570 M30 150H570 M30 200H570 M30 250H570"/><polyline class="ig-chart-line ${state.result?.movement === 'down' ? 'ig-down' : ''}" points="${points}"/></svg><p class="ig-chart-note">Szansa każdego kierunku: 50%. Historia nie przewiduje kolejnego wyniku.</p>`;
    }
    if (id === 'goal') {
      return `<div class="ig-football"><div class="ig-goal-frame"><div class="ig-goal-net" aria-hidden="true"></div><span class="ig-keeper" aria-hidden="true" style="left:${10 + (state.result?.keeper ?? 2) * 20}%">🧤</span><div class="ig-zones" role="group" aria-label="Wybierz miejsce strzału">${zoneNames.map((zone, index) => `<button data-zone="${index}" ${!playing || busy ? 'disabled' : ''} class="${state.result?.zone === index ? 'ig-shot-zone' : ''}" aria-label="Strzel: ${zone}"><span>${index + 1}</span><small>${zone}</small></button>`).join('')}</div></div><div class="ig-football-ball ${state.result ? 'ig-shot' : ''}" style="--ball-x:${10 + (state.result?.zone ?? 2) * 20}%" aria-hidden="true">⚽</div><div class="ig-score" aria-label="Trafienia w serii">${Array.from({ length: GOAL_SHOTS }, (_, index) => `<span class="${state.shots?.[index] ? state.shots[index].scored ? 'ig-scored' : 'ig-saved' : ''}">${state.shots?.[index] ? state.shots[index].scored ? '●' : '×' : '○'}</span>`).join('')}</div></div>`;
    }
    return plinkoBoard(state);
  }
  function render() {
    if (disposed) return;
    const state = preview || game.getState();
    const playing = state.phase === 'playing';
    const settling = state.phase === 'settling';
    $('.ig-root').setAttribute('aria-busy', String(busy));
    const activeCell = document.activeElement?.dataset.cell;
    $('.ig-stage').innerHTML = stage(state);
    if (activeCell !== undefined) $(`[data-cell="${activeCell}"]`)?.focus();
    $('.ig-arena').dataset.outcome = busy ? '' : state.outcome || '';
    $('.ig-arena').classList.toggle('ig-busy', busy);
    const offer = id === 'dice' ? diceOffer(options().threshold, options().direction) : id === 'mines' ? minesOffer(playing ? state.mines : options().mines, playing ? state.wins : 0, state.bet) : id === 'goal' ? goalOffer(state.wins || 0, state.bet) : null;
    const bet = Number($('#ig-bet').value);
    const shownMultiplier = playing || state.phase === 'finished' || settling ? state.multiplier : offer?.multiplier || (id === 'trader' ? 1.98 : 1);
    $('[data-stat="multiplier"]').textContent = id === 'plinko' && state.phase === 'ready' ? '0,7–8×' : times(shownMultiplier);
    $('[data-stat="multiplier"]').parentElement.firstChild.textContent = state.phase === 'finished' ? 'Ostatni mnożnik' : 'Mnożnik';
    if (id === 'plinko' && state.phase === 'ready' && options().risk === 'high') $('[data-stat="multiplier"]').textContent = '0,1–100×';
    const payout = state.phase === 'finished' ? state.payout : playing ? state.availablePayout : settling ? 0 : id === 'dice' || id === 'trader' ? Number.isSafeInteger(bet) && bet >= 10 && bet <= 5000 ? payoutFor(bet, shownMultiplier) : 0 : 0;
    $('[data-stat="payout"]').textContent = format.format(payout);
    $('[data-payout-label]').firstChild.textContent = state.phase === 'finished' ? 'Wypłacono' : playing ? 'Do odebrania' : 'Wypłata po trafieniu';
    $('.ig-setup').querySelectorAll('input, select, button').forEach((node) => { node.disabled = busy || playing || settling; });
    $('[data-ig="play"]').hidden = playing || settling;
    $('[data-ig="play"]').disabled = busy;
    $('[data-ig="play"]').textContent = `${state.phase === 'finished' ? 'Zagraj ponownie' : text.action} ↗`;
    $('[data-ig="cashout"]').hidden = !playing || !['mines', 'goal'].includes(id);
    $('[data-ig="cashout"]').disabled = busy || !state.wins;
    $('[data-ig="cashout"]').textContent = state.wins ? `Odbierz ${format.format(state.availablePayout)} żetonów` : 'Odbierz po trafieniu';
    $('[data-ig="retry"]').hidden = !settling;
    $('[data-ig="retry"]').disabled = busy;
    const offerText = id === 'dice' ? `Szansa trafienia: ${percent(offer.probability)} · mnożnik nowego rzutu ${times(offer.multiplier)} · wypłata ${Number.isSafeInteger(bet) && bet >= 10 && bet <= 5000 ? format.format(payoutFor(bet, offer.multiplier)) : '—'}` : id === 'trader' ? '50% na każdy kierunek · trafienie 1,98×' : id === 'mines' ? playing ? `Diamenty: ${state.wins}/${25 - state.mines} · szansa następnego: ${percent(offer.nextProbability)} · kolejny mnożnik ${times(minesOffer(state.mines, state.wins + 1, state.bet)?.multiplier || state.multiplier)}` : `${25 - options().mines} diamentów · ${options().mines} min` : id === 'goal' ? playing ? `${state.wins}/${GOAL_SHOTS} goli · szansa strzału 80% · po kolejnym golu ${times(goalOffer(state.wins, state.bet).nextMultiplier)}` : 'Nowa seria: do 10 goli · szansa strzału 80% · po pierwszym golu 1,2375×' : '12 rzędów · 50% w lewo / 50% w prawo';
    $('.ig-offer').textContent = offerText;
    if (id === 'plinko') $('.ig-paytable ol').innerHTML = PLINKO_PAYTABLES[options().risk].map((value) => `<li>${number(value, value % 1 ? 1 : 0)}×</li>`).join('');
    if ($('#ig-threshold-label')) $('#ig-threshold-label').textContent = options().threshold;
    const net = state.payout - state.bet;
    const message = state.phase === 'finished' ? state.outcome === 'cancelled' ? 'Runda anulowana. Stawka zwrócona.' : `${state.outcome === 'lose' ? id === 'goal' ? 'Obrona bramkarza.' : id === 'mines' ? 'Mina!' : 'Runda zakończona.' : state.outcome === 'cashout' ? 'Żetony odebrane!' : 'Runda zakończona.'} Wypłata: ${format.format(state.payout)}. Bilans: ${net >= 0 ? '+' : ''}${format.format(net)}.${state.capped ? ' Wypłatę ograniczył limit portfela.' : ''}` : settling ? 'Wypłata czeka na rozliczenie. Kliknij „Ponów rozliczenie”.' : playing ? id === 'mines' ? 'Wybierz zakryte pole lub odbierz po diamentach.' : state.wins ? 'Gol! Strzelasz dalej czy odbierasz?' : 'Wybierz jedno z pięciu miejsc w bramce.' : text.intro;
    $('.ig-message').textContent = busy ? id === 'plinko' ? 'Kulka w drodze…' : id === 'goal' ? 'Strzał na bramkę…' : id === 'trader' ? 'Następny ruch kursu…' : 'Losowanie wyniku…' : message;
    $('.ig-error').textContent = error;
    $('.ig-history').innerHTML = '<span>OSTATNIE RUNDY</span>' + (state.history.length ? state.history.map((round) => `<span class="ig-history-item" data-positive="${round.payout >= round.bet}" title="Stawka ${round.bet}, wypłata ${round.payout}">${round.payout >= round.bet ? '+' : ''}${format.format(round.payout - round.bet)}</span>`).join('') : '<small>Tutaj pojawią się Twoje wyniki.</small>');
    root.querySelectorAll('[data-chip]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.chip) === bet)));
  }
  function help() {
    closeHelp?.();
    closeHelp = showGameHelp(`${text.title} — zasady`, [text.rules,
      '<p>Stawka: 10–5 000 całkowitych wirtualnych żetonów. Wypłaty zawierają stawkę i są zaokrąglane w dół. Limit wypłaty: 1 000 000, limit mnożnika serii: 1 000×. Wypłatę może ograniczyć wolne miejsce w portfelu (limit salda 1 miliard).</p><p>Przy zwykłym wyjściu odbieramy wygraną z aktywnej serii Mines/Goal, a przed pierwszym trafieniem zwracamy stawkę. Gry jednorundowe rozliczamy przed animacją. Reset kończy grę i ustawia saldo 10 000. Awaryjne zamknięcie może uniemożliwić rozliczenie serii.</p>']);
  }
  async function act(action, value) {
    if (busy || disposed) return;
    const before = game.getState();
    busy = true;
    try {
      error = (action === 'play' ? game.play(Number($('#ig-bet').value), options()) : action === 'cell' ? game.reveal(value) : action === 'zone' ? game.shoot(value) : action === 'cashout' ? game.cashout() : game.retry()) || '';
      const after = game.getState();
      const animate = !error && (action === 'cell' || action === 'zone' || action === 'play' && ['dice', 'trader', 'plinko'].includes(id));
      if (animate) {
        preview = before;
        render();
        if (id === 'plinko' && !reducedMotion.matches) {
          let rights = 0;
          const frames = [{ transform: 'translate(300px, 14px)' }, ...after.result.path.map((step, index) => {
            rights += step;
            return { transform: `translate(${300 + (2 * rights - index - 1) * 20}px, ${46 + index * 24}px)` };
          }), { transform: `translate(${60 + after.result.slot * 40}px, 322px)` }];
          const ball = $('.ig-ball');
          ball.removeAttribute('transform');
          ballAnimation = ball.animate(frames, { duration: 1800, easing: 'linear', fill: 'forwards' });
        }
        if (!await wait(id === 'plinko' ? 1800 : id === 'goal' ? 650 : 450)) return;
        ballAnimation?.cancel(); ballAnimation = undefined;
        preview = undefined;
      }
    } catch {
      error = 'Nie udało się wykonać ruchu. Sprawdź stan rundy i spróbuj ponownie.';
    } finally {
      busy = false;
      preview = undefined;
      render();
    }
  }
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || disposed) return;
    if (button.dataset.ig === 'help') { help(); return; }
    if (busy || button.disabled) return;
    if (button.dataset.chip) { $('#ig-bet').value = button.dataset.chip; error = ''; render(); return; }
    if (button.dataset.direction) {
      root.querySelectorAll('[data-direction]').forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
      error = ''; render(); return;
    }
    if (button.dataset.cell !== undefined) { act('cell', Number(button.dataset.cell)); return; }
    if (button.dataset.zone !== undefined) { act('zone', Number(button.dataset.zone)); return; }
    if (['play', 'cashout', 'retry'].includes(button.dataset.ig)) act(button.dataset.ig);
  }, { signal: events.signal });
  root.addEventListener('input', () => { if (!busy) { error = ''; render(); } }, { signal: events.signal });
  root.addEventListener('change', () => { if (!busy) render(); }, { signal: events.signal });
  const unsubscribe = player.subscribe(() => { if (!busy) render(); });
  render();
  return () => {
    disposed = true;
    clearTimeout(timer); resolveWait?.(false);
    ballAnimation?.cancel(); closeHelp?.();
    events.abort(); unsubscribe();
    game.close();
  };
}
