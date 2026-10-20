import { PLINKO_ROWS } from './engine.js';

export const PLINKO_BOARD = { width: 640, height: 452, center: 320, step: 21, rowGap: 26, top: 66, clearance: 10, landingY: 389 };
export const plinkoSlotX = (slot) => PLINKO_BOARD.center + (2 * slot - PLINKO_ROWS) * PLINKO_BOARD.step;
export const plinkoPeg = (row, column) => ({ x: PLINKO_BOARD.center + (2 * column - row - 2) * PLINKO_BOARD.step, y: PLINKO_BOARD.top + row * PLINKO_BOARD.rowGap });
// SVG units per second squared; the same acceleration applies to every free flight.
export const PLINKO_GRAVITY = 2400;

// Visual variation only: the engine's twelve decisions remain the sole source of the result.
export function createPlinkoMotion(path, random = Math.random) {
  if (path.length !== PLINKO_ROWS || path.some((step) => step !== 0 && step !== 1)) throw new Error('Invalid Plinko path');
  const segments = [];
  let time = 0;
  let rights = 0;
  let from = { x: 320, y: 15 };
  let impactVelocity = 0;
  function addFlight(to, vy, peg = null, restitution = null) {
    const seconds = (Math.sqrt(vy * vy + 2 * PLINKO_GRAVITY * (to.y - from.y)) - vy) / PLINKO_GRAVITY;
    const duration = seconds * 1000;
    const vx = (to.x - from.x) / seconds;
    segments.push({ from, to, start: time, duration, vx, vy, peg, restitution });
    time += duration;
    impactVelocity = vy + PLINKO_GRAVITY * seconds;
    from = to;
  }
  addFlight({ x: PLINKO_BOARD.center, y: PLINKO_BOARD.top - PLINKO_BOARD.clearance }, 0);
  path.forEach((step, row) => {
    const peg = `${row}-${rights + 1}`;
    rights += step;
    const last = row === PLINKO_ROWS - 1;
    const restitution = .30 + random() * .10;
    // Retain only part of the incoming vertical speed at contact. Flight time
    // follows from gravity and the next contact height, rather than a chosen duration.
    addFlight({ x: PLINKO_BOARD.center + (2 * rights - row - 1) * PLINKO_BOARD.step,
      y: last ? PLINKO_BOARD.landingY : PLINKO_BOARD.top - PLINKO_BOARD.clearance + (row + 1) * PLINKO_BOARD.rowGap },
    -impactVelocity * restitution, peg, restitution);
  });
  const landingAt = time;
  const settling = [];
  let reboundSpeed = impactVelocity * .22;
  // Each floor impact loses energy too; stop once the remaining rise is subpixel.
  while (reboundSpeed * reboundSpeed / (2 * PLINKO_GRAVITY) >= .12) {
    const duration = 2 * reboundSpeed / PLINKO_GRAVITY * 1000;
    settling.push({ from, to: from, start: time, duration, vx: 0, vy: -reboundSpeed, peg: null });
    time += duration;
    reboundSpeed *= .22;
  }
  return { segments, settling, landingAt, settledAt: time, duration: Math.max(time, landingAt + 360), slot: rights };
}

export function samplePlinkoMotion(plan, elapsed) {
  const time = Math.max(0, elapsed);
  const segment = plan.segments.find((part) => time < part.start + part.duration)
    || plan.settling.find((part) => time < part.start + part.duration);
  if (!segment) {
    return { x: plinkoSlotX(plan.slot), y: PLINKO_BOARD.landingY, peg: null, landed: true };
  }
  const seconds = (time - segment.start) / 1000;
  return { x: segment.from.x + segment.vx * seconds,
    y: segment.from.y + segment.vy * seconds + .5 * PLINKO_GRAVITY * seconds * seconds,
    peg: segment.peg, landed: time >= plan.landingAt };
}

export function animatePlinko(svg, path) {
  const plan = createPlinkoMotion(path);
  const ball = svg.querySelector('.ig-ball');
  const trail = [...svg.querySelectorAll('.ig-ball-trail circle')];
  const hit = new Set();
  let frame;
  let start;
  let finished;
  let landed = false;
  const done = new Promise((resolve) => { finished = resolve; });
  function tick(now) {
    start ??= now;
    const elapsed = now - start;
    const position = samplePlinkoMotion(plan, elapsed);
    ball.setAttribute('transform', `translate(${position.x} ${position.y})`);
    trail.forEach((dot, index) => {
      const previous = samplePlinkoMotion(plan, elapsed - (index + 1) * 22);
      dot.setAttribute('cx', previous.x);
      dot.setAttribute('cy', previous.y);
      dot.style.opacity = position.landed ? '0' : String((1 - index / trail.length) * .24);
    });
    // Catch up after a delayed frame without replaying a queue of animations.
    for (const segment of plan.segments) {
      if (segment.peg && elapsed >= segment.start && !hit.has(segment.peg)) {
        hit.add(segment.peg);
        if (elapsed - segment.start < 180) svg.querySelector(`[data-peg="${segment.peg}"]`)?.classList.add('ig-peg-hit');
      }
    }
    if (position.landed && !landed) {
      landed = true;
      svg.querySelector(`[data-slot="${plan.slot}"]`)?.classList.add('ig-slot-impact');
    }
    if (elapsed < plan.duration) frame = requestAnimationFrame(tick);
    else finished(true);
  }
  frame = requestAnimationFrame(tick);
  return { finished: done, cancel() { cancelAnimationFrame(frame); finished(false); } };
}
