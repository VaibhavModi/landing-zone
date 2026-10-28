import { describe, expect, it } from 'vitest';
import { mapPadPoint, scoreCircle } from './circleScore.js';

/** Pads measured at these viewport widths before the square layout. */
const PADS = {
  390: { left: 40.1875, top: 504.296875, width: 309.625, height: 340 },
  768: { left: 50.578125, top: 528, width: 666.84375, height: 340 },
  1280: { left: 695.53125, top: 222.765625, width: 449.0625, height: 340 },
};

function perfectCircleOnPad(rect) {
  const side = Math.min(rect.width, rect.height);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const radius = side * 0.35;
  const points = [];
  for (let index = 0; index <= 120; index += 1) {
    const angle = -Math.PI / 2 + (index / 120) * Math.PI * 2;
    points.push(mapPadPoint(
      centerX + radius * Math.cos(angle),
      centerY + radius * Math.sin(angle),
      rect,
      index * 16,
    ));
  }
  return scoreCircle(points, { readyAt: 0 });
}

describe('pad scale', () => {
  it('scores the same perfect circle at 390, 768, and 1280 pad sizes', () => {
    const scores = Object.values(PADS).map((rect) => perfectCircleOnPad(rect));
    expect(scores.map((score) => score.roundness)).toEqual([
      scores[0].roundness,
      scores[0].roundness,
      scores[0].roundness,
    ]);
    expect(scores[0].roundness).toBe(98.696);
    expect(scores[0].direction).toBe(scores[1].direction);
    expect(scores[1].direction).toBe(scores[2].direction);
    expect(scores[0].closureGap).toBe(0);
    expect(scores[1].closureGap).toBe(0);
    expect(scores[2].closureGap).toBe(0);
  });
});
