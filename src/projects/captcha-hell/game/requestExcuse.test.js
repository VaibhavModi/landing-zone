import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildExcusePayload } from './excusePayload.js';
import { requestExcuseLine } from './requestExcuse.js';

const payload = buildExcusePayload('circle', { roundness: 90, durationMs: 2000, wobble: 0.1 });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('requestExcuseLine', () => {
  it('returns the line from one call', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ text: 'A compass would be proud.' }),
    }));
    await expect(requestExcuseLine(payload, { fetchImpl })).resolves.toBe('A compass would be proud.');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body);
    expect(Object.values(body).every((value) => typeof value === 'number')).toBe(true);
  });

  it('falls back on 500 and does not retry', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }));
    await expect(requestExcuseLine(payload, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back on 429 and does not retry', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({ error: 'rate-limited' }) }));
    await expect(requestExcuseLine(payload, { fetchImpl })).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('falls back when nothing usable arrives in 2.5s', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const pending = requestExcuseLine(payload, { fetchImpl });
    await vi.advanceTimersByTimeAsync(2500);
    await expect(pending).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
