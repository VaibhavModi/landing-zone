import { selectCannedExcuse } from './excuses.js';
import { hashSeed, mulberry32 } from './rng.js';

/**
 * Numeric contract for a later POST /api/excuse.
 * A future change can send `payload` to that route and fall back to
 * selectCannedExcuse. This build does not call the network and does not
 * add an AI dependency. Payload values are finite numbers only — never
 * typed text, never raw pointer traces.
 */
const CIRCLE_KEYS = [
  'roundness',
  'closureGap',
  'closureGapRatio',
  'wobble',
  'speed',
  'direction',
  'hesitationMs',
  'durationMs',
  'pauseCount',
  'pointCount',
  'humanity',
  'required',
];

const CAT_KEYS = [
  'strokeCount',
  'avgSpeed',
  'rhythmRegularity',
  'directionChanges',
  'meanGapMs',
  'zone',
  'timeToFirstTouchMs',
  'totalDistance',
  'purr',
  'pointCount',
];

const ROUND_CODE = { circle: 1, cat: 2 };

export function buildExcusePayload(round, signals) {
  const keys = round === 'cat' ? CAT_KEYS : CIRCLE_KEYS;
  const source = signals ?? {};
  const payload = { round: ROUND_CODE[round] ?? 0 };
  for (const key of keys) {
    const value = source[key];
    payload[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return payload;
}

export function incidentId(seed) {
  const rng = mulberry32((seed ?? 1) >>> 0);
  return String(1000 + Math.floor(rng() * 9000));
}

export function excuseFromSignals(round, signals, seed) {
  const payload = buildExcusePayload(round, signals);
  const resolvedSeed = seed === undefined || seed === null ? hashSeed(Object.values(payload)) : seed >>> 0;
  const excuse = selectCannedExcuse(round, signals ?? {}, resolvedSeed);
  return {
    payload,
    seed: resolvedSeed,
    id: excuse.id,
    text: excuse.text,
    incident: incidentId(resolvedSeed),
  };
}
