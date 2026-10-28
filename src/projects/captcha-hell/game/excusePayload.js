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

function coarse(value, step) {
  if (!Number.isFinite(value) || step <= 0) return 0;
  return Math.round(value / step) * step;
}

function fmt(value) {
  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? '0' : String(rounded);
}

/** Short numeric line. This is the only model input, and the cache key. */
export function signalLine(payload) {
  if (!payload || payload.round === 2) {
    const speed = coarse(payload?.avgSpeed ?? 0, 50);
    const rhythm = coarse(payload?.rhythmRegularity ?? 0, 0.1);
    const zone = Math.round(payload?.zone ?? 0);
    const strokes = Math.max(0, Math.round(payload?.strokeCount ?? 0));
    return {
      method: 'cat',
      line: `m=cat s=${speed} r=${fmt(rhythm)} z=${zone} n=${strokes}`,
      key: `excuse:b:cat:${speed}:${fmt(rhythm)}:${zone}:${strokes}`,
    };
  }
  const score = coarse((payload.roundness ?? 0) / 100, 0.05);
  const seconds = coarse((payload.durationMs ?? 0) / 1000, 0.5);
  const wobble = coarse(payload.wobble ?? 0, 0.05);
  return {
    method: 'circle',
    line: `m=circle s=${fmt(score)} t=${fmt(seconds)} j=${fmt(wobble)}`,
    key: `excuse:b:circle:${fmt(score)}:${fmt(seconds)}:${fmt(wobble)}`,
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

const URL_PATTERN = /(?:https?:\/\/|www\.)\S+/gi;

export function sanitizeExcuseLine(raw) {
  if (typeof raw !== 'string') return '';
  let text = Array.from(raw, (char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127 ? ' ' : char;
  }).join('').replace(/\s+/g, ' ').trim();
  text = text.replace(/^["'`]+|["'`]+$/g, '').trim();
  text = text.replace(URL_PATTERN, '').replace(/\s+/g, ' ').trim();
  if (!text || text.length > MAX_EXCUSE_CHARS) return '';
  return text;
}

export function usableModelLine(content, finishReason) {
  if (finishReason === 'length') return '';
  return sanitizeExcuseLine(content);
}
