import { describe, expect, it } from 'vitest';
import handler, { isAllowedOrigin } from './steam-profile.js';

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
});
