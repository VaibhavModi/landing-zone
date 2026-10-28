import { createHash } from 'node:crypto';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { clientIp } from './rate-limit.js';
import {
  MAX_EXCUSE_BODY_BYTES,
  signalLine,
  usableModelLine,
  validateExcusePayload,
} from '../src/projects/captcha-hell/game/excusePayload.js';

export const VISITOR_PER_HOUR = 3;
export const VISITOR_WINDOW = '1 h';
export const GLOBAL_PER_DAY = 600;
export const GLOBAL_WINDOW = '1 d';
export const POOL_SIZE = 8;
export const CACHE_TTL_SECONDS = 6 * 60 * 60;
export const CALL_TIMEOUT_MS = 1200;
export const MAX_TOKENS = 120;
export const TOKEN_WARN = 300;
export const MODEL_PRIMARY = 'openai/gpt-oss-20b';
export const MODEL_FALLBACK = 'openai/gpt-oss-120b';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = [
  'Dry PG gatekeeper. One sentence, 140 characters max, plain text, no URL.',
  'Do not mention AI or a rigged test. Use only the numbers.',
].join('\n');

let cachedGates;

export function resetExcuseGatesForTests() {
  cachedGates = undefined;
}

export function createExcuseGates() {
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) return null;
  const redis = Redis.fromEnv();
  return {
    redis,
    visitor: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(VISITOR_PER_HOUR, VISITOR_WINDOW),
      prefix: 'excuse:h',
      analytics: false,
    }),
    global: new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(GLOBAL_PER_DAY, GLOBAL_WINDOW),
      prefix: 'excuse:g',
      analytics: false,
    }),
  };
}

function loadGates(deps) {
  if (deps.gates !== undefined) return deps.gates;
  if (cachedGates === undefined) cachedGates = createExcuseGates();
  return cachedGates;
}

function visitorHash(request) {
  return createHash('sha256').update(clientIp(request)).digest('hex');
}

function byteLength(body) {
  if (body == null) return 0;
  if (typeof body === 'string') return Buffer.byteLength(body);
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return body.byteLength;
  try {
    return Buffer.byteLength(JSON.stringify(body));
  } catch {
    return MAX_EXCUSE_BODY_BYTES + 1;
  }
}

function declaredLength(request) {
  const raw = request?.headers?.['content-length'] ?? request?.headers?.['Content-Length'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return 0;
  const size = Number(value);
  if (!Number.isFinite(size) || size < 0) return MAX_EXCUSE_BODY_BYTES + 1;
  return size;
}

function parseBody(body) {
  if (body == null || body === '') return null;
  if (typeof body === 'string' || Buffer.isBuffer(body) || body instanceof Uint8Array) {
    const text = typeof body === 'string' ? body : Buffer.from(body).toString('utf8');
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (typeof body === 'object') return body;
  return null;
}

function send(response, status, body) {
  response.status(status);
  response.setHeader('content-type', status === 204 ? 'text/plain' : 'application/json');
  response.setHeader('cache-control', 'private, no-store');
  if (status === 204) {
    response.send('');
    return;
  }
  response.send(JSON.stringify(body));
}

function logUsage(model, usage) {
  const prompt = Number(usage?.prompt_tokens);
  const completion = Number(usage?.completion_tokens);
  const total = Number(usage?.total_tokens);
  if (!Number.isFinite(prompt) || !Number.isFinite(completion) || !Number.isFinite(total)) return;
  console.info(`[excuse] model=${model} prompt=${prompt} completion=${completion} total=${total}`);
  if (total > TOKEN_WARN) {
    console.warn(`[excuse] token total ${total} exceeds ${TOKEN_WARN}`);
  }
}

async function callModel(fetchImpl, apiKey, model, line) {
  const response = await fetchImpl(GROQ_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      max_tokens: MAX_TOKENS,
      reasoning_effort: 'low',
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: line },
      ],
    }),
    signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
  });
  if (response.status === 429) return { status: 429 };
  if (!response.ok) return { status: response.status || 502 };
  const data = await response.json();
  logUsage(model, data?.usage);
  const choice = data?.choices?.[0];
  const text = usableModelLine(choice?.message?.content, choice?.finish_reason);
  return text ? { status: 200, text } : { status: 204 };
}

async function readCached(redis, bucket) {
  const hit = await redis.get(bucket.key);
  if (typeof hit === 'string' && hit.trim()) return hit.trim();
  const pool = await redis.lrange(`excuse:pool:${bucket.method}`, 0, POOL_SIZE - 1);
  if (!Array.isArray(pool) || pool.length === 0) return '';
  let hash = 0;
  for (let index = 0; index < bucket.key.length; index += 1) {
    hash = (hash * 33 + bucket.key.charCodeAt(index)) >>> 0;
  }
  const line = pool[hash % pool.length];
  return typeof line === 'string' ? line.trim() : '';
}

async function storeCached(redis, bucket, text) {
  await redis.set(bucket.key, text, { ex: CACHE_TTL_SECONDS });
  const poolKey = `excuse:pool:${bucket.method}`;
  await redis.rpush(poolKey, text);
  await redis.ltrim(poolKey, -POOL_SIZE, -1);
  await redis.expire(poolKey, CACHE_TTL_SECONDS);
}

async function allowCall(gates, request) {
  const hash = visitorHash(request);
  const visitor = await gates.visitor.limit(hash);
  if (!visitor?.success) return false;
  const global = await gates.global.limit('global');
  return Boolean(global?.success);
}

export async function handleExcuse(request, response, deps = {}) {
  if (request.method === 'OPTIONS') {
    send(response, 204);
    return;
  }
  if (request.method !== 'POST') {
    send(response, 405, { error: 'method' });
    return;
  }
  if (declaredLength(request) > MAX_EXCUSE_BODY_BYTES || byteLength(request.body) > MAX_EXCUSE_BODY_BYTES) {
    send(response, 400, { error: 'invalid' });
    return;
  }
  const parsed = parseBody(request.body);
  const validated = validateExcusePayload(parsed);
  if (!validated.ok) {
    send(response, 400, { error: 'invalid' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    send(response, 204);
    return;
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const gates = loadGates(deps);
  if (!gates) {
    send(response, 204);
    return;
  }

  const bucket = signalLine(validated.payload);
  try {
    const cached = await readCached(gates.redis, bucket);
    if (cached) {
      send(response, 200, { text: cached });
      return;
    }
  } catch {
    send(response, 204);
    return;
  }

  let allowed = false;
  try {
    allowed = await allowCall(gates, request);
  } catch {
    send(response, 204);
    return;
  }
  if (!allowed) {
    send(response, 429, { error: 'rate-limited' });
    return;
  }

  try {
    let result = await callModel(fetchImpl, apiKey, MODEL_PRIMARY, bucket.line);
    if (result.status === 429) {
      result = await callModel(fetchImpl, apiKey, MODEL_FALLBACK, bucket.line);
    }
    if (result.status !== 200 || !result.text) {
      send(response, result.status === 429 ? 429 : 204);
      return;
    }
    try {
      await storeCached(gates.redis, bucket, result.text);
    } catch {
      // The line is still usable if the cache write fails.
    }
    send(response, 200, { text: result.text });
  } catch {
    console.error('[excuse] call failed');
    send(response, 204);
  }
}

export default function handler(request, response) {
  return handleExcuse(request, response);
}
