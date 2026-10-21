export const TARGET_RTP = 0.99;
export const RTP_LABEL = 'RTP 99%';
export const ROUNDING_RULE = 'Ułamkową wypłatę zaokrąglamy losowo do sąsiednich całych żetonów, zachowując jej wartość oczekiwaną (np. 12,75: 75% na 13 i 25% na 12).';
export const RTP_RULE = 'RTP 99% to teoretyczny średni zwrot w długim okresie, a nie gwarancja wyniku sesji. Anulowane rundy bez ruchu nie wchodzą do RTP.';

// Rejection sampling is shared by outcomes and the independent rounding draw.
export function uniformInteger(size, random = globalThis.crypto) {
  if (!Number.isSafeInteger(size) || size < 1 || size > 2 ** 32) throw new Error('Nieprawidłowy zakres losowania.');
  const sample = new Uint32Array(1);
  const cutoff = 2 ** 32 - (2 ** 32 % size);
  do { random.getRandomValues(sample); } while (sample[0] >= cutoff);
  return sample[0] % size;
}

export function payoutBounds(value) {
  if (!Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) throw new Error('Nieprawidłowa wypłata.');
  const nearest = Math.round(value);
  const stable = Math.abs(value - nearest) < 1e-8 ? nearest : value;
  return { low: Math.floor(stable), high: Math.ceil(stable), expected: stable };
}

// Never floor every payout: that would lower RTP, especially at small stakes.
export function roundPayout(value, draw = () => uniformInteger(2 ** 32) / 2 ** 32) {
  const { low, high, expected } = payoutBounds(value);
  if (low === high) return low;
  const unit = draw();
  if (!Number.isFinite(unit) || unit < 0 || unit >= 1) throw new Error('Nieprawidłowe losowanie wypłaty.');
  return low + (unit < expected - low ? 1 : 0);
}

export function payoutLabel(value) {
  const { low, high } = payoutBounds(value);
  const format = new Intl.NumberFormat('pl-PL');
  return low === high ? format.format(low) : `${format.format(low)}–${format.format(high)}`;
}
