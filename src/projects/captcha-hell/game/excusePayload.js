export const MAX_EXCUSE_BODY_BYTES = 2048;
export const MAX_EXCUSE_CHARS = 140;

export const CIRCLE_SIGNAL_KEYS = [
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

export const CAT_SIGNAL_KEYS = [
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
  const keys = round === 'cat' ? CAT_SIGNAL_KEYS : CIRCLE_SIGNAL_KEYS;
  const source = signals ?? {};
  const payload = { round: ROUND_CODE[round] ?? 0 };
  for (const key of keys) {
    const value = source[key];
    payload[key] = typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
  return payload;
}

export const CACHE_KEY_PREFIX = 'excuse:v2:';

function coarse(value, step) {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return Math.round(value / step) * step;
}

function fmt(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

const CAT_ZONES = ['head', 'back', 'belly', 'tail'];

function paceWord(speed) {
  if (speed >= 450) return 'fast';
  if (speed <= 140) return 'slow';
  return 'moderate';
}

function shapeWord(wobble) {
  if (wobble >= 0.25) return 'wobbly';
  if (wobble <= 0.08) return 'steady';
  return 'uneven';
}

function rhythmWord(rhythm) {
  if (rhythm >= 0.8) return 'steady';
  if (rhythm <= 0.4) return 'erratic';
  return 'uneven';
}

/**
 * Plain-word description for the model, plus a bucket key that changes
 * when the coarsely rounded gesture changes. v2 drops the old method-only pool.
 */
export function signalBrief(payload) {
  if (payload?.round === 2) {
    const strokes = Math.max(0, Math.round(payload.strokeCount ?? 0));
    const seconds = coarse((payload.timeToFirstTouchMs ?? 0) / 1000, 0.5);
    const zone = CAT_ZONES[Math.max(0, Math.min(3, Math.round(payload.zone ?? 1)))] ?? 'back';
    const rhythm = rhythmWord(payload.rhythmRegularity ?? 0);
    const pace = paceWord(payload.avgSpeed ?? 0);
    return {
      method: 'cat',
      line: `cat: stroked the ${zone} ${strokes} times, ${pace} and ${rhythm}, hesitated ${fmt(seconds)} seconds`,
      key: `${CACHE_KEY_PREFIX}cat:${zone}:${strokes}:${pace}:${rhythm}:${fmt(seconds)}`,
    };
  }
  const percent = Math.round(coarse(payload?.roundness ?? 0, 10));
  const seconds = coarse((payload?.durationMs ?? 0) / 1000, 0.5);
  const shape = shapeWord(payload?.wobble ?? 0);
  const pace = paceWord(payload?.speed ?? 0);
  const wait = (payload?.hesitationMs ?? 0) >= 800 ? 'hesitant' : 'quick';
  return {
    method: 'circle',
    line: `circle: roundness ${percent}%, took ${fmt(seconds)} seconds, ${shape}, ${pace}, ${wait}`,
    key: `${CACHE_KEY_PREFIX}circle:${percent}:${fmt(seconds)}:${shape}:${pace}:${wait}`,
  };
}

export function validateExcusePayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false };
  }
  const keys = value.round === 1
    ? CIRCLE_SIGNAL_KEYS
    : value.round === 2
      ? CAT_SIGNAL_KEYS
      : null;
  if (!keys) return { ok: false };
  const allowed = new Set(['round', ...keys]);
  const present = Object.keys(value);
  if (present.length !== allowed.size) return { ok: false };
  for (const key of present) {
    if (!allowed.has(key)) return { ok: false };
    const number = value[key];
    if (typeof number !== 'number' || !Number.isFinite(number)) return { ok: false };
  }
  return {
    ok: true,
    payload: value,
    method: value.round === 1 ? 'circle' : 'cat',
  };
}

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/i;

export function sanitizeExcuseLine(raw) {
  if (typeof raw !== 'string') return '';
  const text = Array.from(raw, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('').replace(/\s+/g, ' ').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!text || text.length > MAX_EXCUSE_CHARS || /\d/.test(text) || URL_PATTERN.test(text)) return '';
  return text;
}

export function usableModelLine(content, finishReason) {
  if (finishReason === 'length') return '';
  return sanitizeExcuseLine(content);
}
