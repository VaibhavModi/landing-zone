import { clamp, round3 } from './numbers.js';

export const CIRCLE_SPACE = { w: 300, h: 340 };

function finitePoints(points) {
  return (points ?? []).filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.t),
  );
}

/**
 * On-device circle measurements. Every field is a finite number.
 * direction: 1 clockwise, -1 counterclockwise, 0 unsettled (screen y grows downward).
 */
export function scoreCircle(points, { readyAt = 0 } = {}) {
  const clean = finitePoints(points);
  const pointCount = clean.length;
  const base = {
    roundness: 0,
    closureGap: 0,
    closureGapRatio: 1,
    wobble: 1,
    speed: 0,
    direction: 0,
    hesitationMs: 0,
    durationMs: 0,
    pauseCount: 0,
    pointCount,
    bumpIndex: 0,
    centerX: 0,
    centerY: 0,
    radius: 0,
  };

  if (pointCount > 0) {
    base.hesitationMs = round3(Math.max(0, clean[0].t - readyAt));
  }
  if (pointCount < 3) return base;

  let sumX = 0;
  let sumY = 0;
  for (const point of clean) {
    sumX += point.x;
    sumY += point.y;
  }
  const centerX = sumX / pointCount;
  const centerY = sumY / pointCount;
  const radii = clean.map((point) => Math.hypot(point.x - centerX, point.y - centerY));
  const meanRadius = radii.reduce((total, radius) => total + radius, 0) / pointCount;
  const variance = radii.reduce((total, radius) => total + (radius - meanRadius) ** 2, 0) / pointCount;
  const deviation = Math.sqrt(variance);
  const variation = meanRadius > 1 ? deviation / meanRadius : 1;

  const bins = 36;
  const seen = new Array(bins).fill(0);
  for (const point of clean) {
    const angle = Math.atan2(point.y - centerY, point.x - centerX);
    let index = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * bins);
    if (index < 0) index = 0;
    if (index >= bins) index = bins - 1;
    seen[index] = 1;
  }
  const coverage = seen.reduce((total, bit) => total + bit, 0) / bins;
  const radial = clamp(1 - variation / 0.45, 0, 1);
  const roundness = clamp(radial * (0.15 + 0.85 * coverage) * 100, 0, 100);

  const closureGap = Math.hypot(
    clean[0].x - clean[pointCount - 1].x,
    clean[0].y - clean[pointCount - 1].y,
  );
  const closureGapRatio = meanRadius > 1 ? closureGap / (2 * meanRadius) : 1;

  const turns = [];
  for (let index = 1; index < pointCount - 1; index += 1) {
    const previousX = clean[index].x - clean[index - 1].x;
    const previousY = clean[index].y - clean[index - 1].y;
    const nextX = clean[index + 1].x - clean[index].x;
    const nextY = clean[index + 1].y - clean[index].y;
    const previousLength = Math.hypot(previousX, previousY);
    const nextLength = Math.hypot(nextX, nextY);
    if (previousLength < 0.01 || nextLength < 0.01) continue;
    const cross = previousX * nextY - previousY * nextX;
    const dot = previousX * nextX + previousY * nextY;
    turns.push(Math.atan2(cross, dot));
  }
  let wobble = 1;
  if (turns.length > 2) {
    const meanTurn = turns.reduce((total, turn) => total + turn, 0) / turns.length;
    const turnDeviation = Math.sqrt(
      turns.reduce((total, turn) => total + (turn - meanTurn) ** 2, 0) / turns.length,
    );
    wobble = clamp(turnDeviation / 0.6, 0, 1);
  }

  let length = 0;
  let pauseCount = 0;
  let crossSum = 0;
  for (let index = 1; index < pointCount; index += 1) {
    length += Math.hypot(clean[index].x - clean[index - 1].x, clean[index].y - clean[index - 1].y);
    if (clean[index].t - clean[index - 1].t > 180) pauseCount += 1;
  }
  for (let index = 1; index < pointCount - 1; index += 1) {
    const previousX = clean[index].x - clean[index - 1].x;
    const previousY = clean[index].y - clean[index - 1].y;
    const nextX = clean[index + 1].x - clean[index].x;
    const nextY = clean[index + 1].y - clean[index].y;
    crossSum += previousX * nextY - previousY * nextX;
  }

  const durationMs = Math.max(0, clean[pointCount - 1].t - clean[0].t);
  const speed = durationMs > 0 ? length / (durationMs / 1000) : 0;
  let direction = 0;
  if (crossSum > 1) direction = 1;
  else if (crossSum < -1) direction = -1;

  let bumpIndex = 0;
  let bumpDelta = -1;
  for (let index = 0; index < pointCount; index += 1) {
    const delta = Math.abs(radii[index] - meanRadius);
    if (delta > bumpDelta) {
      bumpDelta = delta;
      bumpIndex = index;
    }
  }

  return {
    roundness: round3(roundness),
    closureGap: round3(closureGap),
    closureGapRatio: round3(closureGapRatio),
    wobble: round3(wobble),
    speed: round3(speed),
    direction,
    hesitationMs: round3(Math.max(0, clean[0].t - readyAt)),
    durationMs: round3(durationMs),
    pauseCount,
    pointCount,
    bumpIndex,
    centerX: round3(centerX),
    centerY: round3(centerY),
    radius: round3(meanRadius),
  };
}

/** Always a hair under the bar, so the displayed check cannot pass. */
export function humanityVerdict(roundness) {
  const safe = clamp(Number.isFinite(roundness) ? roundness : 0, 0, 100);
  const rounded = Math.round(safe * 10) / 10;
  const required = rounded <= 0 ? 0.1 : rounded;
  let humanity = Math.round((required - 0.1) * 10) / 10;
  if (humanity < 0) humanity = 0;
  if (!(humanity < required)) {
    humanity = Math.round((required - 0.1) * 10) / 10;
  }
  return { humanity, required };
}
