import { isAllowedOrigin } from './steam-profile.js';
import { consumeRateLimit, CSP_LOG_LIMIT, CSP_LOG_WINDOW_MS } from './rate-limit.js';

const MAX_BODY_BYTES = 8 * 1024;
const ACCEPTED_TYPES = new Set([
  'application/csp-report',
  'application/reports+json',
  'application/json',
]);

function readHeader(request, name) {
  const headers = request?.headers || {};
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0] || '';
  }
  return typeof value === 'string' ? value : '';
}

function mediaType(request) {
  return readHeader(request, 'content-type').split(';')[0].trim().toLowerCase();
}

function declaredLength(request) {
  const raw = readHeader(request, 'content-length').trim();
  if (!raw) {
    return 0;
  }
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return MAX_BODY_BYTES + 1;
  }
  return value;
}

function bodyByteLength(body) {
  if (body == null) {
    return 0;
  }
  if (typeof body === 'string') {
    return Buffer.byteLength(body);
  }
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    return body.byteLength;
  }
  try {
    return Buffer.byteLength(JSON.stringify(body));
  } catch {
    return MAX_BODY_BYTES + 1;
  }
}

function isNodeStream(request) {
  return Boolean(
    request
    && typeof request[Symbol.asyncIterator] === 'function'
    && (typeof request.read === 'function' || typeof request.on === 'function')
  );
}

function presentedOrigin(request) {
  return readHeader(request, 'origin').trim();
}

function documentOrigin(parsed) {
  const value = firstReport(parsed)?.document;
  if (typeof value !== 'string' || !value) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    return url.origin;
  } catch {
    return '';
  }
}

function parseBody(body) {
  if (body == null || body === '') {
    return null;
  }
  if (typeof body === 'string' || Buffer.isBuffer(body) || body instanceof Uint8Array) {
    const text = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') {
    return body;
  }
  return null;
}

function directiveOf(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const match = value.trim().toLowerCase().match(/^[a-z0-9-]{1,40}/);
  return match ? match[0] : '';
}

function isIpHost(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return true;
  }
  return host.includes(':');
}

function blockedHost(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) {
    return '';
  }
  if (/^(inline|eval|self|none)$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol === 'data:' || url.protocol === 'blob:' || url.protocol === 'about:') {
      return url.protocol.slice(0, -1);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    const host = url.hostname.toLowerCase();
    if (!host || host.length > 253 || isIpHost(host)) {
      return host ? 'ip' : '';
    }
    if (!/^[a-z0-9.-]+$/.test(host)) {
      return '';
    }
    return host;
  } catch {
    return '';
  }
}

function documentPath(value) {
  if (typeof value !== 'string' || !value || value.length > 2048) {
    return '';
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }
    const path = url.pathname.slice(0, 80);
    if (!/^\/[A-Za-z0-9._~/-]*$/.test(path)) {
      return '';
    }
    return path || '/';
  } catch {
    return '';
  }
}

function firstReport(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  if (Array.isArray(parsed)) {
    const item = parsed.find((entry) => entry && typeof entry === 'object');
    const body = item?.body && typeof item.body === 'object' ? item.body : {};
    return {
      directive: body.effectiveDirective || body.violatedDirective || '',
      blocked: body.blockedURL || body.blockedUri || '',
      document: body.documentURL || body.documentUri || item?.url || '',
    };
  }

  const report = parsed['csp-report'] && typeof parsed['csp-report'] === 'object'
    ? parsed['csp-report']
    : parsed;

  return {
    directive: report['violated-directive'] || report['effective-directive'] || report.effectiveDirective || report.violatedDirective || '',
    blocked: report['blocked-uri'] || report.blockedURL || report.blockedUri || '',
    document: report['document-uri'] || report.documentURL || report.documentUri || '',
  };
}

function logReport(parsed) {
  const report = firstReport(parsed);
  if (!report) {
    return;
  }

  const directive = directiveOf(report.directive);
  const host = blockedHost(report.blocked);
  const path = documentPath(report.document);
  if (!directive && !host && !path) {
    return;
  }

  const limit = consumeRateLimit('csp-report', CSP_LOG_LIMIT, CSP_LOG_WINDOW_MS);
  if (!limit.allowed) {
    return;
  }

  console.error(
    `[csp-report] violated-directive=${directive || '-'} blocked-host=${host || '-'} document-path=${path || '-'}`
  );
}

function empty(response, status) {
  response.status(status).send('');
}

const BODY_READ_TIMEOUT_MS = 2000;

function toBuffer(chunk) {
  if (Buffer.isBuffer(chunk)) return chunk;
  if (chunk instanceof Uint8Array) return Buffer.from(chunk);
  if (typeof chunk === 'string') return Buffer.from(chunk);
  return Buffer.from(chunk);
}

function parsedFromChunks(chunks) {
  if (!chunks.length) return null;
  return parseBody(Buffer.concat(chunks).toString('utf8'));
}

// @vercel/node addHelpers runs serializeBody before the handler, then
// restoreBody re-exposes that buffer only through req.read() and
// req.on('data'|'end') (a PassThrough). The original stream is already
// readableEnded and destroyed, so `for await` yields nothing. These
// content types are not in getBodyParser, so req.body stays unset — do
// not read it. An already-ended stream will not emit data/end; pull
// req.read() instead. If nothing arrives, stop after 2s so the isolate
// cannot hang.
function readStream(request) {
  return new Promise((resolve) => {
    const chunks = [];
    let total = 0;
    let settled = false;
    let timer;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const push = (chunk) => {
      if (settled || chunk == null) return true;
      const buf = toBuffer(chunk);
      if (buf.length === 0) return false;
      if (total + buf.length > MAX_BODY_BYTES) {
        finish({ tooBig: true });
        return true;
      }
      total += buf.length;
      chunks.push(buf);
      return false;
    };

    const pullBuffered = () => {
      if (typeof request.read !== 'function') return;
      let guard = 0;
      let chunk = request.read();
      while (chunk != null && guard < 10000) {
        guard += 1;
        if (push(chunk)) return;
        chunk = request.read();
      }
    };

    if (request.readableEnded === true || request.complete === true) {
      try {
        pullBuffered();
      } catch {
        finish({ parsed: null });
        return;
      }
      if (!settled) finish({ parsed: parsedFromChunks(chunks) });
      return;
    }

    timer = setTimeout(() => {
      finish({ parsed: parsedFromChunks(chunks) });
    }, BODY_READ_TIMEOUT_MS);

    if (typeof request.on === 'function') {
      request.on('data', (chunk) => {
        push(chunk);
      });
      request.on('end', () => {
        if (!settled) finish({ parsed: parsedFromChunks(chunks) });
      });
      request.on('error', () => {
        if (!settled) finish({ parsed: null });
      });
    }
  });
}

async function readBody(request) {
  if (declaredLength(request) > MAX_BODY_BYTES) {
    return { tooBig: true };
  }

  if (isNodeStream(request)) {
    return readStream(request);
  }

  if (bodyByteLength(request.body) > MAX_BODY_BYTES) {
    return { tooBig: true };
  }
  return { parsed: parseBody(request.body) };
}

// Browsers do not reliably send Origin or Referer on CSP reports. Reporting
// API delivery sets the request origin, but its header list is only
// Content-Type: application/reports+json and its client is null. Legacy
// report-uri deliveries (Chromium PingLoader / no-cors, Firefox nsCSPContext)
// often omit both headers, so a missing Origin must not drop the report.
// A present Origin that is not on the steam allowlist is rejected. Referer
// is not a gate. The report is logged only when its own document-uri /
// documentURL origin passes isAllowedOrigin.
export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    empty(response, 405);
    return;
  }

  if (!ACCEPTED_TYPES.has(mediaType(request))) {
    empty(response, 415);
    return;
  }

  const origin = presentedOrigin(request);
  if (origin && !isAllowedOrigin(origin)) {
    empty(response, 204);
    return;
  }

  const body = await readBody(request);
  if (body.tooBig) {
    empty(response, 413);
    return;
  }

  if (!isAllowedOrigin(documentOrigin(body.parsed))) {
    empty(response, 204);
    return;
  }

  logReport(body.parsed);
  empty(response, 204);
}
