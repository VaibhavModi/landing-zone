import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler, { isAllowedOrigin } from './steam-profile.js';
import { resetRateLimits, STEAM_PROFILE_LIMIT } from './rate-limit.js';

const previewHost = 'https://landing-zone-git-feature-vaibhav-modis-projects.vercel.app';

describe('isAllowedOrigin', () => {
  it('allows the site, apex, and the project alias', () => {
    expect(isAllowedOrigin('https://vaibhavmodi.com')).toBe(true);
    expect(isAllowedOrigin('https://www.vaibhavmodi.com')).toBe(true);
    expect(isAllowedOrigin('https://landing-zone-omega.vercel.app')).toBe(true);
  });

  it('allows this project preview hosts', () => {
    expect(isAllowedOrigin(previewHost)).toBe(true);
    expect(isAllowedOrigin('https://landing-zone-p2nmhkuan-vaibhav-modis-projects.vercel.app')).toBe(true);
  });

  it('rejects the third-party landing-zone.vercel.app host', () => {
    expect(isAllowedOrigin('https://landing-zone.vercel.app')).toBe(false);
  });

  it('rejects other projects that only share a prefix or another team suffix', () => {
    expect(isAllowedOrigin('https://landing-zone-attacker.vercel.app')).toBe(false);
    expect(isAllowedOrigin('https://landing-zone-x-other.vercel.app')).toBe(false);
  });

  it('rejects http origins', () => {
    expect(isAllowedOrigin('http://www.vaibhavmodi.com')).toBe(false);
    expect(isAllowedOrigin('http://landing-zone-abc-vaibhav-modis-projects.vercel.app')).toBe(false);
  });

  it('rejects suffix lookalikes on another domain', () => {
    expect(isAllowedOrigin('https://attacker-vaibhav-modis-projects.vercel.app.evil.com')).toBe(false);
    expect(isAllowedOrigin('https://landing-zone-abc-vaibhav-modis-projects.vercel.app.evil.com')).toBe(false);
  });

  it('rejects empty and unrelated origins', () => {
    expect(isAllowedOrigin('')).toBe(false);
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
  });
});

function mockResponse() {
  const headers = {};
  return {
    statusCode: 200,
    body: '',
    headers,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, value) {
      headers[key.toLowerCase()] = value;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };
}

describe('steam profile CORS header', () => {
  beforeEach(() => {
    resetRateLimits();
    delete process.env.STEAM_API_KEY;
    delete process.env.STEAM_PROFILE_ID;
    delete process.env.STEAM_SHOWCASE_APPIDS;
    vi.unstubAllGlobals();
  });

  it('does not reflect a disallowed origin', async () => {
    const response = mockResponse();
    await handler(
      { method: 'GET', headers: { origin: 'https://landing-zone.vercel.app' } },
      response
    );
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(response.body).toBe('{"error":"unavailable"}');
  });

  it('reflects an allowed preview origin', async () => {
    const response = mockResponse();
    await handler(
      { method: 'OPTIONS', headers: { origin: previewHost } },
      response
    );
    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(previewHost);
    expect(response.headers.vary).toBe('Origin');
  });

  it('returns 429 with Retry-After after the per-IP limit', async () => {
    const ip = '203.0.113.44';
    for (let i = 0; i < STEAM_PROFILE_LIMIT; i += 1) {
      const response = mockResponse();
      await handler({ method: 'GET', headers: { 'x-forwarded-for': ip } }, response);
      expect(response.statusCode).not.toBe(429);
    }

    const limited = mockResponse();
    await handler({ method: 'GET', headers: { 'x-forwarded-for': `${ip}, 10.0.0.1` } }, limited);
    expect(limited.statusCode).toBe(429);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['cache-control']).toBe('private, no-store');
    expect(limited.body).toBe('{"error":"rate-limited"}');

    const other = mockResponse();
    await handler({ method: 'GET', headers: { 'x-forwarded-for': '198.51.100.44' } }, other);
    expect(other.statusCode).not.toBe(429);
  });

  it('caches a successful response on the CDN', async () => {
    process.env.STEAM_API_KEY = 'test-key';
    process.env.STEAM_PROFILE_ID = '76561198000000000';
    process.env.STEAM_SHOWCASE_APPIDS = '730';
    vi.stubGlobal('fetch', vi.fn(async (url) => {
      const href = String(url);
      if (href.includes('GetOwnedGames')) {
        return {
          ok: true,
          json: async () => ({
            response: { games: [{ appid: 730, name: 'Counter-Strike 2' }] },
          }),
        };
      }
      return { ok: true, json: async () => ({ response: { games: [] } }) };
    }));

    const response = mockResponse();
    await handler({ method: 'GET', headers: { 'x-real-ip': '192.0.2.20' } }, response);
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, s-maxage=300, stale-while-revalidate=600');
    expect(response.body).toContain('Counter-Strike 2');
  });
});
