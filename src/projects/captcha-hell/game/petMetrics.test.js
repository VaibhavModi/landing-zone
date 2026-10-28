import { describe, expect, it } from 'vitest';
import { scorePetting, zoneFromPoint } from './petMetrics.js';

describe('zoneFromPoint', () => {
  it('maps the cat anchors', () => {
    expect(zoneFromPoint(112, 86)).toBe('head');
    expect(zoneFromPoint(112, 160)).toBe('back');
    expect(zoneFromPoint(112, 210)).toBe('belly');
    expect(zoneFromPoint(200, 170)).toBe('tail');
  });
});

describe('scorePetting', () => {
  it('measures two belly strokes', () => {
    const score = scorePetting([
      { zone: 'belly', points: [{ x: 0, y: 0, t: 1000 }, { x: 100, y: 0, t: 2000 }] },
      { zone: 'belly', points: [{ x: 0, y: 0, t: 3000 }, { x: 0, y: 50, t: 4000 }] },
    ], { readyAt: 400 });
    expect(score).toEqual({
      strokeCount: 2,
      avgSpeed: 75,
      rhythmRegularity: 0.5,
      directionChanges: 0,
      meanGapMs: 1000,
      zone: 2,
      timeToFirstTouchMs: 600,
      totalDistance: 150,
      purr: 37.5,
      pointCount: 4,
    });
  });

  it('counts a reversal and ignores pressure', () => {
    const points = [
      { x: 0, y: 0, t: 0, pressure: 1 },
      { x: 40, y: 0, t: 100, pressure: 0.2 },
      { x: 0, y: 0, t: 200, pressure: 0.8 },
    ];
    const score = scorePetting([{ zone: 'back', points }], { readyAt: 0 });
    const plain = scorePetting([{
      zone: 'back',
      points: points.map((point) => ({ x: point.x, y: point.y, t: point.t })),
    }], { readyAt: 0 });
    expect(score).toEqual(plain);
    expect(score).toMatchObject({
      avgSpeed: 400,
      directionChanges: 1,
      rhythmRegularity: 1,
      zone: 1,
      totalDistance: 80,
      purr: 20,
      timeToFirstTouchMs: 0,
    });
    expect(score.pressure).toBeUndefined();
  });

  it('treats even gaps as a perfect rhythm and uneven gaps as irregular', () => {
    const even = [0, 1, 2, 3].map((index) => {
      const start = index * 300;
      return { zone: 'head', points: [{ x: 0, y: 0, t: start }, { x: 10, y: 0, t: start + 100 }] };
    });
    expect(scorePetting(even, { readyAt: 0 })).toMatchObject({
      strokeCount: 4,
      avgSpeed: 100,
      rhythmRegularity: 1,
      meanGapMs: 200,
      zone: 0,
      totalDistance: 40,
      purr: 10,
    });

    const uneven = [0, 200, 800, 1800].map((start) => ({
      zone: 'back',
      points: [{ x: 0, y: 0, t: start }, { x: 10, y: 0, t: start + 100 }],
    }));
    expect(scorePetting(uneven, { readyAt: 0 }).rhythmRegularity).toBe(0.347);
  });
});
