import { PLINKO_ROWS } from './engine.js';

export const PLINKO_BOARD = { width: 640, height: 452, center: 320, step: 21, rowGap: 26, top: 66, clearance: 10, landingY: 389 };
export const plinkoSlotX = (slot) => PLINKO_BOARD.center + (2 * slot - PLINKO_ROWS) * PLINKO_BOARD.step;
export const plinkoPeg = (row, column) => ({ x: PLINKO_BOARD.center + (2 * column - row - 2) * PLINKO_BOARD.step, y: PLINKO_BOARD.top + row * PLINKO_BOARD.rowGap });

// Visual variation only: the engine's twelve decisions remain the sole source of the result.
export function createPlinkoMotion(path, random = Math.random) {
  if (path.length !== PLINKO_ROWS || path.some((step) => step !== 0 && step !== 1)) throw new Error('Invalid Plinko path');
  const segments = [];
  let time = 0;
  let rights = 0;
  let from = { x: 320, y: 15 };
  function add(to, duration, kick, peg = null) {
    segments.push({ from, to, start: time, duration, kick, peg });
    time += duration;
    from = to;
  }
  add({ x: 320, y: 56 }, 280, 0);
  path.forEach((step, row) => {
    const peg = `${row}-${rights + 1}`;
    rights += step;
    const last = row === PLINKO_ROWS - 1;
    add({ x: 320 + (2 * rights - row - 1) * 21, y: last ? PLINKO_BOARD.landingY : 56 + (row + 1) * 26 },
      (last ? 260 : 145) + random() * 35, (last ? 40 : 34) + random() * 8, peg);
  });
  const landingAt = time;
  return { segments, landingAt, duration: time + 360, slot: rights };
}

export function samplePlinkoMotion(plan, elapsed) {
  const time = Math.max(0, elapsed);
  const segment = plan.segments.find((part) => time < part.start + part.duration);
  if (!segment) {
    const t = Math.min(1, (time - plan.landingAt) / 360);
    return { x: plinkoSlotX(plan.slot), y: PLINKO_BOARD.landingY - Math.sin(t * Math.PI * 2) ** 2 * 5 * (1 - t), peg: null, landed: true };
  }
  const t = (time - segment.start) / segment.duration;
  return { x: segment.from.x + (segment.to.x - segment.from.x) * t,
    y: segment.from.y - segment.kick * t + (segment.to.y - segment.from.y + segment.kick) * t * t,
    peg: segment.peg, landed: false };
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
