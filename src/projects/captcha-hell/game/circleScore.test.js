import { describe, expect, it } from 'vitest';
import { humanityVerdict, scoreCircle } from './circleScore.js';

function circlePoints(count, radius, direction, wobble = 0) {
  const points = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = -Math.PI / 2 + direction * (index / count) * Math.PI * 2;
    const used = radius + wobble * Math.sin(5 * angle);
    points.push({
      x: 150 + used * Math.cos(angle),
      y: 150 + used * Math.sin(angle),
      t: 200 + index * 16,
    });
  }
  return points;
}

describe('scoreCircle', () => {
  it('scores a sampled clockwise circle', () => {
    const score = scoreCircle(circlePoints(120, 100, 1), { readyAt: 50 });
    expect(score).toMatchObject({
      roundness: 98.696,
      closureGap: 0,
      closureGapRatio: 0,
      wobble: 0,
      speed: 327.212,
      direction: 1,
      hesitationMs: 150,
      durationMs: 1920,
      pauseCount: 0,
      pointCount: 121,
      bumpIndex: 60,
      centerX: 150,
      centerY: 149.174,
      radius: 99.995,
    });
  });

  it('reports counterclockwise as -1', () => {
    const score = scoreCircle(circlePoints(120, 100, -1), { readyAt: 50 });
    expect(score.direction).toBe(-1);
    expect(score.roundness).toBe(98.696);
  });

  it('lowers roundness and raises wobble when the circle is lumpy', () => {
    const points = circlePoints(100, 100, 1, 18);
    points[40] = { ...points[40], x: points[40].x + 22, y: points[40].y + 8 };
    const score = scoreCircle(points, { readyAt: 0 });
    expect(score).toMatchObject({
      roundness: 71.792,
      closureGap: 0,
      wobble: 0.694,
      speed: 485.228,
      direction: 1,
      hesitationMs: 200,
      durationMs: 1600,
      pauseCount: 0,
    });
    expect(score.roundness).toBeLessThan(98.696);
  });

  it('measures a square polyline with exact speed, closure, and pauses', () => {
    const score = scoreCircle([
      { x: 0, y: 0, t: 0 },
      { x: 100, y: 0, t: 1000 },
      { x: 100, y: 100, t: 2000 },
      { x: 0, y: 100, t: 3000 },
      { x: 0, y: 0, t: 4000 },
    ], { readyAt: 0 });
    expect(score).toMatchObject({
      roundness: 15.91,
      closureGap: 0,
      closureGapRatio: 0,
      speed: 100,
      direction: 1,
      hesitationMs: 0,
      durationMs: 4000,
      pauseCount: 4,
      centerX: 40,
      centerY: 40,
    });
  });

  it('scores a straight line as not round', () => {
    const score = scoreCircle(
      Array.from({ length: 30 }, (_, index) => ({ x: index * 10, y: 50, t: index * 30 })),
      { readyAt: 0 },
    );
    expect(score.roundness).toBe(0);
    expect(score.direction).toBe(0);
    expect(score.closureGapRatio).toBe(1.933);
  });

  it('ignores pressure and stays finite for a collapsed stroke', () => {
    const points = [
      { x: 10, y: 10, t: 0, pressure: 0.1 },
      { x: 10, y: 10, t: 20, pressure: 0.9 },
      { x: 10, y: 10, t: 40, pressure: 0.4 },
    ];
    const without = scoreCircle(points.map((point) => ({ x: point.x, y: point.y, t: point.t })));
    expect(scoreCircle(points)).toEqual(without);
    expect(without.pressure).toBeUndefined();
    expect(Number.isFinite(without.roundness)).toBe(true);
  });
});

describe('humanityVerdict', () => {
  it('always sits a tenth under the required bar', () => {
    expect(humanityVerdict(87.36)).toEqual({ humanity: 87.3, required: 87.4 });
    expect(humanityVerdict(87.44)).toEqual({ humanity: 87.3, required: 87.4 });
    [0, 0.04, 12.24, 50, 99.96, 100].forEach((value) => {
      const verdict = humanityVerdict(value);
      expect(verdict.humanity).toBeLessThan(verdict.required);
    });
  });
});
