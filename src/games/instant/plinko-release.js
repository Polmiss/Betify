import { PLINKO_DISTRIBUTION } from './plinko-distribution.js';
import { simulatePlinko } from './plinko-physics.js';

export const PLINKO_RELEASE_COUNT = PLINKO_DISTRIBUTION.poolSize * 2;

// Each entry and its physical mirror are equally likely. The full space is
// enumerated in the calibration, so payout probabilities are known exactly.
export function plinkoFlight(release, rows = 12) {
  if (!Number.isInteger(release) || release < 0 || release >= PLINKO_RELEASE_COUNT) throw new Error('Nieprawidłowy zrzut Plinko.');
  const plan = simulatePlinko(release % PLINKO_DISTRIBUTION.poolSize, rows);
  if (release < PLINKO_DISTRIBUTION.poolSize) return plan;
  return { ...plan, mirrored: true, slot: rows - plan.slot, landingX: 640 - plan.landingX,
    frames: plan.frames.map((frame) => ({ ...frame, x: 640 - frame.x, angle: -frame.angle })),
    impacts: plan.impacts.map((impact) => {
      const [row, column] = impact.peg.split('-').map(Number);
      return { ...impact, x: 640 - impact.x, peg: `${row}-${row + 2 - column}` };
    }) };
}
