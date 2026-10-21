export const BETTING_MS = 10000;
export const SPIN_MS = 5000;
export const ROUND_MS = BETTING_MS + SPIN_MS;

// One transition per advance: a throttled/background tab never replays a queue
// of past rounds or skips the player's next betting window.
export function createRouletteClock({ now = () => performance.now(), onSpin = () => {}, onBetting = () => {} } = {}) {
  let phase = 'betting';
  let startedAt = now();
  let deadline = startedAt + BETTING_MS;
  let round = 0;
  function getState() {
    const remainingMs = phase === 'closed' ? 0 : Math.max(0, deadline - now());
    return { phase, startedAt, deadline, remainingMs, seconds: Math.ceil(remainingMs / 1000), round };
  }
  function advance() {
    if (phase !== 'closed' && now() >= deadline) {
      startedAt = now();
      if (phase === 'betting') {
        phase = 'spinning'; deadline = startedAt + SPIN_MS; round++;
        onSpin(getState());
      } else {
        phase = 'betting'; deadline = startedAt + BETTING_MS;
        onBetting(getState());
      }
    }
    return getState();
  }
  return {
    getState, advance,
    canBet() { return advance().phase === 'betting'; },
    close() { phase = 'closed'; },
  };
}
