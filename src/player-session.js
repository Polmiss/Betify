import { createPlayerStore } from './store.js';

export function browserPlayer() {
  const player = createPlayerStore({ getItem: (key) => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value) }, { syncBeforeWrite: true });
  window.addEventListener('storage', () => player.refresh());
  return player;
}
