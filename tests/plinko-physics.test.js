import test from 'node:test';
import assert from 'node:assert/strict';
import { simulatePlinko, samplePlinkoMotion, plinkoGeometry, PLINKO_BOARD, PLINKO_GRAVITY } from '../src/games/instant/plinko-physics.js';

test('all board sizes settle naturally into an actually reached bucket over 3000 releases', () => {
  for (const rows of [8, 12, 16]) {
    const geometry = plinkoGeometry(rows);
    const counts = Array(rows + 1).fill(0);
    for (let seed = 0; seed < 1000; seed++) {
      const flight = simulatePlinko(seed, rows);
      const last = flight.frames.at(-1);
      assert.equal(flight.slot, Math.floor((last.x - geometry.left) / geometry.slotWidth));
      assert.equal(last.y, PLINKO_BOARD.landingY);
      assert.equal(flight.landingX, last.x);
      assert.ok(last.x >= geometry.left + flight.slot * geometry.slotWidth + PLINKO_BOARD.ballRadius - 1e-8);
      assert.ok(last.x <= geometry.left + (flight.slot + 1) * geometry.slotWidth - PLINKO_BOARD.ballRadius + 1e-8);
      assert.ok(flight.settledAt < 15000);
      assert.ok(flight.impacts.length > 0);
      counts[flight.slot]++;
    }
    assert.ok(counts.every((count) => count > 0), 'the physical board must allow every bucket');
    assert.ok(counts[Math.floor(rows / 2)] > counts[0] && counts[Math.floor(rows / 2)] > counts.at(-1));
  }
});

test('release is free fall from rest with constant gravity, not an eased animation', () => {
  const flight = simulatePlinko(42);
  const first = flight.frames[0];
  for (const frame of flight.frames.filter((frame) => frame.t < flight.impacts[0].t)) {
    const seconds = frame.t / 1000;
    assert.ok(Math.abs(frame.y - first.y - .5 * PLINKO_GRAVITY * seconds ** 2) < 1e-7);
  }
});

test('peg impacts lose kinetic energy, and trajectories do not snap to bucket centers', () => {
  let offCenter = 0;
  for (let seed = 0; seed < 120; seed++) {
    const flight = simulatePlinko(seed);
    for (const hit of flight.impacts) assert.ok(hit.energyAfter <= hit.energyBefore + 1e-6);
    for (let index = 1; index < flight.frames.length; index++) {
      const from = flight.frames[index - 1];
      const to = flight.frames[index];
      assert.ok(to.t > from.t);
      assert.ok(Math.hypot(to.x - from.x, to.y - from.y) < 30, 'no artificial repositioning between rows');
    }
    const { slotWidth, left } = plinkoGeometry();
    if (Math.abs(flight.landingX - (left + (flight.slot + .5) * slotWidth)) > 1) offCenter++;
  }
  assert.ok(offCenter > 100, 'the ball stays where physics brought it, rather than moving to a target');
});

test('seeded physics is reproducible and sampling stops at its real resting position', () => {
  const flight = simulatePlinko(2026, 16);
  assert.deepEqual(flight, simulatePlinko(2026, 16));
  assert.notDeepEqual(flight.frames, simulatePlinko(2027, 16).frames);
  const last = flight.frames.at(-1);
  assert.deepEqual(samplePlinkoMotion(flight, flight.duration + 1000), { x: last.x, y: last.y, angle: last.angle, landed: true });
  assert.equal(samplePlinkoMotion(flight, flight.landingAt - 1).landed, false);
  assert.equal(samplePlinkoMotion(flight, flight.landingAt).landed, true);
  assert.throws(() => simulatePlinko(-1));
  assert.throws(() => simulatePlinko(0, 10));
});
