import { createBlackjack, handValue } from './blackjack-engine.js';
import './blackjack.css';

const number = new Intl.NumberFormat('pl-PL');
const outcomes = { blackjack: 'Blackjack! Idealne rozdanie.', win: 'Wygrywasz tę rundę!', push: 'Remis. Stawka wraca do Ciebie.', lose: 'Tym razem wygrywa krupier.', bust: 'Ponad 21. Wygrywa krupier.' };

export function mountBlackjack(root, player) {
  const game = createBlackjack(player);
  let selectedBet = 100;
  let error = '';
  let rounds = 0;
  let countedRound = false;
  const history = [];
  let busy = false;
  let disposed = false;
  let preview = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Map();
  const animations = new Set();

  function pause(ms) {
    if (disposed) return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => { pending.delete(timer); resolve(!disposed); }, reducedMotion.matches ? 0 : ms);
      pending.set(timer, resolve);
    });
  }

  root.innerHTML = `
    <section class="blackjack" aria-label="Stół do blackjacka">
      <header class="bj-header"><div><span class="eyebrow">BETIFY ORIGINALS · GRY KARCIANE</span><h2 id="dialog-title">Blackjack<span class="mint">.</span></h2><p>Twój ruch. Twoje dwadzieścia jeden.</p></div><span class="bj-table-number">STÓŁ<br><strong>01</strong></span></header>
      <div class="bj-table">
        <div class="bj-shoe" aria-hidden="true"><span>b♠</span><small>6 TALII</small></div>
        <div class="bj-seat"><div class="bj-hand-heading"><h3>Krupier</h3><span id="bj-dealer-score" class="bj-score"></span></div><div id="bj-dealer" class="bj-hand" aria-label="Karty krupiera"></div></div>
        <div class="bj-table-brand" aria-hidden="true"><span>♠</span><strong>BLACKJACK PAYS 3:2</strong><small>KRUPIER STOI NA 17 · 6 TALII</small></div>
        <div class="bj-seat"><div class="bj-hand-heading"><h3>Twoje karty</h3><span id="bj-player-score" class="bj-score"></span></div><div id="bj-player" class="bj-hand" aria-label="Twoje karty"></div></div>
        <div class="bj-result" role="status" aria-live="polite" aria-atomic="true"><strong id="bj-message"></strong><span id="bj-detail"></span></div>
      </div>
      <div class="bj-controls">
        <div class="bj-wallet"><span>Twoja pula<strong class="balance-value">${number.format(player.getState().balance)}</strong></span><span>Stawka w grze<strong id="bj-in-play">—</strong></span><span>Rozdania<strong id="bj-rounds">0</strong></span></div>
        <div id="bj-betting"><label class="bj-bet-label" for="bj-bet">STAWKA <span>10–5 000 żetonów · parzysta</span></label><div class="bj-bet-row"><input id="bj-bet" type="number" min="10" max="5000" step="2" value="100" inputmode="numeric" aria-describedby="bj-error"/><div class="bj-chips">${[10, 50, 100, 500].map((amount) => `<button type="button" data-bj-bet="${amount}" aria-pressed="${amount === 100}">${amount}</button>`).join('')}</div></div></div>
        <p id="bj-error" class="bj-error" role="alert"></p>
        <div class="bj-actions"><button class="button button-primary" id="bj-deal">Rozdaj karty <span aria-hidden="true">↗</span></button><button class="button button-primary" id="bj-hit">Dobierz <span aria-hidden="true">＋</span></button><button class="button button-secondary" id="bj-stand">Pasuj <span aria-hidden="true">✓</span></button><button class="button button-secondary" id="bj-double" title="Podwój stawkę i dobierz dokładnie jedną kartę">Podwój ×2</button></div>
        <div class="bj-history" aria-label="Ostatnie wyniki"><span>OSTATNIE RUNDY</span><div id="bj-history">Jeszcze wszystko przed Tobą.</div></div>
        <details class="bj-rules"><summary>Zasady stołu</summary><ul><li>As ma wartość 1 lub 11. Figury mają wartość 10.</li><li>Blackjack to as i karta o wartości 10 na starcie. Zysk: 3:2. Zwykła wygrana: 1:1. Remis zwraca stawkę.</li><li>Krupier dobiera do 16 i stoi na każdym 17, także miękkim.</li><li>Podwojenie tylko przy pierwszych dwóch kartach, jeśli wystarczy salda; potem jedna karta i pas.</li><li>Bez podziału par, ubezpieczenia i poddania. Karty tasujemy ponownie przed rundą, gdy w bucie zostaje mniej niż 60 kart.</li><li>Zamknięcie stołu automatycznie pasuje i rozlicza rundę. Odświeżenie strony podczas rundy oznacza utratę postawionych żetonów.</li></ul></details>
        <p class="bj-footnote">Wyłącznie wirtualne żetony · Bez wpłat i wypłat</p>
      </div>
    </section>`;

  const $ = (selector) => root.querySelector(selector);
  function face(card) {
    return card ? `<span>${card.rank}<small>${card.suit}</small></span><b>${card.suit}</b><span>${card.rank}<small>${card.suit}</small></span>` : '';
  }
  function syncHand(selector, hand, hidden = false) {
    const target = $(selector);
    const desired = [...hand, ...(hidden ? [null] : [])];
    target.querySelector('.bj-card-placeholder')?.remove();
    desired.forEach((card, index) => {
      let slot = target.children[index];
      const fresh = !slot;
      if (fresh) {
        slot = document.createElement('span');
        slot.className = 'bj-card-slot';
        slot.innerHTML = '<span class="bj-card-rotator" aria-hidden="true"><span class="bj-card bj-card-front"></span><span class="bj-card bj-card-back"><span>b♠</span></span></span>';
        target.append(slot);
      }
      const wasHidden = slot.classList.contains('is-face-down');
      const identity = card ? card.rank + card.suit : 'hidden';
      if (slot.dataset.card !== identity) {
        slot.dataset.card = identity;
        const front = slot.querySelector('.bj-card-front');
        front.innerHTML = face(card);
        front.classList.toggle('bj-card-red', !!card && ['♥', '♦'].includes(card.suit));
      }
      slot.setAttribute('aria-label', card ? `${card.rank} ${{ '♠': 'pik', '♥': 'kier', '♦': 'karo', '♣': 'trefl' }[card.suit]}` : 'Zakryta karta krupiera');
      slot.classList.toggle('is-face-down', !card);
      if (fresh && !reducedMotion.matches) {
        const source = $('.bj-shoe').getBoundingClientRect();
        const destination = slot.getBoundingClientRect();
        const motion = slot.animate([
          { opacity: 0, transform: `translate(${source.left - destination.left}px, ${source.top - destination.top}px) rotate(-28deg) scale(.72)` },
          { opacity: 1, transform: 'translate(0, 0) rotate(2deg) scale(1.02)', offset: .85 },
          { opacity: 1, transform: 'none' },
        ], { duration: 460, easing: 'cubic-bezier(.18,.75,.25,1)' });
        animations.add(motion);
        motion.finished.catch(() => {}).finally(() => animations.delete(motion));
      }
      if (!fresh && wasHidden && card) slot.classList.add('bj-revealed');
    });
    if (!desired.length) target.innerHTML = '<span class="bj-card-placeholder" aria-label="Miejsce na karty">♠</span>';
  }
  function render() {
    const state = preview || game.getState();
    const playing = state.phase === 'playing';
    const finished = state.phase === 'finished';
    const active = busy || playing || ['dealing', 'dealer'].includes(state.phase);
    if (finished && !countedRound) {
      countedRound = true; rounds++;
      history.unshift(state.payout - state.bet); history.splice(5);
    }
    syncHand('#bj-dealer', state.dealer, state.hidden);
    syncHand('#bj-player', state.player);
    const score = (hand) => { const { total, soft } = handValue(hand); return hand.length ? `${total}${soft && total <= 21 ? ' / miękkie' : ''}` : '—'; };
    $('#bj-dealer-score').textContent = state.hidden && state.dealer.length ? `${handValue(state.dealer).total} + ?` : score(state.dealer);
    $('#bj-player-score').textContent = score(state.player);
    $('#bj-message').textContent = state.phase === 'dealing' ? 'Rozdawanie kart…' : state.phase === 'dealer' ? 'Ruch krupiera…' : busy && !finished ? 'Karta w drodze…' : finished ? outcomes[state.outcome] : playing ? 'Dobierasz czy pasujesz?' : 'Zajmij miejsce przy stole.';
    const net = state.payout - state.bet;
    $('#bj-detail').textContent = finished ? `Bilans rundy: ${net > 0 ? '+' : ''}${number.format(net)} żetonów${state.payout ? ` · Zwrot łącznie: ${number.format(state.payout)}` : ''}` : state.phase === 'dealing' ? 'Karty trafiają kolejno do Ciebie i krupiera.' : state.phase === 'dealer' ? 'Krupier odkrywa kartę i dobiera do co najmniej 17.' : playing ? 'Zbliż się do 21. Nie przekraczaj granicy.' : 'Wybierz stawkę i rozdaj pierwsze karty.';
    $('.bj-result').dataset.result = finished ? state.outcome : '';
    $('#bj-in-play').textContent = active ? number.format(state.bet) : '—';
    $('#bj-rounds').textContent = rounds;
    $('#bj-betting').hidden = active;
    $('#bj-deal').hidden = active;
    $('#bj-deal').textContent = finished ? 'Następne rozdanie ↗' : 'Rozdaj karty ↗';
    for (const id of ['hit', 'stand', 'double']) {
      $(`#bj-${id}`).hidden = !active;
      $(`#bj-${id}`).disabled = busy || !playing || (id === 'double' && !state.canDouble);
    }
    $('.bj-table').setAttribute('aria-busy', String(busy));
    $('.blackjack').classList.toggle('bj-busy', busy);
    $('#bj-error').textContent = error;
    $('#bj-history').innerHTML = history.length ? history.map((net) => `<span class="bj-history-result ${net > 0 ? 'positive' : net < 0 ? 'negative' : ''}">${net > 0 ? '+' : ''}${number.format(net)}</span>`).join('') : 'Jeszcze wszystko przed Tobą.';
  }
  async function playDealer() {
    if (disposed) return;
    const state = game.getState();
    // Reveal the hole card first, then deal each extra card separately.
    if (state.phase === 'finished') preview = { ...state, phase: 'dealer', outcome: null };
    render();
    if (!(await pause(state.phase === 'dealer' ? 700 : 500))) return;
    preview = null;
    while (!disposed && game.getState().phase === 'dealer') {
      game.dealerStep(); render();
      if (!(await pause(650))) return;
    }
    if (!disposed) render();
  }

  async function onClick(event) {
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || disposed || busy) return;
    if (button.dataset.bjBet) {
      selectedBet = Number(button.dataset.bjBet); $('#bj-bet').value = selectedBet;
      root.querySelectorAll('[data-bj-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.bjBet) === selectedBet)));
      error = ''; render(); return;
    }
    error = '';
    if (!['bj-deal', 'bj-hit', 'bj-stand', 'bj-double'].includes(button.id)) return;
    busy = true;
    try {
      if (button.id === 'bj-deal') {
        selectedBet = Number($('#bj-bet').value);
        error = game.start(selectedBet, { deferOpening: true }) || '';
        if (!error) {
          countedRound = false;
          $('#bj-player').replaceChildren(); $('#bj-dealer').replaceChildren();
          const dealt = game.getState();
          // The actual order is player, dealer, player, dealer face down.
          for (const [playerCount, dealerCount, hidden] of [[1, 0, false], [1, 1, false], [2, 1, false], [2, 1, true]]) {
            preview = { ...dealt, player: dealt.player.slice(0, playerCount), dealer: dealt.dealer.slice(0, dealerCount), hidden };
            render();
            if (!(await pause(510))) return;
          }
          preview = null;
          game.resolveOpening(); render();
          if (game.getState().phase === 'finished') await playDealer();
        }
      } else if (button.id === 'bj-stand') {
        game.beginStand(); await playDealer();
      } else {
        // Hold the old dealer hand until the player's new card has landed.
        const before = game.getState();
        if (button.id === 'bj-hit') game.hit({ deferDealer: true });
        else game.double({ deferDealer: true });
        const after = game.getState();
        preview = { ...after, dealer: before.dealer, hidden: true, phase: 'playing', outcome: null };
        render();
        if (!(await pause(520))) return;
        preview = null;
        if (after.phase !== 'playing') await playDealer();
      }
    } finally {
      busy = false;
      if (!disposed) {
        preview = null; render();
        if (error) $('#bj-bet').focus({ preventScroll: true });
        else (game.getState().phase === 'playing' ? $('#bj-hit') : $('#bj-deal')).focus({ preventScroll: true });
      }
    }
  }
  root.addEventListener('click', onClick);
  function onBetInput() {
    selectedBet = Number($('#bj-bet').value);
    root.querySelectorAll('[data-bj-bet]').forEach((chip) => chip.setAttribute('aria-pressed', String(Number(chip.dataset.bjBet) === selectedBet)));
    error = ''; $('#bj-error').textContent = '';
  }
  $('#bj-bet').addEventListener('input', onBetInput);
  render();
  return () => {
    disposed = true;
    for (const [timer, resolve] of pending) { clearTimeout(timer); resolve(false); }
    pending.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
    game.stand();
    root.removeEventListener('click', onClick);
    $('#bj-bet').removeEventListener('input', onBetInput);
  };
}
