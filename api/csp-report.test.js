import { Readable } from 'node:stream';
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

function streamRequest(chunks, headers = {}) {
  let reads = 0;
  const stream = Readable.from(chunks);
  Object.defineProperty(stream, 'body', {
    configurable: true,
    get() {
      reads += 1;
      stream.destroy(new Error('req.body consumed the stream'));
      return undefined;
    },
  });
  stream.method = 'POST';
  stream.headers = {
    'content-type': 'application/csp-report',
    origin: allowedOrigin,
    ...headers,
  };
  stream.bodyReads = () => reads;
  return stream;
}

describe('csp report endpoint', () => {
  let errorSpy;

  beforeEach(() => {
    resetRateLimits();
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('accepts the three CSP content types and returns 204', async () => {
    for (const contentType of [
      'application/csp-report',
      'application/reports+json',
      'application/json',
      'application/csp-report; charset=utf-8',
    ]) {
      const response = mockResponse();
      await handler(postReport({
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

  it('rejects non-POST methods with 405', async () => {
    for (const method of ['GET', 'PUT', 'OPTIONS']) {
      const response = mockResponse();
      await handler({ method, headers: { 'content-type': 'application/json', origin: allowedOrigin } }, response);
      expect(response.statusCode).toBe(405);
      expect(response.headers.allow).toBe('POST');
    }
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects an unsupported content type with 415', async () => {
    const response = mockResponse();
    await handler(postReport({ headers: { 'content-type': 'text/plain', origin: allowedOrigin } }), response);
    expect(response.statusCode).toBe(415);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('rejects a body over 8 KB with 413', async () => {
    const tooBig = mockResponse();
    await handler(postReport({ body: `{"pad":"${'x'.repeat(8200)}"}` }), tooBig);
    expect(tooBig.statusCode).toBe(413);

    const declared = mockResponse();
    await handler(postReport({
      headers: { 'content-type': 'application/json', 'content-length': '9000', origin: allowedOrigin },
      body: '{}',
    }), declared);
    expect(declared.statusCode).toBe(413);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts a body of exactly 8 KB', async () => {
    const prefix = '{"csp-report":{"violated-directive":"style-src","blocked-uri":"inline","document-uri":"https://www.vaibhavmodi.com/","pad":"';
    const suffix = '"}}';
    const pad = 'a'.repeat(8192 - Buffer.byteLength(prefix) - Buffer.byteLength(suffix));
    const payload = `${prefix}${pad}${suffix}`;
    expect(Buffer.byteLength(payload)).toBe(8192);
    const response = mockResponse();
    await handler(postReport({
      headers: { 'content-type': 'application/json', 'content-length': '8192', origin: allowedOrigin },
      body: payload,
    }), response);
    expect(response.statusCode).toBe(204);
    expect(errorSpy).toHaveBeenCalled();
  });

  it('logs only the sanitized directive, host, and path', async () => {
    const response = mockResponse();
    await handler(postReport({
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

  it('rejects a present disallowed Origin and otherwise requires the document host', async () => {
    const denied = mockResponse();
    await handler(postReport({
      headers: {
        'content-type': 'application/csp-report',
        origin: 'https://landing-zone.vercel.app',
        referer: 'https://www.vaibhavmodi.com/recruiter',
      },
    }), denied);
    expect(denied.statusCode).toBe(204);

    const missingOrigin = mockResponse();
    await handler(postReport({
      headers: {
        'content-type': 'application/json',
        origin: '',
        referer: 'https://evil.example/recruiter',
      },
    }), missingOrigin);
    expect(missingOrigin.statusCode).toBe(204);

    const badDocument = mockResponse();
    await handler(postReport({
      headers: { 'content-type': 'application/json', origin: '' },
      body: {
        'csp-report': {
          'violated-directive': 'script-src',
          'blocked-uri': 'inline',
          'document-uri': 'https://evil.example/phish',
        },
      },
    }), badDocument);
    expect(badDocument.statusCode).toBe(204);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0].join(' ')).toContain('document-path=/recruiter');
  });

  it('stops logging once the shared per-instance limiter is full', async () => {
    for (let i = 0; i < CSP_LOG_LIMIT + 3; i += 1) {
      const response = mockResponse();
      await handler(postReport(), response);
      expect(response.statusCode).toBe(204);
    }
    expect(errorSpy).toHaveBeenCalledTimes(CSP_LOG_LIMIT);
  });

  it('reads a legacy csp-report stream without touching req.body', async () => {
    const request = streamRequest([Buffer.from(JSON.stringify({
      'csp-report': {
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://cdn.example/app.js',
        'document-uri': 'https://www.vaibhavmodi.com/recruiter',
      },
    }))]);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy.mock.calls[0].join(' ')).toBe(
      '[csp-report] violated-directive=script-src-elem blocked-host=cdn.example document-path=/recruiter'
    );
  });

  it('reads a Reporting API stream without touching req.body', async () => {
    const request = streamRequest(
      [Buffer.from(JSON.stringify([{
        type: 'csp-violation',
        body: {
          effectiveDirective: 'img-src',
          blockedURL: 'https://cdn.example/a.png',
          documentURL: 'https://www.vaibhavmodi.com/friend',
        },
      }]))],
      { 'content-type': 'application/reports+json' },
    );
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy.mock.calls[0].join(' ')).toBe(
      '[csp-report] violated-directive=img-src blocked-host=cdn.example document-path=/friend'
    );
  });

  it('rejects an oversized stream that has no Content-Length', async () => {
    const request = streamRequest([
      Buffer.alloc(4000, 0x61),
      Buffer.alloc(4000, 0x62),
      Buffer.alloc(200, 0x63),
    ]);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(413);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts malformed JSON from the stream without logging it', async () => {
    const request = streamRequest([Buffer.from('{not-json')]);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  // Models @vercel/node restoreBody: the async iterator is already finished
  // (for-await yields nothing) and the buffered body is re-emitted only on
  // data/end. Reading req.body fails the test.
  function replayRequest(chunks, headers = {}) {
    let reads = 0;
    const list = chunks.map((chunk) => (Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    const listeners = { data: [], end: [], error: [] };
    let queued = false;
    const request = {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        origin: allowedOrigin,
        ...headers,
      },
      readableEnded: false,
      complete: false,
      read() {
        return null;
      },
      on(name, callback) {
        if (listeners[name]) listeners[name].push(callback);
        if (!queued) {
          queued = true;
          queueMicrotask(() => {
            for (const chunk of list) {
              for (const listener of listeners.data) listener(chunk);
            }
            for (const listener of listeners.end) listener();
          });
        }
        return this;
      },
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: true, value: undefined }),
        };
      },
    };
    Object.defineProperty(request, 'body', {
      configurable: true,
      get() {
        reads += 1;
        return undefined;
      },
    });
    request.bodyReads = () => reads;
    return request;
  }

  function endedRequest(payload, headers = {}) {
    let reads = 0;
    let pending = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    const request = {
      method: 'POST',
      headers: {
        'content-type': 'application/csp-report',
        origin: allowedOrigin,
        ...headers,
      },
      readableEnded: true,
      complete: true,
      destroyed: true,
      read() {
        const chunk = pending;
        pending = null;
        return chunk && chunk.length ? chunk : null;
      },
      on() {
        return this;
      },
      [Symbol.asyncIterator]() {
        return {
          next: async () => ({ done: true, value: undefined }),
        };
      },
    };
    Object.defineProperty(request, 'body', {
      configurable: true,
      get() {
        reads += 1;
        return undefined;
      },
    });
    request.bodyReads = () => reads;
    return request;
  }

  it('logs a legacy report replayed on data/end after the iterator is drained', async () => {
    const request = replayRequest([Buffer.from(JSON.stringify({
      'csp-report': {
        'violated-directive': 'script-src-elem',
        'blocked-uri': 'https://cdn.example/app.js',
        'document-uri': 'https://www.vaibhavmodi.com/recruiter',
      },
    }))]);
    let yielded = 0;
    for await (const chunk of request) {
      yielded += chunk?.length || 0;
    }
    expect(yielded).toBe(0);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy.mock.calls[0].join(' ')).toBe(
      '[csp-report] violated-directive=script-src-elem blocked-host=cdn.example document-path=/recruiter'
    );
  });

  it('logs a Reporting API replay emitted on data/end', async () => {
    const request = replayRequest(
      [Buffer.from(JSON.stringify([{
        type: 'csp-violation',
        body: {
          effectiveDirective: 'style-src',
          blockedURL: 'inline',
          documentURL: 'https://vaibhavmodi.com/friend',
        },
      }]))],
      { 'content-type': 'application/reports+json' },
    );
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy.mock.calls[0].join(' ')).toBe(
      '[csp-report] violated-directive=style-src blocked-host=inline document-path=/friend'
    );
  });

  it('rejects an oversized data/end replay that has no Content-Length', async () => {
    const request = replayRequest([
      Buffer.alloc(4000, 0x61),
      Buffer.alloc(4000, 0x62),
      Buffer.alloc(200, 0x63),
    ]);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(413);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not log malformed JSON replayed on data/end', async () => {
    const request = replayRequest([Buffer.from('{not-json')]);
    const response = mockResponse();
    await handler(request, response);
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('reads the helper buffer when the stream is already ended', async () => {
    const request = endedRequest(JSON.stringify({
      'csp-report': {
        'violated-directive': 'font-src',
        'blocked-uri': 'https://fonts.example/a.woff2',
        'document-uri': 'https://www.vaibhavmodi.com/',
      },
    }));
    const response = mockResponse();
    const result = await Promise.race([
      handler(request, response).then(() => 'done'),
      new Promise((resolve) => {
        setTimeout(() => resolve('hung'), 500);
      }),
    ]);
    expect(result).toBe('done');
    expect(request.bodyReads()).toBe(0);
    expect(response.statusCode).toBe(204);
    expect(errorSpy.mock.calls[0].join(' ')).toBe(
      '[csp-report] violated-directive=font-src blocked-host=fonts.example document-path=/'
    );
  });

  it('stops waiting when a stream never emits data or end', async () => {
    vi.useFakeTimers();
    try {
      let reads = 0;
      const request = {
        method: 'POST',
        headers: {
          'content-type': 'application/csp-report',
          origin: allowedOrigin,
        },
        readableEnded: false,
        complete: false,
        read() {
          return null;
        },
        on() {
          return this;
        },
        [Symbol.asyncIterator]() {
          return {
            next: async () => ({ done: true, value: undefined }),
          };
        },
      };
      Object.defineProperty(request, 'body', {
        configurable: true,
        get() {
          reads += 1;
          return undefined;
        },
      });
      const response = mockResponse();
      const pending = handler(request, response);
      await vi.advanceTimersByTimeAsync(1999);
      expect(response.statusCode).toBe(200);
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(reads).toBe(0);
      expect(response.statusCode).toBe(204);
      expect(errorSpy).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
