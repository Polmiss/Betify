import { readFile, writeFile } from 'node:fs/promises';
import { createBlackjackAnalysis } from '../src/games/blackjack-math.js';
import { TARGET_RTP } from '../src/rtp.js';
let low = 1.8, high = 2.2;
for (let i = 0; i < 48; i++) {
  const middle = (low + high) / 2;
  if (createBlackjackAnalysis(middle).expected().rtp > TARGET_RTP) high = middle;
  else low = middle;
}
const winReturn = (low + high) / 2;
const file = new URL('../src/games/blackjack-math.js', import.meta.url);
const source = (await readFile(file, 'utf8')).replace(/export const BLACKJACK_WIN_RETURN = [^;]+;/, `export const BLACKJACK_WIN_RETURN = ${winReturn};`);
await writeFile(file, source);
console.log({ winReturn, ...createBlackjackAnalysis(winReturn).expected() });
