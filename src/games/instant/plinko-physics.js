export const PLINKO_ROWS = 12;
export const PLINKO_ROWS_OPTIONS = [8, 12, 16];
export const PLINKO_GRAVITY = 1800;
export const PLINKO_BOARD = { width: 640, height: 500, center: 320, top: 66, landingY: 389, ballRadius: 6.4, pegRadius: 3.6 };
export function plinkoGeometry(rows = PLINKO_ROWS) {
  if (!PLINKO_ROWS_OPTIONS.includes(rows)) throw new Error('Nieprawidłowa liczba rzędów.');
  return { rows, left: 47, right: 593, slotWidth: 546 / (rows + 1), step: 273 / (rows + 1), rowGap: 286 / (rows - 1) };
}
export const plinkoSlotX = (slot, rows = PLINKO_ROWS) => 47 + (slot + .5) * plinkoGeometry(rows).slotWidth;
export function plinkoPeg(row, column, rows = PLINKO_ROWS) {
  const { step, rowGap } = plinkoGeometry(rows);
  return { x: 320 + (2 * column - row - 2) * step, y: 66 + row * rowGap };
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let n = Math.imul(value ^ value >>> 15, 1 | value);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

// Fixed 240 Hz rigid-circle simulation. Randomness sets the release only;
// every subsequent direction is produced by collision normals and momentum.
export function simulatePlinko(seed, rows = PLINKO_ROWS) {
  if (!Number.isInteger(seed) || seed < 0 || seed >= 2 ** 32) throw new Error('Nieprawidłowe ziarno Plinko.');
  const geometry = plinkoGeometry(rows);
  const random = seededRandom(seed);
  const pegs = Array.from({ length: rows }, (_, row) => Array.from({ length: row + 3 }, (_, column) => ({ ...plinkoPeg(row, column, rows), id: `${row}-${column}` }))).flat();
  const radius = PLINKO_BOARD.ballRadius;
  const contactRadius = radius + PLINKO_BOARD.pegRadius;
  const dt = 1 / 240;
  const restitution = .52;
  let x = 320 + (random() - .5) * 8;
  let y = 15;
  let vx = (random() - .5) * 10;
  let vy = 0;
  let spin = (random() - .5) * 4;
  let angle = 0;
  let landingAt = null;
  let slot = null;
  let settledAt;
  const impacts = [];
  const frames = [{ t: 0, x, y, angle }];
  const lastHit = new Map();
  for (let step = 1; step <= 240 * 15; step++) {
    const t = step * dt * 1000;
    x += vx * dt;
    y += vy * dt + .5 * PLINKO_GRAVITY * dt * dt;
    vy += PLINKO_GRAVITY * dt;
    angle += spin * dt;
    let impact = false;
    for (const peg of pegs) {
      const dx = x - peg.x;
      const dy = y - peg.y;
      if (Math.abs(dx) >= contactRadius || Math.abs(dy) >= contactRadius) continue;
      const distance = Math.hypot(dx, dy);
      if (distance >= contactRadius) continue;
      const nx = distance > 1e-8 ? dx / distance : 0;
      const ny = distance > 1e-8 ? dy / distance : -1;
      x = peg.x + nx * (contactRadius + .001);
      y = peg.y + ny * (contactRadius + .001);
      const normalSpeed = vx * nx + vy * ny;
      if (normalSpeed >= 0) continue;
      const energyBefore = vx * vx + vy * vy + .4 * (spin * radius) ** 2;
      const impulse = -(1 + restitution) * normalSpeed;
      vx += impulse * nx;
      vy += impulse * ny;
      const tx = -ny;
      const ty = nx;
      const tangentSpeed = vx * tx + vy * ty - spin * radius;
      const friction = Math.max(-.08 * impulse, Math.min(.08 * impulse, -tangentSpeed / 3.5));
      vx += friction * tx;
      vy += friction * ty;
      spin -= friction / (.4 * radius);
      if (t - (lastHit.get(peg.id) ?? -1000) > 70) {
        impacts.push({ t, peg: peg.id, x: peg.x, y: peg.y, energyBefore, energyAfter: vx * vx + vy * vy + .4 * (spin * radius) ** 2 });
        lastHit.set(peg.id, t);
      }
      impact = true;
    }
    if (slot === null && y < 374) {
      const bottomLeft = 47 - 14;
      const slope = y <= 352 ? -geometry.step / geometry.rowGap : (47 - bottomLeft) / 22;
      const leftRail = y <= 352 ? 320 - 2 * geometry.step - 14 + (Math.max(66, y) - 66) * slope : bottomLeft + (y - 352) * slope;
      const length = Math.hypot(1, slope);
      for (const side of [-1, 1]) {
        const nx = -side / length;
        const ny = -slope / length;
        const wall = side < 0 ? leftRail : 640 - leftRail;
        const distance = (side < 0 ? x - wall : wall - x) / length;
        if (distance < radius) {
          x += nx * (radius - distance);
          y += ny * (radius - distance);
          const normalSpeed = vx * nx + vy * ny;
          if (normalSpeed < 0) { vx -= 1.45 * normalSpeed * nx; vy -= 1.45 * normalSpeed * ny; }
        }
      }
    } else {
      const left = slot === null ? geometry.left : geometry.left + slot * geometry.slotWidth;
      const right = slot === null ? geometry.right : left + geometry.slotWidth;
      if (x < left + radius) { x = left + radius; vx = Math.abs(vx) * .45; }
      if (x > right - radius) { x = right - radius; vx = -Math.abs(vx) * .45; }
    }
    // Dividers keep the landing tied to the bucket actually entered.
    if (slot === null && y > 374) {
      for (let divider = 1; divider <= rows; divider++) {
        const edge = geometry.left + divider * geometry.slotWidth;
        if (Math.abs(x - edge) < radius + 1) {
          const side = x < edge ? -1 : 1;
          x = edge + side * (radius + 1);
          if (vx * side < 0) vx = -vx * .45;
        }
      }
    }
    if (y >= PLINKO_BOARD.landingY && vy > 0) {
      y = PLINKO_BOARD.landingY;
      if (slot === null) {
        slot = Math.max(0, Math.min(rows, Math.floor((x - geometry.left) / geometry.slotWidth)));
        landingAt = t;
      }
      vy = -vy * .22;
      vx *= .55;
      spin *= .55;
      if (Math.abs(vy) < 16) {
        vy = 0; vx = 0; spin = 0;
        settledAt = t;
      }
      impact = true;
    }
    if (step % 4 === 0 || impact || settledAt !== undefined) frames.push({ t, x, y, angle });
    if (settledAt !== undefined) break;
  }
  if (slot === null || settledAt === undefined) throw new Error('Nie udało się ukończyć spadania kulki. Spróbuj ponownie.');
  return { seed, rows, frames, impacts, slot, landingAt, settledAt, duration: Math.max(settledAt, landingAt + 360), landingX: x };
}

export function samplePlinkoMotion(plan, elapsed) {
  const time = Math.max(0, elapsed);
  let low = 0;
  let high = plan.frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (plan.frames[middle].t <= time) low = middle;
    else high = middle - 1;
  }
  const from = plan.frames[low];
  const to = plan.frames[low + 1] || from;
  const fraction = to.t === from.t ? 0 : Math.min(1, (time - from.t) / (to.t - from.t));
  return { x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction,
    angle: from.angle + (to.angle - from.angle) * fraction, landed: time >= plan.landingAt };
}
