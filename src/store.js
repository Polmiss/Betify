import { games } from './catalog.js';

export const INITIAL_BALANCE = 10000;
export const MAX_BALANCE = 1000000000;
export const STORAGE_KEY = 'betify:player:v1';
const validIds = new Set(games.map((game) => game.id));

export function createPlayerStore(storage, { syncBeforeWrite = false } = {}) {
  let state = { balance: INITIAL_BALANCE, favorites: [] };
  let persistent = true;
  const listeners = new Set();
  try {
    const saved = JSON.parse(storage.getItem(STORAGE_KEY));
    if (saved && Number.isSafeInteger(saved.balance) && saved.balance >= 0 && saved.balance <= MAX_BALANCE) state.balance = saved.balance;
    if (Array.isArray(saved?.favorites)) state.favorites = [...new Set(saved.favorites.filter((id) => validIds.has(id)))];
  } catch { persistent = false; }

  function save() {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); persistent = true; }
    catch { persistent = false; }
    listeners.forEach((listener) => listener(getState()));
  }
  function getState() { return { balance: state.balance, favorites: [...state.favorites], persistent }; }
  function amountValid(amount) { return Number.isSafeInteger(amount) && amount > 0; }
  function refresh(notify = true) {
    if (!persistent && !notify) return;
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY));
      if (saved && Number.isSafeInteger(saved.balance) && saved.balance >= 0 && saved.balance <= MAX_BALANCE) {
        state.balance = saved.balance;
        state.favorites = Array.isArray(saved.favorites) ? [...new Set(saved.favorites.filter((id) => validIds.has(id)))] : [];
      }
    } catch { persistent = false; }
    if (notify) listeners.forEach((listener) => listener(getState()));
  }

  return {
    getState,
    refresh,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    credit(amount) {
      if (syncBeforeWrite) refresh(false);
      if (!amountValid(amount) || state.balance + amount > MAX_BALANCE) return false;
      state.balance += amount; save(); return true;
    },
    debit(amount) {
      if (syncBeforeWrite) refresh(false);
      if (!amountValid(amount) || amount > state.balance) return false;
      state.balance -= amount; save(); return true;
    },
    resetBalance() { if (syncBeforeWrite) refresh(false); state.balance = INITIAL_BALANCE; save(); },
    toggleFavorite(id) {
      if (syncBeforeWrite) refresh(false);
      if (!validIds.has(id)) return;
      state.favorites = state.favorites.includes(id) ? state.favorites.filter((item) => item !== id) : [...state.favorites, id];
      save();
    },
  };
}
