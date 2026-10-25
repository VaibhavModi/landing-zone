import { describe, expect, it } from 'vitest';
import { consumeRateLimit, resetRateLimits } from './rate-limit.js';

describe('shared rate limiter', () => {
  it('allows a burst and then reports retry-after for the rest of the window', () => {
    resetRateLimits();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 2; i += 1) {
      expect(consumeRateLimit('steam:203.0.113.8', 2, 60_000, now).allowed).toBe(true);
    }
    const blocked = consumeRateLimit('steam:203.0.113.8', 2, 60_000, now + 1000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfter).toBe(59);
    expect(consumeRateLimit('steam:198.51.100.8', 2, 60_000, now + 1000).allowed).toBe(true);
    expect(consumeRateLimit('csp-report', 2, 60_000, now + 1000).allowed).toBe(true);
  });
});
