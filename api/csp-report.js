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

function reportOrigin(request) {
  const origin = readHeader(request, 'origin').trim();
  if (origin) {
    return origin;
  }

  const referer = readHeader(request, 'referer').trim() || readHeader(request, 'referrer').trim();
  if (!referer) {
    return '';
  }

  try {
    return new URL(referer).origin;
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

export default function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    empty(response, 405);
    return;
  }

  if (!ACCEPTED_TYPES.has(mediaType(request))) {
    empty(response, 415);
    return;
  }

  if (declaredLength(request) > MAX_BODY_BYTES || bodyByteLength(request.body) > MAX_BODY_BYTES) {
    empty(response, 413);
    return;
  }

  if (!isAllowedOrigin(reportOrigin(request))) {
    empty(response, 204);
    return;
  }

  logReport(parseBody(request.body));
  empty(response, 204);
}
