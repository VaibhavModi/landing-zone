export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function round3(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}
