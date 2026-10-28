import { describe, expect, it } from 'vitest';
import { buildExcusePayload, excuseFromSignals, incidentId } from './excuseContract.js';
import {
  CAT_EXCUSES,
  CIRCLE_EXCUSES,
  classifyCat,
  classifyCircle,
  excuseById,
  excuseLibrarySize,
  selectCannedExcuse,
} from './excuses.js';

const perfect = {
  roundness: 98.696,
  wobble: 0,
  closureGapRatio: 0,
  hesitationMs: 150,
  direction: 1,
  speed: 327.212,
};

const plainWobble = {
  roundness: 72,
  wobble: 0.7,
  closureGapRatio: 0.04,
  hesitationMs: 100,
  direction: 0,
  speed: 400,
};

const belly = {
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
};

describe('excuse library', () => {
  it('has a large canned set with unique ids', () => {
    expect(excuseLibrarySize()).toBeGreaterThanOrEqual(60);
    expect(CIRCLE_EXCUSES.length).toBeGreaterThan(20);
    expect(CAT_EXCUSES.length).toBeGreaterThan(20);
    const ids = [...CIRCLE_EXCUSES, ...CAT_EXCUSES].map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('renders every line from numbers only', () => {
    const sample = { ...perfect, ...belly, humanity: 87.3, required: 87.4 };
    [...CIRCLE_EXCUSES, ...CAT_EXCUSES].forEach((entry) => {
      const text = entry.line(sample);
      expect(typeof text).toBe('string');
      expect(text.length).toBeGreaterThan(8);
    });
  });
});

describe('selectCannedExcuse', () => {
  it('is deterministic for a seed and changes when the seed changes', () => {
    const first = selectCannedExcuse('circle', perfect, 1);
    expect(selectCannedExcuse('circle', perfect, 1)).toEqual(first);
    expect(first.id).toBe('c-tr-cl-02');
    expect(first.text).toBe('The gap is zero and the wobble is gone. Machines do that on purpose.');
    expect(selectCannedExcuse('circle', perfect, 2).id).toBe('c-tr-cl-03');
    expect(excuseById(first.id).tags).toContain('too-round');
    expect(excuseById(first.id).tags).not.toContain('wobbly');
  });

  it('sends a wobbly circle to the convincingly-imperfect pool', () => {
    expect(classifyCircle(plainWobble)).toContain('wobbly');
    expect(classifyCircle(plainWobble)).not.toContain('too-round');
    const picked = selectCannedExcuse('circle', plainWobble, 1);
    expect(picked.id).toBe('c-wb-07');
    expect(picked.text).toBe('Convincing imperfection is still a program.');
    const ids = new Set();
    for (let seed = 1; seed <= 30; seed += 1) {
      const choice = selectCannedExcuse('circle', plainWobble, seed);
      ids.add(choice.id);
      expect(choice.id.startsWith('c-wb')).toBe(true);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it('picks a belly roast from the same seed twice, and a different line from another seed', () => {
    expect(classifyCat(belly)).toEqual(['any', 'belly', 'tentative']);
    const first = selectCannedExcuse('cat', belly, 1);
    expect(selectCannedExcuse('cat', belly, 1)).toEqual(first);
    expect(first.id).toBe('k-be-03');
    expect(first.text).toBe('You went for the belly like a diagram told you to.');
    expect(selectCannedExcuse('cat', belly, 4).id).toBe('k-be-04');
  });

  it('uses rhythm and zone together for a metronomic belly', () => {
    const signals = { ...belly, rhythmRegularity: 1, strokeCount: 6, avgSpeed: 200 };
    const choice = selectCannedExcuse('cat', signals, 1);
    expect(choice.id.startsWith('k-be-mt')).toBe(true);
    expect(choice.text).toBe('The trap zone, on a beat. The cat agrees with the sensor.');
  });
});

describe('excuse payload', () => {
  it('keeps only finite numbers', () => {
    const payload = buildExcusePayload('circle', {
      ...perfect,
      humanity: 98.5,
      required: 98.6,
      note: 'typed hello',
      points: [{ x: 1, y: 2 }],
    });
    expect(JSON.stringify(payload)).not.toContain('hello');
    expect(JSON.stringify(payload)).not.toContain('typed');
    Object.values(payload).forEach((value) => {
      expect(typeof value).toBe('number');
      expect(Number.isFinite(value)).toBe(true);
    });
    expect(payload.round).toBe(1);
    expect(payload.roundness).toBe(98.696);

    const catPayload = buildExcusePayload('cat', { ...belly, zone: 'belly', comment: 'nice kitty' });
    expect(JSON.stringify(catPayload)).not.toContain('kitty');
    expect(catPayload.zone).toBe(0);
    expect(catPayload.round).toBe(2);
  });

  it('derives a stable incident and excuse without a caller seed', () => {
    const first = excuseFromSignals('circle', perfect);
    const second = excuseFromSignals('circle', perfect);
    expect(second).toEqual(first);
    expect(first.incident).toMatch(/^\d{4}$/);
    expect(incidentId(first.seed)).toBe(first.incident);
    expect(first.payload.roundness).toBe(98.696);
    expect(first.text.length).toBeGreaterThan(8);
  });
});
