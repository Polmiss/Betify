import { plinkoGeometry, plinkoPeg, plinkoSlotX, PLINKO_BOARD } from './plinko-physics.js';
import { plinkoPaytable } from './plinko-tables.js';
export const riskNames = { low: 'Niskie', medium: 'Średnie', high: 'Wysokie' };
const number = (value) => value.toLocaleString('pl-PL', { maximumFractionDigits: 1 });

export function plinkoBoard(rows) {
  const { slotWidth, step } = plinkoGeometry(rows);
  const pegs = Array.from({ length: rows }, (_, row) => Array.from({ length: row + 3 }, (_, column) => {
    const { x, y } = plinkoPeg(row, column, rows);
    return `<g class="ig-peg" data-peg="${row}-${column}"><circle class="ig-peg-ring" cx="${x}" cy="${y}" r="8"/><circle class="ig-peg-core" cx="${x}" cy="${y}" r="3.6"/></g>`;
  }).join('')).join('');
  const slots = Object.keys(riskNames).map((risk, index) => plinkoPaytable(risk, rows).map((value, slot) => {
    const x = plinkoSlotX(slot, rows);
    const y = 398 + index * 28;
    return `<g data-slot="${slot}" data-risk="${risk}" class="ig-slot ig-risk-${risk}"><rect class="ig-slot-shadow" x="${x - (slotWidth - 4) / 2}" y="${y + 4}" width="${slotWidth - 4}" height="24" rx="4"/><rect class="ig-slot-face" x="${x - (slotWidth - 4) / 2}" y="${y}" width="${slotWidth - 4}" height="24" rx="4"/><text x="${x}" y="${y + 16}" style="font-size:${rows === 16 ? 9.5 : 11.5}px">${number(value)}×</text></g>`;
  }).join('')).join('');
  const railTop = 320 - 2 * step - 14;
  const gradients = ['#37ce8e', '#f5b944', '#ff6177'].map((color, index) => `<radialGradient id="plinko-ball-${Object.keys(riskNames)[index]}"><stop offset="0" stop-color="#fff8e6"/><stop offset="1" stop-color="${color}"/></radialGradient>`).join('');
  return `<svg viewBox="0 0 ${PLINKO_BOARD.width} ${PLINKO_BOARD.height}" class="ig-plinko-board" role="img" aria-label="Plansza Plinko, ${rows} rzędów, trzy tabele ryzyka"><defs>${gradients}</defs><path class="ig-plinko-guides" d="M${railTop} 42V66L33 352 47 374V389H593V374L607 352 ${640 - railTop} 66V42"/><g class="ig-plinko-launcher"><path d="M305 10h30l-5 15h-20z"/><circle cx="320" cy="15" r="14"/></g><text class="ig-plinko-caption" x="32" y="27">${rows} RZĘDÓW</text><text class="ig-plinko-caption" x="608" y="27" text-anchor="end">WIELE KULEK JEDNOCZEŚNIE</text><g class="ig-pegs">${pegs}</g>${slots}<g data-plinko-balls aria-hidden="true"></g></svg>`;
}

export function addPlinkoBall(svg, ball) {
  const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  group.dataset.ballId = ball.id;
  group.dataset.risk = ball.risk;
  group.classList.add('ig-ball-risk-' + ball.risk);
  group.innerHTML = `<g class="ig-ball-trail">${[4.6, 3.5, 2.4].map((radius) => `<circle r="${radius}" opacity="0"/>`).join('')}</g><g class="ig-ball"><circle class="ig-ball-glow" r="12"/><circle class="ig-ball-core" r="6.4" style="fill:url(#plinko-ball-${ball.risk})"/><circle class="ig-ball-shine" cx="-1.7" cy="-2.2" r="1.7"/></g>`;
  const start = ball.flight.frames[0];
  group.querySelector('.ig-ball').setAttribute('transform', `translate(${start.x} ${start.y})`);
  svg.querySelector('[data-plinko-balls]').append(group);
  return { group, ball: group.querySelector('.ig-ball'), trail: [...group.querySelectorAll('.ig-ball-trail circle')] };
}
