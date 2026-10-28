import { selectCannedExcuse } from './excuses.js';
import { buildExcusePayload } from './excusePayload.js';
import { hashSeed, mulberry32 } from './rng.js';

export { buildExcusePayload } from './excusePayload.js';

/**
 * Numeric contract for POST /api/excuse.
 * The body is finite numbers only — never typed text, never raw pointer traces.
 * The canned line is always available if that call does not return in time.
 */
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
