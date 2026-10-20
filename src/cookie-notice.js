import './cookie-notice.css';

const NOTICE_KEY = 'betify:cookie-notice:v1';

export function mountCookieNotice() {
  function wasAcknowledged() {
    try { return localStorage.getItem(NOTICE_KEY) === '1'; }
    catch { return false; }
  }

  const notice = document.createElement('section');
  notice.className = 'cookie-notice';
  notice.setAttribute('aria-labelledby', 'cookie-notice-title');
  notice.hidden = wasAcknowledged();
  notice.innerHTML = `<div class="cookie-copy"><h2 id="cookie-notice-title">Cookies i pamięć lokalna</h2><p>Saldo i ulubione gry zapisujemy w tej przeglądarce (localStorage). Kod Betify nie ustawia własnych cookies reklamowych ani analitycznych.</p></div><div class="cookie-actions"><button type="button" class="cookie-secondary" data-cookie-details>Dowiedz się więcej</button><button type="button" class="cookie-primary" data-cookie-dismiss>Rozumiem</button></div>`;

  const details = document.createElement('dialog');
  details.className = 'cookie-details';
  details.setAttribute('aria-labelledby', 'cookie-details-title');
  details.innerHTML = `<h2 id="cookie-details-title">Co zapisuje Betify?</h2><p>Kod aplikacji nie ustawia własnych plików cookies i nie zawiera narzędzi reklamowych ani analitycznych. Korzysta z pamięci lokalnej przeglądarki:</p><dl><dt>Saldo i ulubione</dt><dd>Wpis <code>betify:player:v1</code> zachowuje wirtualne żetony i listę ulubionych gier między wizytami. Aplikacja nie wysyła jego zawartości na serwer.</dd><dt>Zamknięcie powiadomienia</dt><dd>Wpis <code>betify:cookie-notice:v1</code> zapamiętuje kliknięcie „Rozumiem”, aby nie pokazywać komunikatu przy każdym wejściu.</dd></dl><p>Oba wpisy pozostają do usunięcia danych witryny w ustawieniach przeglądarki. Reset salda nie usuwa tych danych. Gdy zapis jest zablokowany, dane pozostają tylko w bieżącej karcie.</p><p>Strona korzysta z hostingu GitHub Pages i pobiera czcionki z Google Fonts. Dostawcy mogą otrzymywać dane techniczne połączenia, np. adres IP.</p><p>„Rozumiem” zamyka informację. Nie zmienia ustawień zapisu ani nie włącza śledzenia.</p><nav aria-label="Dokumenty prywatności"><a href="https://github.com/Polmiss/Betify/blob/main/docs/polityka-cookies.md" target="_blank" rel="noopener noreferrer">Polityka cookies ↗</a><a href="https://github.com/Polmiss/Betify/blob/main/docs/polityka-prywatnosci.md" target="_blank" rel="noopener noreferrer">Polityka prywatności ↗</a></nav><button type="button" class="cookie-primary" data-cookie-close>Zamknij szczegóły</button>`;
  document.body.append(notice, details);

  let previousFocus;
  function showDetails() {
    previousFocus = document.activeElement;
    details.showModal();
  }
  document.querySelectorAll('[data-cookie-settings]').forEach((button) => button.addEventListener('click', showDetails));
  notice.querySelector('[data-cookie-details]').addEventListener('click', showDetails);
  details.querySelector('[data-cookie-close]').addEventListener('click', () => details.close());
  details.addEventListener('close', () => {
    if (previousFocus?.isConnected && !previousFocus.closest('[hidden]')) previousFocus.focus({ preventScroll: true });
  });
  notice.querySelector('[data-cookie-dismiss]').addEventListener('click', () => {
    try { localStorage.setItem(NOTICE_KEY, '1'); } catch { /* Closing still works when browser storage is blocked. */ }
    notice.hidden = true;
    document.querySelector('[data-cookie-settings]')?.focus({ preventScroll: true });
  });
  window.addEventListener('storage', (event) => {
    if (event.key === NOTICE_KEY || event.key === null) notice.hidden = wasAcknowledged();
  });
  window.addEventListener('pageshow', () => { if (wasAcknowledged()) notice.hidden = true; });
}
