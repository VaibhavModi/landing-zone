import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './csp-report.js';
import { CSP_LOG_LIMIT, resetRateLimits } from './rate-limit.js';

const allowedOrigin = 'https://www.vaibhavmodi.com';

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

function postReport(overrides = {}) {
  return {
    method: 'POST',
    headers: {
      'content-type': 'application/csp-report',
      origin: allowedOrigin,
      ...(overrides.headers || {}),
    },
    body: overrides.body ?? {
      'csp-report': {
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://evil.example/script.js?token=secret',
        'document-uri': 'https://www.vaibhavmodi.com/recruiter?token=secret',
        'original-policy': 'default-src \'self\'',
        'script-sample': 'secret-sample',
      },
    },
  };
}

describe('csp report endpoint', () => {
  let errorSpy;

  beforeEach(() => {
    resetRateLimits();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('accepts the three CSP content types and returns 204', () => {
    for (const contentType of [
      'application/csp-report',
      'application/reports+json',
      'application/json',
      'application/csp-report; charset=utf-8',
    ]) {
      const response = mockResponse();
      handler(postReport({
        headers: { 'content-type': contentType, origin: allowedOrigin },
        body: contentType.startsWith('application/reports')
          ? [{
            type: 'csp-violation',
            body: {
              effectiveDirective: 'img-src',
              blockedURL: 'https://cdn.example/a.png',
              documentURL: 'https://www.vaibhavmodi.com/',
            },
          }]
          : undefined,
      }), response);
      expect(response.statusCode).toBe(204);
    }
    expect(errorSpy).toHaveBeenCalled();
  });

  it('rejects non-POST methods with 405', () => {
    for (const method of ['GET', 'PUT', 'OPTIONS']) {
      const response = mockResponse();
      handler({ method, headers: { 'content-type': 'application/json', origin: allowedOrigin } }, response);
      expect(response.statusCode).toBe(405);
      expect(response.headers.allow).toBe('POST');
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects an unsupported content type with 415', () => {
    const response = mockResponse();
    handler(postReport({ headers: { 'content-type': 'text/plain', origin: allowedOrigin } }), response);
    expect(response.statusCode).toBe(415);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects a body over 8 KB with 413', () => {
    const tooBig = mockResponse();
    handler(postReport({ body: `{"pad":"${'x'.repeat(8200)}"}` }), tooBig);
    expect(tooBig.statusCode).toBe(413);

    const declared = mockResponse();
    handler(postReport({
      headers: { 'content-type': 'application/json', 'content-length': '9000', origin: allowedOrigin },
      body: '{}',
    }), declared);
    expect(declared.statusCode).toBe(413);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts a body of exactly 8 KB', () => {
    const prefix = '{"csp-report":{"violated-directive":"style-src","blocked-uri":"inline","document-uri":"https://www.vaibhavmodi.com/","pad":"';
    const suffix = '"}}';
    const pad = 'a'.repeat(8192 - Buffer.byteLength(prefix) - Buffer.byteLength(suffix));
    const payload = `${prefix}${pad}${suffix}`;
    expect(Buffer.byteLength(payload)).toBe(8192);
    const response = mockResponse();
    handler(postReport({
      headers: { 'content-type': 'application/json', 'content-length': '8192', origin: allowedOrigin },
      body: payload,
    }), response);
    expect(response.statusCode).toBe(204);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs only the sanitized directive, host, and path', () => {
    const response = mockResponse();
    handler(postReport({
      headers: {
        'content-type': 'application/csp-report',
        origin: allowedOrigin,
        'x-forwarded-for': '203.0.113.50',
      },
      body: {
        'csp-report': {
          'violated-directive': 'script-src-elem',
          'blocked-uri': 'https://203.0.113.50/collector?ip=203.0.113.50',
          'document-uri': 'https://www.vaibhavmodi.com/recruiter?token=secret',
          'original-policy': 'default-src https://secret.example',
          referrer: 'https://secret.example/path',
        },
      },
    }), response);

    expect(response.statusCode).toBe(204);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const line = errorSpy.mock.calls[0].join(' ');
    expect(line).toBe('[csp-report] violated-directive=script-src-elem blocked-host=ip document-path=/recruiter');
    expect(line).not.toContain('203.0.113.50');
    expect(line).not.toContain('token');
    expect(line).not.toContain('secret');
    expect(line).not.toContain('x-forwarded-for');
  });

  it('drops reports whose origin or referer is not on the steam allowlist', () => {
    const denied = mockResponse();
    handler(postReport({
      headers: {
        'content-type': 'application/csp-report',
        origin: 'https://landing-zone.vercel.app',
        referer: 'https://www.vaibhavmodi.com/recruiter',
      },
    }), denied);
    expect(denied.statusCode).toBe(204);

    const fromReferer = mockResponse();
    handler(postReport({
      headers: {
        'content-type': 'application/json',
        origin: '',
        referer: 'https://landing-zone-git-feature-vaibhav-modis-projects.vercel.app/recruiter',
      },
    }), fromReferer);
    expect(fromReferer.statusCode).toBe(204);

    const badReferer = mockResponse();
    handler(postReport({
      headers: {
        'content-type': 'application/json',
        origin: '',
        referer: 'https://evil.example/recruiter',
      },
    }), badReferer);
    expect(badReferer.statusCode).toBe(204);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0].join(' ')).toContain('document-path=/recruiter');
  });

  it('stops logging once the shared per-instance limiter is full', () => {
    for (let i = 0; i < CSP_LOG_LIMIT + 3; i += 1) {
      const response = mockResponse();
      handler(postReport(), response);
      expect(response.statusCode).toBe(204);
    }
    expect(errorSpy).toHaveBeenCalledTimes(CSP_LOG_LIMIT);
  });
});
