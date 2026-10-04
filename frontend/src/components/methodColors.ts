import type { Method } from '../lib/types';

/** Method identity colours (validated: CVD + normal-vision separation, 3:1 contrast). */
export const METHOD_COLOR: Record<Method, string> = {
  flood: '#A16207',
  drip: '#0284C7',
  precision: '#15803D',
};
