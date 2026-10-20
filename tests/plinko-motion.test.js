import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlinkoMotion, samplePlinkoMotion, plinkoSlotX, plinkoPeg, PLINKO_BOARD, PLINKO_GRAVITY } from '../src/games/instant/plinko-motion.js';

test('all 4096 Plinko paths animate into the engine-selected bucket without changing decisions', () => {
  for (let bits = 0; bits < 4096; bits++) {
    const path = Array.from({ length: 12 }, (_, row) => (bits >> row) & 1);
    const original = [...path];
    const plan = createPlinkoMotion(path, () => .5);
    const slot = path.reduce((sum, step) => sum + step, 0);
    assert.equal(plan.slot, slot);
    assert.deepEqual(samplePlinkoMotion(plan, plan.duration), { x: plinkoSlotX(slot), y: PLINKO_BOARD.landingY, peg: null, landed: true });
    assert.deepEqual(path, original);
    let rights = 0;
    for (let row = 0; row < 12; row++) {
      const segment = plan.segments[row + 1];
      const peg = plinkoPeg(row, rights + 1);
      assert.equal(segment.peg, `${row}-${rights + 1}`);
      assert.equal(segment.from.x, peg.x);
      assert.equal(segment.from.y, peg.y - PLINKO_BOARD.clearance);
      rights += path[row];
    }
  }
});

test('bounces rise from each contact, remain continuous and do not pass through the pegs', () => {
  for (const path of [Array(12).fill(0), Array(12).fill(1), Array.from({ length: 12 }, (_, i) => i % 2), Array.from({ length: 12 }, (_, i) => 1 - i % 2)]) {
    for (const variation of [0, 1]) {
      const plan = createPlinkoMotion(path, () => variation);
      for (const segment of plan.segments.slice(1)) {
        const justAfterImpact = samplePlinkoMotion(plan, segment.start + 1);
        assert.ok(justAfterImpact.y < segment.from.y, 'the collision must launch the ball upward');
        const end = samplePlinkoMotion(plan, segment.start + segment.duration);
        assert.ok(Math.abs(end.x - segment.to.x) < 1e-8);
        assert.ok(Math.abs(end.y - segment.to.y) < 1e-8);
        for (let step = 0; step <= 20; step++) {
          const ball = samplePlinkoMotion(plan, segment.start + segment.duration * step / 20);
          for (let row = 0; row < 12; row++) {
            for (let column = 0; column < row + 3; column++) {
              const peg = plinkoPeg(row, column);
              assert.ok(Math.hypot(ball.x - peg.x, ball.y - peg.y) >= PLINKO_BOARD.clearance - 1e-8, 'ball must stay outside every peg');
            }
          }
        }
      }
    }
  }
});

test('visual variation changes timing but preserves the landing, and invalid paths are rejected', () => {
  const path = Array.from({ length: 12 }, (_, i) => i % 2);
  const fast = createPlinkoMotion(path, () => 0);
  const slow = createPlinkoMotion(path, () => 1);
  assert.ok(slow.duration > fast.duration);
  assert.deepEqual(samplePlinkoMotion(fast, fast.duration), samplePlinkoMotion(slow, slow.duration));
  assert.deepEqual(samplePlinkoMotion(fast, -100), samplePlinkoMotion(fast, 0));
  assert.throws(() => createPlinkoMotion([]));
  assert.throws(() => createPlinkoMotion(Array(12).fill(2)));
});

test('every free flight has the same downward acceleration, including the final rebound', () => {
  const plan = createPlinkoMotion(Array.from({ length: 12 }, (_, i) => i % 2), () => .5);
  for (const flight of [...plan.segments, ...plan.settling]) {
    const interval = flight.duration / 10;
    const positions = [2, 3, 4].map((part) => samplePlinkoMotion(plan, flight.start + part * interval));
    const acceleration = (positions[2].y - 2 * positions[1].y + positions[0].y) / (interval / 1000) ** 2;
    assert.ok(Math.abs(acceleration - PLINKO_GRAVITY) < 1e-6);
    assert.ok(Math.abs(positions[2].x - 2 * positions[1].x + positions[0].x) < 1e-8, 'horizontal flight must not ease in or out');
  }
  const drop = plan.segments[0];
  assert.equal(drop.vy, 0);
  const middle = samplePlinkoMotion(plan, drop.duration / 2);
  assert.ok(Math.abs((middle.y - drop.from.y) / (drop.to.y - drop.from.y) - .25) < 1e-8, 'a release from rest covers only one quarter of the fall in half the time');
});

test('peg impacts dissipate kinetic energy and the final bounces decay into a stationary ball', () => {
  for (const variation of [0, .5, 1]) {
    const plan = createPlinkoMotion(Array.from({ length: 12 }, (_, i) => i % 2), () => variation);
    for (let index = 1; index < plan.segments.length; index++) {
      const incoming = plan.segments[index - 1];
      const outgoing = plan.segments[index];
      const incomingVy = incoming.vy + PLINKO_GRAVITY * incoming.duration / 1000;
      const retained = -outgoing.vy / incomingVy;
      assert.ok(retained >= .30 - 1e-10 && retained <= .40 + 1e-10);
      assert.ok(outgoing.vx ** 2 + outgoing.vy ** 2 < incoming.vx ** 2 + incomingVy ** 2);
    }
    let height = Infinity;
    for (const rebound of plan.settling) {
      const apex = samplePlinkoMotion(plan, rebound.start + rebound.duration / 2);
      const rise = PLINKO_BOARD.landingY - apex.y;
      assert.ok(rise > 0 && rise < height);
      assert.equal(apex.landed, true);
      height = rise;
    }
    assert.deepEqual(samplePlinkoMotion(plan, plan.settledAt + 50), samplePlinkoMotion(plan, plan.duration + 1000));
  }
});
