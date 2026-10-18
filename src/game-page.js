import './style.css';
import './theme.css';
import './game-page.css';
import { games } from './catalog.js';
import { browserPlayer } from './player-session.js';
import { mountRoulette } from './games/roulette/roulette.js';
import { mountBlackjack } from './games/blackjack.js';
import { mountHighLow } from './games/high-low/high-low.js';
import { mountInstant } from './games/instant/instant.js';
import { artwork } from './artwork.js';
import { icon } from './icons.js';
import { showGameHelp } from './game-help.js';
import './game-viewport.css';

const player = browserPlayer();
const format = new Intl.NumberFormat('pl-PL');
let cleanup;
let closeHelp;
document.querySelector('#app').innerHTML = `<header class="game-topbar"><a class="game-back" href="./">${icon('arrow')}<span>Lobby</span></a><a class="game-wordmark" href="./">betify<span>.</span></a><span class="game-mode">WIRTUALNA ROZGRYWKA</span><div class="game-page-wallet">${icon('coin')}<strong class="balance-value"></strong><button class="game-reset" aria-label="Resetuj saldo do 10 000 żetonów">Resetuj saldo</button></div></header><main class="game-surface" id="game-content"></main><p class="game-page-notice" role="status" hidden></p>`;
const surface = document.querySelector('#game-content');
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
  document.querySelectorAll('.balance-value').forEach((node) => { node.textContent = format.format(player.getState().balance); });
  const notice = document.querySelector('.game-page-notice');
  notice.hidden = player.getState().persistent;
  notice.textContent = 'Zapisywanie jest niedostępne. Saldo zostaje tylko do odświeżenia tej karty.';
}
player.subscribe(updateWallet);
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
  if (!game) { document.title = 'Nie znaleziono gry — Betify'; surface.innerHTML = '<section class="game-placeholder"><h1>Nie znaleziono gry.</h1><a class="button button-primary" href="./">Wróć do lobby</a></section>'; return; }
  document.title = `${game.name} — Betify`;
  if (id === 'roulette') cleanup = mountRoulette(surface, { player });
  else if (id === 'blackjack') { surface.classList.add('blackjack-game'); cleanup = mountBlackjack(surface, player); }
  else if (id === 'high-low') { surface.classList.add('high-low-game'); cleanup = mountHighLow(surface, player); }
  else if (['dice', 'mines', 'trader', 'goal', 'plinko'].includes(id)) cleanup = mountInstant(surface, player, id);
  else {
    surface.innerHTML = `<section class="game-placeholder"><div class="game-placeholder-art ${game.color}">${artwork(id, 'page')}</div><div><span class="eyebrow">BETIFY ORIGINALS · WKRÓTCE</span><h1>${game.name}<span class="mint">.</span></h1><h2>${game.tagline}</h2><p>${game.description}</p><ol class="rules">${game.rules.map((rule) => `<li>${rule}</li>`).join('')}</ol><button class="button button-primary" id="page-favorite">${icon('heart')}<span></span></button><p class="game-placeholder-note">Przygotowujemy tę grę. Tymczasem zagraj w ruletkę lub blackjacka.</p></div></section>`;
    const favorite = document.querySelector('#page-favorite');
    const label = () => { const selected = player.getState().favorites.includes(id); favorite.querySelector('span').textContent = selected ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'; favorite.setAttribute('aria-pressed', String(selected)); };
    favorite.addEventListener('click', () => { player.toggleFavorite(id); label(); }); label();
  }
  updateWallet();
}
window.addEventListener('hashchange', render);
window.addEventListener('pagehide', () => cleanup?.());
window.addEventListener('pageshow', (event) => { if (event.persisted) location.reload(); });
render();

