import { samplePlinkoMotion } from './plinko-physics.js';
export { PLINKO_BOARD, plinkoPeg, plinkoSlotX } from './plinko-physics.js';

export function animatePlinko(svg, plan) {

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
    ball.setAttribute('transform', `translate(${position.x} ${position.y}) rotate(${position.angle * 180 / Math.PI})`);
    trail.forEach((dot, index) => {
      const previous = samplePlinkoMotion(plan, elapsed - (index + 1) * 22);
      dot.setAttribute('cx', previous.x);
      dot.setAttribute('cy', previous.y);
      dot.style.opacity = position.landed ? '0' : String((1 - index / trail.length) * .24);
    });
    // Catch up after a delayed frame without replaying a queue of animations.
    for (const segment of plan.impacts) {
      if (segment.peg && elapsed >= segment.t && !hit.has(segment.peg)) {
        hit.add(segment.peg);
        if (elapsed - segment.t < 180) svg.querySelector(`[data-peg="${segment.peg}"]`)?.classList.add('ig-peg-hit');
      }
    }
    if (position.landed && !landed) {
      landed = true;
      svg.querySelector(`[data-slot="${plan.slot}"][data-risk="${svg.dataset.risk}"]`)?.classList.add('ig-slot-impact');
    }
    if (elapsed < plan.duration) frame = requestAnimationFrame(tick);
    else finished(true);
  }
  frame = requestAnimationFrame(tick);
  return { finished: done, cancel() { cancelAnimationFrame(frame); finished(false); } };
}
