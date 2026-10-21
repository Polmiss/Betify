import { TARGET_RTP } from '../../rtp.js';
import { PLINKO_DISTRIBUTION } from './plinko-distribution.js';

const weights = {
  8: {
    low: [5, 2, 1.4, 1.1, .6, 1.1, 1.4, 2, 5],
    medium: [13, 3, 1.3, .7, .4, .7, 1.3, 3, 13],
    high: [29, 4, 1.5, .3, .2, .3, 1.5, 4, 29],
  },
  12: {
    low: [8, 3, 1.5, 1.3, 1.1, .9, .7, .9, 1.1, 1.3, 1.5, 3, 8],
    medium: [25, 8, 3, 1.5, .7, .4, .3, .4, .7, 1.5, 3, 8, 25],
    high: [100, 15, 5, 4.3, .5, .2, .1, .2, .5, 4.3, 5, 15, 100],
  },
  16: {
    low: [16, 6, 2.5, 1.8, 1.4, 1.2, 1, .8, .6, .8, 1, 1.2, 1.4, 1.8, 2.5, 6, 16],
    medium: [100, 30, 10, 4, 2, 1.2, .7, .4, .2, .4, .7, 1.2, 2, 4, 10, 30, 100],
    high: [1000, 130, 26, 9, 4, 2, .2, .2, .1, .2, .2, 2, 4, 9, 26, 130, 1000],
  },
};
export const PLINKO_TABLES = Object.freeze(Object.fromEntries(Object.entries(weights).map(([rows, risks]) => {
  const counts = PLINKO_DISTRIBUTION.counts[rows];
  const size = PLINKO_DISTRIBUTION.poolSize * 2;
  return [rows, Object.freeze(Object.fromEntries(Object.entries(risks).map(([risk, values]) => {
    const expectation = values.reduce((sum, value, slot) => sum + value * counts[slot] / size, 0);
    return [risk, Object.freeze(values.map((value) => value * TARGET_RTP / expectation))];
  })))];
})));
export const plinkoPaytable = (risk, rows = 12) => PLINKO_TABLES[rows]?.[risk];
