import { WHEEL } from './engine.js';

const unit = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;
const mod = (n, d) => ((n % d) + d) % d;
const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => n * n * (3 - 2 * n);

export function createSpinPlan(pocket, wheelStart = 0, ballStart = 0, random = unit, startRadius = 188) {
  if (!WHEEL.includes(pocket)) throw new Error('Invalid pocket');
  const direction = random() < .5 ? 1 : -1;
  const duration = 10000 + random() * 4500;
  const wheelEnd = wheelStart + direction * (360 * (4 + Math.floor(random() * 4)) + random() * 360);
  const power = 2.4 + random() * .9;
  const landAt = .84 + random() * .06;
  const dropAt = .58 + random() * .12;
  const pocketOffset = WHEEL.indexOf(pocket) * 360 / 37 + (random() - .5) * 3;
  const endRadius = 137 + random() * 5;
  const bounce = 4 + random() * 8;
  const frequency = 4 + Math.floor(random() * 4);
  const wheelAt = (t) => wheelStart + (wheelEnd - wheelStart) * (1 - (1 - t) ** power);
  const landingCenter = wheelAt(landAt) + pocketOffset;
  const ballDirection = -direction;
  const ballLanding = ballStart + ballDirection * (360 * (10 + Math.floor(random() * 8)) + mod(ballDirection * (landingCenter - ballStart), 360));
  return { duration, direction, wheelStart, wheelEnd, ballStart, ballLanding, pocketOffset, endRadius, power, landAt, dropAt, bounce, frequency, startRadius };
}

export function sampleSpin(plan, progress) {
  const t = clamp(progress);
  const wheelAngle = plan.wheelStart + (plan.wheelEnd - plan.wheelStart) * (1 - (1 - t) ** plan.power);
  const drop = clamp((t - plan.dropAt) / (plan.landAt - plan.dropAt));
  const captured = clamp((t - plan.landAt) / (1 - plan.landAt));
  const freeProgress = clamp(t / plan.landAt);
  let ballAngle = plan.ballStart + (plan.ballLanding - plan.ballStart) * (1 - (1 - freeProgress) ** 1.65);
  let radius = 188 - (188 - plan.endRadius) * smooth(drop);
  if (t < .08) radius = plan.startRadius + (188 - plan.startRadius) * smooth(t / .08);
  if (t < plan.landAt) {
    radius += Math.sin(drop * Math.PI * plan.frequency) * plan.bounce * Math.sin(drop * Math.PI);
    ballAngle += Math.sin(drop * Math.PI * plan.frequency) * 2 * Math.sin(drop * Math.PI);
  } else {
    const landingWheel = plan.wheelStart + (plan.wheelEnd - plan.wheelStart) * (1 - (1 - plan.landAt) ** plan.power);
    ballAngle = plan.ballLanding + wheelAngle - landingWheel;
    radius = plan.endRadius + Math.sin(captured * Math.PI * 5) * 2 * (1 - captured);
  }
  const radians = ballAngle * Math.PI / 180;
  return { wheelAngle, ballAngle, radius, x: 200 + Math.sin(radians) * radius, y: 200 - Math.cos(radians) * radius };
}
