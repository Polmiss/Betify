import './style.css';
import './theme.css';
import './game-page.css';
import { games } from './catalog.js';
import { browserPlayer } from './player-session.js';
import { mountRoulette } from './games/roulette/roulette.js';
import { mountBlackjack } from './games/blackjack.js';
import { mountHighLow } from './games/high-low/high-low.js';
import { mountMines } from './games/mines/mines.js';
import { mountInstant } from './games/instant/instant.js';
import { mountPlinko } from './games/instant/plinko.js';
import { artwork } from './artwork.js';
import { icon } from './icons.js';
import { showGameHelp } from './game-help.js';
import './game-viewport.css';
import { mountCookieNotice } from './cookie-notice.js';
import { mountRoundHistory } from './round-history.js';
import { createAnimatedWallet } from './animated-wallet.js';
import { RTP_RULE, ROUNDING_RULE } from './rtp.js';

const player = createAnimatedWallet(browserPlayer());
const format = new Intl.NumberFormat('pl-PL');
let cleanup;
let closeHelp;
document.querySelector('#app').innerHTML = `<header class="game-topbar"><a class="game-back" href="./">${icon('arrow')}<span>Lobby</span></a><a class="game-wordmark" href="./">betify<span>.</span></a><span class="game-mode">WIRTUALNA ROZGRYWKA</span><div class="game-page-wallet">${icon('coin')}<strong class="balance-value"></strong><button class="game-reset" aria-label="Resetuj saldo do 10 000 żetonów">Resetuj saldo</button></div><button class="game-cookie-settings" data-cookie-settings aria-label="Cookies i prywatność">Cookies</button></header><main class="game-surface" id="game-content"></main><p class="game-page-notice" role="status" hidden></p>`;
const surface = document.querySelector('#game-content');
const historyRoot = document.createElement('section');
historyRoot.className = 'round-history';
surface.before(historyRoot);
const roundHistory = mountRoundHistory(historyRoot);
surface.addEventListener('click', (event) => {
  const button = event.target.closest('.rt-rules-toggle, .bj-rules summary');
  if (!button) return;
  event.preventDefault(); event.stopPropagation();
  closeHelp?.();
  let pages;
  if (button.matches('.rt-rules-toggle')) {
    pages = [...surface.querySelector('.rt-rules').children].filter((node) => !node.matches('h3')).map((node) => node.outerHTML);
  } else {
    const rules = [...surface.querySelectorAll('.bj-rules li')];
    pages = [];
    for (let i = 0; i < rules.length; i += 2) pages.push(`<ul>${rules.slice(i, i + 2).map((node) => node.outerHTML).join('')}</ul>`);
  }
  button.setAttribute('aria-expanded', 'true');
  closeHelp = showGameHelp('Zasady stołu', pages, () => button.setAttribute('aria-expanded', 'false'));
}, true);
function updateWallet() {
  document.querySelectorAll('.balance-value').forEach((node) => { node.textContent = format.format(player.getDisplayState().balance); });
  const notice = document.querySelector('.game-page-notice');
  notice.hidden = player.getState().persistent;
  notice.textContent = 'Zapisywanie jest niedostępne. Saldo zostaje tylko do odświeżenia tej karty.';
}
player.subscribeDisplay(updateWallet);
document.querySelector('.game-reset').addEventListener('click', () => {
  // Finish pending animations and settlement before setting the initial balance.
  closeHelp?.();
  cleanup?.(); cleanup = undefined;
  player.resetBalance();
  render();
});

function render() {
  closeHelp?.();
  cleanup?.(); cleanup = undefined;
  surface.className = 'game-surface';
  const id = location.hash.replace(/^#(?:game\/)?/, '') || 'roulette';
  const game = games.find((item) => item.id === id);
  roundHistory.select(id);
  historyRoot.hidden = !game;
  const onRound = roundHistory.forGame(id);
  if (!game) { document.title = 'Nie znaleziono gry — Betify'; surface.innerHTML = '<section class="game-placeholder"><h1>Nie znaleziono gry.</h1><a class="button button-primary" href="./">Wróć do lobby</a></section>'; return; }
  document.title = `${game.name} — Betify`;
  if (id === 'roulette') cleanup = mountRoulette(surface, { player, onRound });
  else if (id === 'blackjack') { surface.classList.add('blackjack-game'); cleanup = mountBlackjack(surface, player, { onRound }); }
  else if (id === 'high-low') { surface.classList.add('high-low-game'); cleanup = mountHighLow(surface, player, { onRound }); }
  else if (id === 'mines') { surface.classList.add('mines-game'); cleanup = mountMines(surface, player, { onRound }); }
  else if (id === 'plinko') cleanup = mountPlinko(surface, player, { onRound });
  else if (['dice', 'trader', 'goal'].includes(id)) cleanup = mountInstant(surface, player, id, { onRound });
  else {
    surface.innerHTML = `<section class="game-placeholder"><div class="game-placeholder-art ${game.color}">${artwork(id, 'page')}</div><div><span class="eyebrow">BETIFY ORIGINALS · WKRÓTCE</span><h1>${game.name}<span class="mint">.</span></h1><h2>${game.tagline}</h2><p>${game.description}</p><ol class="rules">${game.rules.map((rule) => `<li>${rule}</li>`).join('')}</ol><button class="button button-primary" id="page-favorite">${icon('heart')}<span></span></button><p class="game-placeholder-note">Przygotowujemy tę grę. Tymczasem zagraj w ruletkę lub blackjacka.</p></div></section>`;
    const favorite = document.querySelector('#page-favorite');
    const label = () => { const selected = player.getState().favorites.includes(id); favorite.querySelector('span').textContent = selected ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'; favorite.setAttribute('aria-pressed', String(selected)); };
    favorite.addEventListener('click', () => { player.toggleFavorite(id); label(); }); label();
  }
  const title = surface.querySelector('.ig-header h1, .hl-header h1, .mn-header h1, .rt-header h2, .bj-header h2');
  if (title) {
    const badge = document.createElement('button');
    badge.className = 'game-rtp-badge';
    badge.innerHTML = id === 'blackjack' ? 'RTP 99%* ⓘ<small>strategia optymalna</small>' : 'RTP 99% ⓘ';
    if (id === 'blackjack') badge.classList.add('game-rtp-strategy');
    badge.setAttribute('aria-label', id === 'blackjack' ? 'RTP 99% przy strategii optymalnej — szczegóły' : 'RTP 99% — szczegóły');
    badge.addEventListener('click', () => {
      closeHelp?.();
      closeHelp = showGameHelp('RTP — średni zwrot', [
        `<p>${RTP_RULE}</p><p>${id === 'blackjack' ? 'Blackjack: 99% przy optymalnych decyzjach i środkach na podwojenie; inne decyzje mogą obniżyć zwrot. Podpowiedzi przy stole pokazują tę strategię. RTP liczymy względem sumy stawek, włącznie z podwojeniami. Karty są losowane niezależnie ze zwracaniem.' : 'Przewaga matematyczna gry wynosi 1%. Wynik zależy od losowania, a nie od Twojej dotychczasowej historii wygranych i przegranych.'}</p>`,
        `<p>${ROUNDING_RULE}</p><p>Podane przed grą zakresy pokazują obie możliwe całkowite wypłaty. Zaokrąglenie jest niezależne od wyniku gry i wykonywane tylko raz, także przy ponawianiu wypłaty.</p>`,
        `<p>${id === 'plinko' ? 'Dla 8, 12 i 16 rzędów liczymy wszystkie 32 768 jednakowo prawdopodobnych zrzutów (16 384 starty i ich odbicia lustrzane). Tor nadal wyznacza grawitacja i zderzenia. Każda tabela kolorów jest skalowana tak, aby suma prawdopodobieństw pól razy ich mnożniki wynosiła 0,99.' : id === 'roulette' ? 'Każda z 37 liczb jest równie prawdopodobna. Pełny mnożnik to 0,99 × 37 / liczba wygrywających pól: liczba 36,63×, tuzin/kolumna 3,0525×, zakład na 18 pól 2,035×. Wypłaty obejmują stawkę.' : 'W seriach współczynnik 0,99 uwzględniamy raz. Zanim następne trafienie wymagałoby obcięcia wypłaty do limitu, odbieramy bieżącą wygraną. Nową stawkę przyjmujemy tylko z miejscem na pełną możliwą wypłatę.'}</p>`,
      ]);
    });
    title.append(badge);
  }
  updateWallet();
}
window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => cleanup?.());
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
render();
mountCookieNotice();

