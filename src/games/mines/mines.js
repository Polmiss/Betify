import { createMines } from './engine.js';
import { showGameHelp } from '../../game-help.js';
import './mines.css';
import { createRoundReporter } from '../../round-results.js';
import { payoutLabel } from '../../rtp.js';

const format = new Intl.NumberFormat('pl-PL');
const times = (n) => n === null ? '—' : `${n.toFixed(n >= 100 ? 2 : 3).replace('.', ',')}×`;
const percent = (n) => `${(n * 100).toFixed(2).replace('.', ',')}%`;
const gem = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M6 22 20 8h24l14 14-26 34z" fill="#91f4d4"/><path d="M6 22h52M20 8l-1 14 13 34 13-34-1-14M19 22 32 8l13 14" stroke="#287c69" stroke-width="2"/><path d="m6 22 26 34-13-34z" fill="#4bbc9b"/><path d="M45 22h13L32 56z" fill="#38a789"/></svg>';
const mine = '<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><g stroke="#ffa3a6" stroke-width="5" stroke-linecap="round"><path d="M32 5v10m0 34v10M5 32h10m34 0h10M13 13l8 8m22 22 8 8M13 51l8-8m22-22 8-8"/></g><circle cx="32" cy="32" r="20" fill="#9b424b" stroke="#ffb2ad" stroke-width="2"/><circle cx="26" cy="25" r="5" fill="#ffcebd"/></svg>';

export function mountMines(root, player, { onRound } = {}) {
  const game = createMines(player);
  const roundReporter = createRoundReporter(onRound);
  const events = new AbortController();
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let disposed = false;
  let busy = false;
  let releaseBalance;
  let preview;
  let error = '';
  let timer;
  let resolveWait;
  let closeHelp;
  root.innerHTML = `<section class="mn-root" aria-label="Mines">
    <header class="mn-header"><div><h1>Mines<span>.</span></h1><p>Odkrywaj diamenty. Omijaj miny.</p></div><span class="mn-demo">WIRTUALNE ŻETONY · PLANSZA 5 × 5</span></header>
    <div class="mn-board"><div class="mn-board-top"><span class="mn-bomb-count"></span><span class="mn-chance"></span><span class="mn-gem-count"></span></div><div class="mn-field"><div class="mn-grid" role="group" aria-label="Plansza Mines, 5 wierszy i 5 kolumn">${Array.from({ length: 25 }, (_, i) => `<button class="mn-tile" data-cell="${i}" aria-label="Pole ${i + 1}, zakryte"><span class="mn-tile-cover" aria-hidden="true">◇</span></button>`).join('')}</div></div><div class="mn-message" role="status" aria-live="polite" aria-atomic="true"></div></div>
    <div class="mn-controls"><div class="mn-stats"><span>Diamenty<strong class="mn-found"></strong></span><span>Mnożnik<strong class="mn-multiplier"></strong></span><span>Do odebrania<strong class="mn-payout"></strong></span><span>Następny diament<strong class="mn-next"></strong></span></div>
      <div class="mn-settings"><label for="mn-bet">Stawka <small>od 10</small><input id="mn-bet" type="number" min="10" step="1" value="100" inputmode="numeric"/></label><label for="mn-mines">Liczba min<select id="mn-mines">${Array.from({ length: 24 }, (_, i) => `<option value="${i + 1}" ${i === 2 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></label><div class="mn-actions"><button class="button button-primary" data-mn="start">Rozpocznij rundę ↗</button><button class="button button-secondary" data-mn="random">Losowe pole ⤨</button><button class="button button-primary" data-mn="cashout">Odbierz żetony</button></div></div>
      <p class="mn-error" role="alert"></p><div class="mn-footer"><div class="mn-presets" aria-label="Szybki wybór liczby min">${[1, 3, 5, 10, 24].map((count) => `<button data-mines="${count}" aria-pressed="${count === 3}">${count} ${count === 1 ? 'mina' : count === 3 || count === 24 ? 'miny' : 'min'}</button>`).join('')}</div><span class="mn-note">Układ min jest stały przez całą rundę.</span><button class="mn-rules" data-mn="rules">Zasady gry ⓘ</button></div>
    </div></section>`;
  const $ = (selector) => root.querySelector(selector);
  const cells = [...root.querySelectorAll('[data-cell]')];

  function render() {
    if (disposed) return;
    const state = preview || game.getState();
    if (!busy) roundReporter.report(state);
    const playing = state.phase === 'playing';
    const finished = state.phase === 'finished';
    $('.mn-root').setAttribute('aria-busy', String(busy));
    $('.mn-board').dataset.outcome = busy ? '' : state.outcome || '';
    $('.mn-bomb-count').textContent = `● Miny: ${state.mineCount}`;
    $('.mn-gem-count').textContent = `◇ Pozostało: ${state.safeRemaining}`;
    $('.mn-chance').textContent = `Szansa następnego diamentu: ${percent(state.nextChance)}`;
    $('.mn-found').textContent = `${state.opened.length} / ${25 - state.mineCount}`;
    $('.mn-multiplier').textContent = times(state.effectiveMultiplier);
    $('.mn-payout').textContent = (state.phase === 'finished' ? format.format(state.payout) : state.opened.length ? payoutLabel(state.bet * state.multiplier) : '0');
    $('.mn-next').textContent = state.nextMultiplier === null ? 'Wszystkie odkryte' : times(state.effectiveNextMultiplier);
    $('.mn-message').textContent = busy ? 'Odkrywanie pola…' : state.outcome === 'mine' ? `Mina! Bilans rundy: −${format.format(state.bet)} żetonów.` : ['cashout', 'cleared', 'limit'].includes(state.outcome) ? `${state.outcome === 'cleared' ? 'Wszystkie diamenty! ' : state.outcome === 'limit' ? 'Limit wygranej! ' : ''}Odebrano ${format.format(state.payout)} żetonów · Bilans: ${state.payout - state.bet >= 0 ? '+' : ''}${format.format(state.payout - state.bet)}` : playing ? state.opened.length ? 'Diament! Odkrywasz kolejne pole czy odbierasz?' : 'Wybierz pierwsze pole. Każde może kryć minę.' : 'Ustaw stawkę i liczbę min, a potem rozpocznij rundę.';
    for (const [index, button] of cells.entries()) {
      const cell = state.cells[index];
      const kind = cell.kind;
      if (button.dataset.kind !== kind) {
        button.dataset.kind = kind;
        button.innerHTML = kind === 'gem' ? gem : kind === 'mine' ? mine : '<span class="mn-tile-cover" aria-hidden="true">◇</span>';
        button.style.setProperty('--reveal-delay', finished && !cell.selected ? `${index * 12}ms` : '0ms');
      }
      button.classList.toggle('mn-selected', cell.selected);
      button.classList.toggle('mn-hit', state.hit === index);
      button.classList.toggle('mn-unpicked', finished && !cell.selected);
      button.disabled = !playing || busy || cell.selected;
      button.setAttribute('aria-label', `Wiersz ${Math.floor(index / 5) + 1}, kolumna ${index % 5 + 1}, ${kind === 'gem' ? 'diament' : kind === 'mine' ? 'mina' : 'zakryte'}${cell.selected ? ', wybrane' : ''}`);
    }
    $('#mn-bet').disabled = playing || busy;
    $('#mn-mines').disabled = playing || busy;
    root.querySelectorAll('[data-mines]').forEach((button) => { button.disabled = playing || busy; button.setAttribute('aria-pressed', String(Number(button.dataset.mines) === Number($('#mn-mines').value))); });
    $('[data-mn="start"]').hidden = playing || busy;
    $('[data-mn="start"]').textContent = finished ? 'Nowa runda ↗' : 'Rozpocznij rundę ↗';
    $('[data-mn="cashout"]').hidden = !playing && !busy;
    $('[data-mn="random"]').hidden = !playing && !busy;
    $('[data-mn="cashout"]').disabled = busy || !playing || state.opened.length === 0;
    $('[data-mn="random"]').disabled = busy || !playing;
    $('[data-mn="cashout"]').textContent = state.opened.length ? `Odbierz ${payoutLabel(state.bet * state.multiplier)} żetonów` : 'Odbierz po odkryciu';
    $('.mn-presets').hidden = playing || busy;
    $('.mn-error').textContent = error;
  }

  function wait() {
    return new Promise((resolve) => { resolveWait = resolve; timer = setTimeout(() => { resolveWait = undefined; resolve(!disposed); }, motion.matches ? 0 : 320); });
  }
  function help() {
    closeHelp?.();
    closeHelp = showGameHelp('Mines — zasady', [
      '<p>Plansza ma 25 pól (5 × 5). Przed rundą wybierasz stawkę od 10 żetonów oraz od 1 do 24 min. Układ losujemy raz, przed pierwszym odkryciem. Miny nie zmieniają położenia. Pierwsze pole również może być miną.</p><p>Diament zwiększa mnożnik. Mina natychmiast kończy rundę i traci całą postawioną stawkę oraz nieodebraną wygraną.</p>',
      '<p>Po przynajmniej jednym diamencie możesz odebrać żetony. Odkrycie wszystkich bezpiecznych pól kończy rundę z automatyczną wypłatą. Zanim następny diament wymagałby przekroczenia pojemności portfela, odbieramy pełną bieżącą wygraną. Losowe pole wybiera spośród wszystkich nieodkrytych pól — może trafić w minę.</p><p>Szansa następnego diamentu to liczba pozostałych diamentów podzielona przez liczbę zakrytych pól.</p>',
      '<p>Mnożnik Betify: 0,99 × C(25, k) / C(25 − m, k), gdzie m to liczba min, a k to liczba odkrytych diamentów. C oznacza liczbę kombinacji. Współczynnik 0,99 jest uwzględniany raz.</p><p>RTP 99%. Wypłata zawiera stawkę. Ułamki zaokrąglamy losowo do sąsiednich całych żetonów z zachowaniem średniej; panel pokazuje zakres.</p>',
      '<p>Nie można zmieniać stawki ani liczby min w aktywnej rundzie. Przy zwykłym opuszczeniu gry odbieramy bieżącą wygraną; jeśli jeszcze nie odkryto żadnego pola, zwracamy stawkę. Awaryjne zamknięcie przeglądarki może uniemożliwić rozliczenie.</p><p>Reset salda rozlicza i zamyka rundę, przerywa animacje i przywraca dokładnie 10 000 żetonów. Wyłącznie wirtualna rozgrywka.</p>',
    ]);
  }
  async function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || disposed) return;
    if (button.dataset.mn === 'rules') { help(); return; }
    if (busy) return;
    error = '';
    if (button.dataset.mines) { $('#mn-mines').value = button.dataset.mines; error = game.configure(Number(button.dataset.mines)) || ''; render(); return; }
    if (button.dataset.mn === 'start') { error = game.start(Number($('#mn-bet').value), Number($('#mn-mines').value)) || ''; if (!error) roundReporter.begin(); render(); return; }
    if (button.dataset.mn === 'cashout') { error = game.cashout() || ''; render(); return; }
    if (button.dataset.cell === undefined && button.dataset.mn !== 'random') return;
    const before = game.getState();
    busy = true;
    releaseBalance = player.beginAnimation?.();
    error = (button.dataset.mn === 'random' ? game.randomPick() : game.reveal(Number(button.dataset.cell))) || '';
    if (error) { busy = false; releaseBalance?.(); render(); return; }
    const after = game.getState();
    const chosen = after.hit ?? after.opened.at(-1);
    preview = { ...after, phase: 'playing', outcome: null, cells: before.cells.map((cell, i) => i === chosen ? after.cells[i] : cell) };
    render();
    if (!(await wait())) return;
    preview = undefined;
    busy = false;
    releaseBalance?.();
    render();
  }
  root.addEventListener('click', onClick, { signal: events.signal });
  $('#mn-mines').addEventListener('change', () => { error = game.configure(Number($('#mn-mines').value)) || ''; render(); }, { signal: events.signal });
  const unsubscribe = player.subscribe(() => { if (!busy && !disposed) render(); });
  render();
  return () => {
    disposed = true; clearTimeout(timer); resolveWait?.(false);
    closeHelp?.(); events.abort(); unsubscribe(); game.close();
    releaseBalance?.();
    roundReporter.report(game.getState());
  };
}
