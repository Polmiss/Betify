export function showGameHelp(title, pages, onClose = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.className = 'game-help';
  dialog.setAttribute('aria-labelledby', 'game-help-title');
  dialog.innerHTML = `<header><h2 id="game-help-title"></h2><button aria-label="Zamknij zasady">×</button></header><div class="game-help-page"></div><nav aria-label="Strony zasad"><button data-help-prev>← Wstecz</button><span role="status"></span><button data-help-next>Dalej →</button></nav>`;
  document.body.append(dialog);
  dialog.querySelector('h2').textContent = title;
  let page = 0;
  function render() {
    dialog.querySelector('.game-help-page').innerHTML = pages[page] || '';
    dialog.querySelector('nav span').textContent = `${page + 1} / ${pages.length}`;
    dialog.querySelector('[data-help-prev]').disabled = page === 0;
    dialog.querySelector('[data-help-next]').disabled = page >= pages.length - 1;
  }
  dialog.querySelector('header button').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-help-prev]').addEventListener('click', () => { page--; render(); });
  dialog.querySelector('[data-help-next]').addEventListener('click', () => { page++; render(); });
  dialog.addEventListener('close', () => { dialog.remove(); onClose(); }, { once: true });
  render(); dialog.showModal();
  return () => { if (dialog.open) dialog.close(); };
}
