import { clamp, round3 } from './numbers.js';

/** Numeric zone codes. Order is the on-the-wire contract. */
export const ZONE_NAME = ['head', 'back', 'belly', 'tail'];
export const ZONE_CODE = { head: 0, back: 1, belly: 2, tail: 3 };
export const CAT_SPACE = { w: 240, h: 260 };

export function zoneFromPoint(x, y) {
  if (x >= 176 && y >= 118) return 'tail';
  if (y <= 132) return 'head';
  if (y >= 196) return 'belly';
  return 'back';
}

function finitePoints(points) {
  return (points ?? []).filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.t),
  );
}

/**
 * Petting measurements from strokes. Speed is distance over time.
 * Pointer pressure is ignored even if a device reports it.
 * zone is a number: 0 head, 1 back, 2 belly, 3 tail.
 * rhythmRegularity is 1 for a single continuous stroke, 0.5 when only one gap
 * exists, and 1 - (gap stddev / mean) when several gaps can be compared.
 */
export function scorePetting(strokes, { readyAt = 0 } = {}) {
  const list = Array.isArray(strokes) ? strokes : [];
  const speeds = [];
  const gaps = [];
  const zoneCounts = [0, 0, 0, 0];
  let totalDistance = 0;
  let directionChanges = 0;
  let pointCount = 0;

  for (let strokeIndex = 0; strokeIndex < list.length; strokeIndex += 1) {
    const stroke = list[strokeIndex] ?? {};
    const points = finitePoints(stroke.points);
    pointCount += points.length;
    const zoneCode = ZONE_CODE[stroke.zone] ?? ZONE_CODE.back;
    zoneCounts[zoneCode] += Math.max(1, points.length);

    let length = 0;
    for (let index = 1; index < points.length; index += 1) {
      const previousX = points[index].x - points[index - 1].x;
      const previousY = points[index].y - points[index - 1].y;
      length += Math.hypot(previousX, previousY);
      if (index < points.length - 1) {
        const nextX = points[index + 1].x - points[index].x;
        const nextY = points[index + 1].y - points[index].y;
        const magnitude = Math.hypot(previousX, previousY) * Math.hypot(nextX, nextY);
        const dot = previousX * nextX + previousY * nextY;
        if (magnitude > 0.01 && dot / magnitude < -0.35) directionChanges += 1;
      }
    }
    totalDistance += length;
    if (points.length >= 2) {
      const duration = points[points.length - 1].t - points[0].t;
      if (duration > 0) speeds.push(length / (duration / 1000));
    }
    if (strokeIndex > 0) {
      const previous = finitePoints(list[strokeIndex - 1]?.points);
      const previousEnd = previous[previous.length - 1]?.t;
      const start = points[0]?.t;
      if (previousEnd !== undefined && start !== undefined) {
        gaps.push(Math.max(0, start - previousEnd));
      }
    }
  }

  const avgSpeed = speeds.length
    ? speeds.reduce((total, speed) => total + speed, 0) / speeds.length
    : 0;

  let rhythmRegularity = 1;
  if (gaps.length === 1) rhythmRegularity = 0.5;
  else if (gaps.length >= 2) {
    const mean = gaps.reduce((total, gap) => total + gap, 0) / gaps.length;
    if (mean > 0) {
      const deviation = Math.sqrt(
        gaps.reduce((total, gap) => total + (gap - mean) ** 2, 0) / gaps.length,
      );
      rhythmRegularity = clamp(1 - deviation / mean, 0, 1);
    }
  }

  let zone = ZONE_CODE.back;
  let best = -1;
  for (let index = 0; index < zoneCounts.length; index += 1) {
    if (zoneCounts[index] > best) {
      best = zoneCounts[index];
      zone = index;
    }
  }

  const firstTime = finitePoints(list[0]?.points)[0]?.t;
  const timeToFirstTouchMs = firstTime === undefined ? 0 : Math.max(0, firstTime - readyAt);
  const meanGapMs = gaps.length ? gaps.reduce((total, gap) => total + gap, 0) / gaps.length : 0;

  return {
    strokeCount: list.length,
    avgSpeed: round3(avgSpeed),
    rhythmRegularity: round3(rhythmRegularity),
    directionChanges,
    meanGapMs: round3(meanGapMs),
    zone,
    timeToFirstTouchMs: round3(timeToFirstTouchMs),
    totalDistance: round3(totalDistance),
    purr: round3(clamp((totalDistance / 400) * 100, 0, 100)),
    pointCount,
  };
}
