import './style.css';
import './theme.css';
import { games, categories, filterGames } from './catalog.js';
import { browserPlayer } from './player-session.js';
import { icon } from './icons.js';
import { artwork, heroArtwork } from './artwork.js';

const player = browserPlayer();
const gameHref = (id) => `./game.html#${encodeURIComponent(id)}`;
const view = { category: 'all', query: '', sort: 'recommended' };
const number = new Intl.NumberFormat('pl-PL');
let toastTimer;
let previousFocus;

document.querySelector('#app').innerHTML = `
  <a class="skip-link" href="#catalog">Przejdź do gier</a>
  <button class="sidebar-overlay" aria-label="Zamknij menu" hidden></button>
  <aside class="sidebar" id="sidebar" aria-label="Menu główne">
    <button class="sidebar-close icon-button" aria-label="Zamknij menu nawigacji">${icon('close')}</button>
    <a class="brand" href="#" aria-label="Betify — strona główna"><span class="brand-mark">b<span>♠</span></span>betify<span class="brand-dot">.</span></a>
    <span class="sidebar-label">TWOJA STREFA GRY</span>
    <nav class="side-nav" aria-label="Kategorie gier">
      <button class="nav-item active" data-category="all">${icon('grid')}<span>Lobby</span><span class="nav-count">08</span></button>
      <button class="nav-item" data-category="favorites">${icon('heart')}<span>Ulubione</span><span class="nav-count" id="favorite-count">0</span></button>
      <div class="nav-divider"></div>
      ${categories.slice(1).map((category) => `<button class="nav-item" data-category="${category.id}">${icon(category.icon)}<span>${category.name}</span></button>`).join('')}
    </nav>
    <div class="sidebar-bottom">
      <div class="play-note"><span class="play-note-icon">${icon('shield')}</span><strong>100% zabawy.<br>0% prawdziwej kasy.</strong><p>Tylko wirtualne żetony.<br>Wszystkie emocje zostają.</p><button class="text-button" data-action="about">Poznaj Betify ${icon('diagonal')}</button></div>
      <div class="sidebar-meta"><span class="status-dot"></span> TRYB DEMO <span>v0.1</span></div>
    </div>
  </aside>

  <div class="page">
    <header class="topbar">
      <div class="topbar-left"><button class="icon-button mobile-menu" id="menu-toggle" aria-label="Otwórz menu" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button><span class="header-title">Kasyno</span><span class="demo-pill">PLAY FOR FUN</span></div>
      <label class="search-box">${icon('search')}<input id="search" type="search" placeholder="Znajdź swoją grę…" aria-label="Szukaj gry" autocomplete="off"/><kbd>/</kbd></label>
      <div class="header-wallet"><span class="wallet-coin">${icon('coin')}</span><div><span class="balance-caption">Twoje saldo</span><strong class="balance-value">10 000</strong></div><button class="wallet-add" data-action="wallet" aria-label="Otwórz portfel z wirtualnymi żetonami">${icon('wallet')}</button></div>
      <button class="avatar" data-action="about" aria-label="Informacje o trybie gościa">G</button>
    </header>

    <main id="main">
      <div class="welcome-row"><div><p class="eyebrow">DOBRZE, ŻE JESTEŚ</p><h1>Witaj w swoim lobby<span class="mint">.</span></h1></div><span class="guest-note"><span class="status-dot"></span> Grasz jako gość</span></div>

      <section class="hero-grid" aria-label="Wprowadzenie do Betify">
        <div class="hero">
          <div class="hero-content"><span class="hero-label"><span></span> PRAWDZIWE EMOCJE. WIRTUALNE ŻETONY.</span><h2>Twój stół.<br>Twoje <span>zasady.</span></h2><p>Klasyki kasyna i nowe wyzwania.<br>Wybierz swój klimat. Reszta to zabawa.</p><a class="button button-primary" href="#catalog">Odkryj gry ${icon('arrow')}</a><div class="hero-footnote">${icon('shield')} Bez wpłat. Bez wypłat. Bez presji.</div></div>
          ${heroArtwork()}<span class="hero-watermark" aria-hidden="true">BETIFY</span>
        </div>
        <div class="hero-side">
          <div class="starter-card"><div class="starter-top"><span class="gift-icon">${icon('gift')}</span><span>NA DOBRY POCZĄTEK</span></div><h2>Wszystko zaczyna się<br>od dobrej puli.</h2><div class="starter-balance">10 000 <span>żetonów na start</span></div><button class="starter-link" data-action="wallet">Twój wirtualny portfel ${icon('arrow')}</button><span class="starter-orbit" aria-hidden="true"></span></div>
          <button class="random-card" data-action="random"><span class="random-icon">${icon('shuffle')}</span><span><strong>Daj się zaskoczyć</strong><small>Odkryj losową grę</small></span>${icon('diagonal')}</button>
        </div>
      </section>

      <section class="catalog" id="catalog" aria-labelledby="catalog-title">
        <div class="section-heading"><div><div class="section-title"><span class="section-icon">${icon('grid')}</span><h2 id="catalog-title">Znajdź swoją grę</h2><span class="total-count" id="total-count">8</span></div><p>Twoja siódemka gier. Plus Plinko jako honorable mention.</p></div><div class="planned-note">${icon('cards')} High Low, Blackjack i Roulette dostępne</div></div>
        <div class="catalog-controls"><div class="category-tabs" role="group" aria-label="Filtruj gry">${categories.map((category) => `<button class="category-tab ${category.id === 'all' ? 'active' : ''}" data-category="${category.id}" aria-pressed="${category.id === 'all'}">${icon(category.icon)} ${category.name}</button>`).join('')}<button class="category-tab" data-category="favorites" aria-pressed="false">${icon('heart')} Ulubione</button></div><label class="sort-label"><span class="sr-only">Sortuj gry</span><select id="sort"><option value="recommended">Polecane</option><option value="name">Nazwa A–Z</option></select>${icon('chevron')}</label></div>
        <div class="game-grid" id="game-grid"></div><p class="sr-only" id="result-announcement" role="status" aria-live="polite"></p>
      </section>

      <section class="bottom-banner"><span class="banner-symbol" aria-hidden="true">♧</span><div><h2>Cała frajda. Żadnych prawdziwych pieniędzy.</h2><p>Betify to Twoja przestrzeń do poznawania gier. Żetony są wirtualne, a zabawa jest po Twojemu.</p></div><span class="fun-badge">JUST FOR FUN ${icon('shield')}</span></section>
      <footer><a class="footer-brand" href="#">betify<span>.</span></a><span>Mała przerwa. Dobra rozgrywka.</span><button class="text-button" data-action="about">O projekcie ${icon('diagonal')}</button><span class="footer-copyright">© ${new Date().getFullYear()} Betify · Projekt demonstracyjny</span></footer>
    </main>
  </div>
  <dialog id="dialog" aria-labelledby="dialog-title"><button class="dialog-close icon-button" aria-label="Zamknij okno">${icon('close')}</button><div id="dialog-content"></div></dialog>
  <div class="toast" role="status" aria-live="polite" hidden></div>
  <div class="storage-notice" role="status" hidden>Zapisywanie w przeglądarce jest niedostępne. Twoje saldo i ulubione zostaną zachowane tylko do odświeżenia strony.</div>
`;

const dialog = document.querySelector('#dialog');
function toast(message) {
  const element = document.querySelector('.toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3300);
}

function renderGames() {
  const { favorites } = player.getState();
  const filtered = filterGames({ ...view, favorites });
  document.querySelector('#total-count').textContent = filtered.length;
  document.querySelector('#result-announcement').textContent = `Liczba znalezionych gier: ${filtered.length}`;
  document.querySelector('#game-grid').innerHTML = filtered.length ? filtered.map((game) => `
    <article class="game-card ${game.color}">
      <div class="game-visual"><a class="art-button" href="${gameHref(game.id)}" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true">${artwork(game.id)}</a>${game.tag ? `<span class="game-tag">${game.tag === 'Honorable mention' ? icon('star') : game.tag === 'Instant' ? icon('bolt') : icon('cards')}${game.tag}</span>` : ''}<button class="favorite-button ${favorites.includes(game.id) ? 'selected' : ''}" data-favorite="${game.id}" aria-label="${favorites.includes(game.id) ? 'Usuń' : 'Dodaj'} ${game.name} ${favorites.includes(game.id) ? 'z ulubionych' : 'do ulubionych'}" aria-pressed="${favorites.includes(game.id)}">${icon('heart')}</button><span class="art-label">BETIFY ORIGINALS</span></div>
      <div class="game-info"><div class="game-heading"><h3><a href="${gameHref(game.id)}" target="_blank" rel="noopener" aria-label="${game.name} — otwórz w nowej karcie">${game.name}</a></h3><span class="game-open" aria-hidden="true">${icon('diagonal')}</span></div><p>${game.label}</p><div class="game-card-bottom"><span>${categories.find((category) => category.id === game.category).name}</span><span class="coming-soon ${game.status === 'playable' ? 'mint' : ''}"><i></i>${game.status === 'playable' ? 'Zagraj teraz' : 'Wkrótce'}</span></div></div>
    </article>`).join('') : `<div class="empty-state">${icon(view.category === 'favorites' ? 'heart' : 'search')}<h3>${view.category === 'favorites' && !view.query ? 'Twoje typy mają tu swoje miejsce' : 'Nie znaleźliśmy takiej gry'}</h3><p>${view.category === 'favorites' && !view.query ? 'Kliknij serce na karcie gry, aby dodać ją do ulubionych.' : 'Spróbuj innej nazwy lub zobacz wszystkie kategorie.'}</p><button class="button button-secondary" data-action="clear-filters">Zobacz wszystkie gry ${icon('arrow')}</button></div>`;
}

function updatePlayer() {
  const { balance, favorites, persistent } = player.getState();
  document.querySelectorAll('.balance-value').forEach((element) => { element.textContent = number.format(balance); });
  document.querySelector('#favorite-count').textContent = favorites.length;
  document.querySelector('.storage-notice').hidden = persistent;
}
player.subscribe(updatePlayer);

function setCategory(category, scroll = false) {
  view.category = category;
  document.querySelectorAll('[data-category]').forEach((button) => {
    const selected = button.dataset.category === category;
    button.classList.toggle('active', selected);
    if (button.classList.contains('category-tab')) button.setAttribute('aria-pressed', String(selected));
    else if (selected) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  renderGames();
  closeMenu(true);
  if (scroll) document.querySelector('#catalog').scrollIntoView({ behavior: 'smooth' });
}

function openDialog(content) {
  if (document.body.classList.contains('menu-open')) closeMenu(true);
  previousFocus = document.activeElement;
  document.querySelector('#dialog-content').innerHTML = content;
  if (!dialog.open) dialog.showModal();
}

function openGame(id) {
  if (games.some((game) => game.id === id)) window.open(gameHref(id), '_blank', 'noopener');
}

function openWallet() {
  openDialog(`<div class="dialog-body wallet-dialog"><span class="dialog-symbol">${icon('wallet')}</span><span class="eyebrow">TYLKO WIRTUALNE ŻETONY</span><h2 id="dialog-title">Twój portfel<span class="mint">.</span></h2><p>Dobra zabawa nie potrzebuje prawdziwych pieniędzy.</p><div class="wallet-total">${icon('coin')}<strong class="balance-value">${number.format(player.getState().balance)}</strong><span>żetonów</span></div><button class="button button-primary full-width" data-action="reset-balance">Resetuj saldo do 10 000 żetonów</button><small class="dialog-footnote">Możesz tylko przywrócić saldo początkowe: 10 000 żetonów.<br>Żetony nie mają wartości pieniężnej.</small></div>`);
}

function openAbout() {
  openDialog(`<div class="dialog-body about-dialog"><span class="dialog-symbol">${icon('shield')}</span><span class="eyebrow">MAŁY PROJEKT. DUŻO ZABAWY.</span><h2 id="dialog-title">Poznaj Betify<span class="mint">.</span></h2><p>Betify to demonstracyjna symulacja kasyna. Miejsce, w którym będziemy odkrywać klasyczne gry karciane, stołowe i autorskie gry instant.</p><div class="about-item">${icon('coin')}<div><strong>Wirtualna pula na start</strong><span>10 000 żetonów na start. W portfelu możesz zresetować saldo do tej wartości.</span></div></div><div class="about-item">${icon('heart')}<div><strong>Twoje lobby, Twoje ulubione</strong><span>Saldo i ulubione zapisujemy lokalnie. Bez konta i logowania.</span></div></div><div class="about-item">${icon('cards')}<div><strong>Blackjack już przy stole</strong><span>Zagraj przeciwko krupierowi. Kolejne gry dodamy w następnych aktualizacjach.</span></div></div><p class="about-note">Nie można wpłacać ani wypłacać pieniędzy. Żetony nie podlegają wymianie i nie mają wartości pieniężnej.</p><button class="button button-primary full-width" data-action="close-dialog">Wracam do lobby ${icon('arrow')}</button></div>`);
}

function route() {
  if (location.hash.startsWith('#game/')) {
    const id = location.hash.slice(6);
    if (games.some((game) => game.id === id)) location.replace(gameHref(id));
    else { history.replaceState(null, '', `${location.pathname}${location.search}#catalog`); toast('Ta gra nie istnieje w katalogu.'); if (dialog.open) dialog.close(); }
  } else if (dialog.open) dialog.close();
}
window.addEventListener('hashchange', route);
dialog.addEventListener('click', (event) => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
dialog.addEventListener('close', () => {
  if (location.hash.startsWith('#game/')) history.replaceState(null, '', `${location.pathname}${location.search}#catalog`);
  if (previousFocus?.isConnected) previousFocus.focus();
});

const mobileLayout = window.matchMedia('(max-width: 800px)');
function syncMenuAccessibility() {
  const open = document.body.classList.contains('menu-open');
  document.querySelector('#sidebar').inert = mobileLayout.matches && !open;
  document.querySelector('.page').inert = mobileLayout.matches && open;
}
function closeMenu(restoreFocus = false) {
  const wasOpen = document.body.classList.contains('menu-open');
  document.body.classList.remove('menu-open');
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', 'false');
  document.querySelector('.sidebar-overlay').hidden = true;
  syncMenuAccessibility();
  if (wasOpen && restoreFocus) document.querySelector('#menu-toggle').focus();
}
document.querySelector('#menu-toggle').addEventListener('click', () => {
  const open = document.body.classList.toggle('menu-open');
  document.querySelector('#menu-toggle').setAttribute('aria-expanded', String(open));
  document.querySelector('.sidebar-overlay').hidden = !open;
  syncMenuAccessibility();
  if (open) document.querySelector('.sidebar-close').focus();
});
document.querySelector('.sidebar-overlay').addEventListener('click', () => closeMenu(true));
document.querySelector('.sidebar-close').addEventListener('click', () => closeMenu(true));
mobileLayout.addEventListener('change', () => closeMenu());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu(true);
  if (event.key === 'Tab' && mobileLayout.matches && document.body.classList.contains('menu-open')) {
    const focusable = [...document.querySelector('#sidebar').querySelectorAll('button,a[href]')];
    const first = focusable[0]; const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  if (event.key === '/' && !dialog.open && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable) { event.preventDefault(); document.querySelector('#search').focus(); }
});
document.querySelector('#search').addEventListener('input', (event) => { view.query = event.target.value; renderGames(); });
document.querySelector('#sort').addEventListener('change', (event) => { view.sort = event.target.value; renderGames(); });

document.addEventListener('click', (event) => {
  const button = event.target.closest('button, a');
  if (!button) return;
  if (button.classList.contains('brand') || button.classList.contains('footer-brand')) {
    view.query = ''; document.querySelector('#search').value = ''; setCategory('all');
  }
  if (button.classList.contains('dialog-close')) { dialog.close(); return; }
  if (button.dataset.category) { setCategory(button.dataset.category, button.classList.contains('nav-item')); return; }
  if (button.dataset.favorite) {
    const id = button.dataset.favorite;
    const wasFavorite = player.getState().favorites.includes(id);
    player.toggleFavorite(id); renderGames();
    document.querySelector(`[data-favorite="${id}"]`)?.focus({ preventScroll: true });
    toast(wasFavorite ? 'Gra usunięta z ulubionych.' : 'Gra dodana do ulubionych.'); return;
  }
  if (button.dataset.game) { if (location.hash === `#game/${button.dataset.game}`) openGame(button.dataset.game); else location.hash = `game/${button.dataset.game}`; return; }
  switch (button.dataset.action) {
    case 'about': openAbout(); break;
    case 'wallet': openWallet(); break;
    case 'close-dialog': dialog.close(); break;
    case 'random': { const random = new Uint32Array(1); crypto.getRandomValues(random); openGame(games[random[0] % games.length].id); break; }
    case 'reset-balance': player.resetBalance(); toast('Saldo przywrócone do 10 000 żetonów.'); break;
    case 'favorite-current': {
      player.toggleFavorite(button.dataset.id); renderGames();
      button.querySelector('span').textContent = player.getState().favorites.includes(button.dataset.id) ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'; break;
    }
    case 'clear-filters': view.query = ''; document.querySelector('#search').value = ''; view.sort = 'recommended'; document.querySelector('#sort').value = 'recommended'; setCategory('all'); break;
  }
});

updatePlayer();
setCategory('all');
route();
