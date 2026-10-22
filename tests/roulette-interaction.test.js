import test from 'node:test';
import assert from 'node:assert/strict';
import { createBettingRack, CHIPS } from '../src/games/roulette/betting.js';
import { createSpinPlan, sampleSpin } from '../src/games/roulette/motion.js';
import { WHEEL } from '../src/games/roulette/engine.js';

test('stacks preserve denominations and right removal takes only the last chip on that field', () => {
  const rack = createBettingRack();
  rack.add('red', 100, 20000); rack.add('black', 500, 20000); rack.add('red', 5000, 20000);
  assert.deepEqual(rack.stack('red'), [100, 5000]);
  assert.deepEqual(rack.totals(), { red: 5100, black: 500 });
  assert.deepEqual(rack.remove('red'), { id: 'red', amount: 5000 });
  assert.deepEqual(rack.stack('red'), [100]);
  assert.deepEqual(rack.undo(), { id: 'black', amount: 500 });
  assert.deepEqual(rack.totals(), { red: 100 });
  assert.equal(rack.remove('number-36'), undefined);
});

test('repeat restores exact chip stacks, and an unaffordable repeat changes nothing', () => {
  const rack = createBettingRack();
  rack.add('number-0', 50, 20000); rack.add('number-0', 10000, 20000);
  const saved = rack.snapshot(); rack.clear(); rack.restore(saved, 20000);
  assert.deepEqual(rack.stack('number-0'), [50, 10000]);
  saved[0].amount = 5000;
  assert.deepEqual(rack.stack('number-0'), [50, 10000]);
  assert.throws(() => rack.restore(saved, 100));
  assert.deepEqual(rack.stack('number-0'), [50, 10000]);
});

test('5k and 10k chips can exceed the former round limit, with funds still enforced', () => {
  assert.ok(CHIPS.includes(5000) && CHIPS.includes(10000));
  const rack = createBettingRack();
  assert.throws(() => rack.add('red', 10000, 5000));
  assert.throws(() => rack.add('red', 123, 10000));
  assert.throws(() => rack.add('invalid', 10, 10000));
  for (let i = 0; i < 10; i++) rack.add('red', 10000, 200000);
  rack.add('red', 10, 200000);
  assert.deepEqual(rack.totals(), { red: 100010 });
  assert.throws(() => rack.add('red', 10000, 100010));
});

test('all-in adds only the uncommitted balance and preserves exact denominations for repeat', () => {
  const rack = createBettingRack();
  rack.add('red', 100, 10017);
  assert.equal(rack.allIn('number-7', 10017), 9917);
  assert.deepEqual(rack.totals(), { red: 100, 'number-7': 9917 });
  assert.ok(rack.stack('number-7').includes(5) && rack.stack('number-7').includes(1));
  const saved = rack.snapshot();
  rack.clear(); rack.restore(saved, 10017);
  assert.deepEqual(rack.snapshot(), saved);
  assert.throws(() => rack.allIn('black', 10017));
  assert.deepEqual(rack.snapshot(), saved);
  assert.equal(rack.remove('number-7').amount, 1);
  assert.equal(rack.allIn('black', 10017), 1);
  assert.deepEqual(rack.stack('black'), [1]);
});

test('all-in exceeds the former round limit and invalid inputs never change the table', () => {
  const rack = createBettingRack();
  rack.add('red', 100, 200000);
  const saved = rack.snapshot();
  for (const [id, balance] of [['bad', 10000], ['black', 0], ['black', 100.5]]) {
    assert.throws(() => rack.allIn(id, balance));
    assert.deepEqual(rack.snapshot(), saved);
  }
  assert.equal(rack.allIn('black', 200001), 199901);
  assert.deepEqual(rack.totals(), { red: 100, black: 199901 });
});

test('variable ball trajectories finish inside the correct moving wheel pocket in either direction', () => {
  for (const randomValue of [.1, .55, .93]) for (const pocket of WHEEL) {
    const plan = createSpinPlan(pocket, 1589, -4790, () => randomValue, 140);
    const end = sampleSpin(plan, 1);
    const relative = ((end.ballAngle - end.wheelAngle - WHEEL.indexOf(pocket) * 360 / 37 + 180) % 360 + 360) % 360 - 180;
    assert.ok(Math.abs(relative) < 1.51, `Pocket ${pocket} missed by ${relative}`);
    assert.equal(end.wheelAngle, plan.wheelEnd);
    assert.ok(plan.duration >= 10000 && plan.duration < 14500);
    assert.equal(Math.sign(plan.ballLanding - plan.ballStart), -plan.direction);
    for (let i = 0; i <= 100; i++) {
      const sample = sampleSpin(plan, i / 100);
      assert.ok(Number.isFinite(sample.x) && Number.isFinite(sample.y));
      assert.ok(sample.radius >= 125 && sample.radius <= 200);
    }
  }
});

test('successive spin plans vary duration, speed, drop and landing location', () => {
  const a = createSpinPlan(17, 0, 0, () => .2);
  const b = createSpinPlan(17, a.wheelEnd, a.ballLanding, () => .8);
  assert.notEqual(a.duration, b.duration);
  assert.notEqual(a.direction, b.direction);
  assert.notEqual(a.wheelEnd, b.wheelEnd);
  assert.notEqual(a.dropAt, b.dropAt);
  assert.notEqual(a.power, b.power);
  assert.ok(Math.abs(sampleSpin(a, a.landAt - .000001).ballAngle - sampleSpin(a, a.landAt + .000001).ballAngle) < .01);
});

test('five-second spins scale travel speed and reserve time for the pocket landing', () => {
  for (const randomValue of [.1, .55, .93]) {
    const normal = createSpinPlan(17, 0, 0, () => randomValue);
    const fast = createSpinPlan(17, 0, 0, () => randomValue, 140, 5000);
    assert.equal(fast.duration, 5000);
    assert.ok(Math.abs(fast.wheelEnd) < Math.abs(normal.wheelEnd));
    assert.ok(Math.abs(fast.ballLanding) < Math.abs(normal.ballLanding));
    assert.ok((1 - fast.landAt) * fast.duration >= 900);
    assert.ok((fast.landAt - fast.dropAt) * fast.duration >= 1000);
    const end = sampleSpin(fast, 1);
    const relative = ((end.ballAngle - end.wheelAngle - WHEEL.indexOf(17) * 360 / 37 + 180) % 360 + 360) % 360 - 180;
    assert.ok(Math.abs(relative) < 1.51);
  }
  for (const duration of [0, 500, NaN, Infinity]) assert.throws(() => createSpinPlan(17, 0, 0, () => .5, 140, duration));
});

test('capture matches angular and radial velocity without a snap at 30, 60 or 144 Hz', () => {
  for (const randomValue of [.1, .55, .93]) for (const pocket of WHEEL) {
    const plan = createSpinPlan(pocket, 1589, -4790, () => randomValue, 140, 5000);
    const epsilon = 1e-6;
    const before = sampleSpin(plan, plan.landAt - epsilon);
    const center = sampleSpin(plan, plan.landAt);
    const after = sampleSpin(plan, plan.landAt + epsilon);
    const angularBefore = (center.ballAngle - before.ballAngle) / epsilon;
    const angularAfter = (after.ballAngle - center.ballAngle) / epsilon;
    const radialBefore = (center.radius - before.radius) / epsilon;
    const radialAfter = (after.radius - center.radius) / epsilon;
    assert.ok(Math.abs(angularAfter - angularBefore) < .1, 'capture must preserve angular velocity');
    assert.ok(Math.abs(radialAfter - radialBefore) < .1, 'capture must preserve radial velocity');
    for (const fps of [30, 60, 144]) {
      const step = 1000 / fps / plan.duration;
      const penultimate = sampleSpin(plan, 1 - step);
      const end = sampleSpin(plan, 1);
      assert.ok(Math.hypot(end.x - penultimate.x, end.y - penultimate.y) < .1, 'the last frame must settle without snapping');
    }
  }
});
