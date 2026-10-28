import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Ratelimit } from '@upstash/ratelimit';
import {
  CALL_TIMEOUT_MS,
  GLOBAL_PER_DAY,
  GLOBAL_WINDOW,
  MAX_TOKENS,
  MODEL_FALLBACK,
  MODEL_PRIMARY,
  TOKEN_WARN,
  VISITOR_PER_HOUR,
  VISITOR_WINDOW,
  createExcuseGates,
  handleExcuse,
  resetExcuseGatesForTests,
} from './excuse.js';
import {
  CACHE_KEY_PREFIX,
  buildExcusePayload,
  sanitizeExcuseLine,
  signalBrief,
  validateExcusePayload,
} from '../src/projects/captcha-hell/game/excusePayload.js';

const circleSignals = {
  roundness: 96,
  closureGap: 1,
  closureGapRatio: 0.02,
  wobble: 0.03,
  speed: 320,
  direction: 1,
  hesitationMs: 180,
  durationMs: 2100,
  pauseCount: 0,
  pointCount: 80,
  humanity: 95.9,
  required: 96,
};

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

function request(body, headers = {}) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-real-ip': '203.0.113.10', ...headers },
    body,
  };
}

function groqSuccess(text, { finish = 'stop', total = 40, model = MODEL_PRIMARY } = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model,
      choices: [{ finish_reason: finish, message: { content: text } }],
      usage: { prompt_tokens: 18, completion_tokens: total - 18, total_tokens: total },
    }),
  };
}

describe('validateExcusePayload', () => {
  it('accepts the numeric payload the client already builds', () => {
    const payload = buildExcusePayload('circle', circleSignals);
    expect(validateExcusePayload(payload).ok).toBe(true);
    const brief = signalBrief(payload);
    expect(brief.line.startsWith('circle:')).toBe(true);
    expect(brief.key.startsWith(`${CACHE_KEY_PREFIX}circle:`)).toBe(true);
    expect(brief.line).not.toContain('{');
  });

  it('rejects strings, NaN, and unknown methods', () => {
    const payload = buildExcusePayload('circle', circleSignals);
    expect(validateExcusePayload({ ...payload, note: 'typed hello' }).ok).toBe(false);
    expect(validateExcusePayload({ ...payload, speed: Number.NaN }).ok).toBe(false);
    expect(validateExcusePayload({ ...payload, round: 'circle' }).ok).toBe(false);
    expect(validateExcusePayload({ ...payload, round: 9 }).ok).toBe(false);
  });
});

describe('handleExcuse', () => {
  beforeEach(() => {
    resetExcuseGatesForTests();
    delete process.env.GROQ_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    resetExcuseGatesForTests();
  });

  it('returns 204 when the key is missing and does not call out', async () => {
    const fetchImpl = vi.fn();
    const response = mockResponse();
    await handleExcuse(request(buildExcusePayload('circle', circleSignals)), response, { fetchImpl });
    expect(response.statusCode).toBe(204);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('fails closed when Upstash is not configured', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const fetchImpl = vi.fn();
    const response = mockResponse();
    await handleExcuse(request(buildExcusePayload('cat', {
      strokeCount: 2,
      avgSpeed: 80,
      rhythmRegularity: 0.4,
      directionChanges: 1,
      meanGapMs: 200,
      zone: 2,
      timeToFirstTouchMs: 300,
      totalDistance: 40,
      purr: 10,
      pointCount: 6,
    })), response, { fetchImpl });
    expect(response.statusCode).toBe(204);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects an oversized body', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const response = mockResponse();
    await handleExcuse(request('x'.repeat(3000), { 'content-length': '3000' }), response, {
      fetchImpl: vi.fn(),
    });
    expect(response.statusCode).toBe(400);
  });

  it('blocks the 101st visitor call in an hour', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const fetchImpl = vi.fn(async () => groqSuccess('Wrist tremor, not a toolpath.'));
    let visitorCalls = 0;
    const gates = {
      redis: {
        async get() { return null; },
        async lrange() { return []; },
        async set() {},
        async rpush() {},
        async ltrim() {},
        async expire() {},
      },
      visitor: {
        async limit() {
          visitorCalls += 1;
          return { success: visitorCalls <= VISITOR_PER_HOUR };
        },
      },
      global: { async limit() { return { success: true }; } },
    };
    for (let index = 0; index < VISITOR_PER_HOUR; index += 1) {
      const response = mockResponse();
      const payload = buildExcusePayload('circle', { ...circleSignals, roundness: index * 10 });
      await handleExcuse(request(payload), response, { fetchImpl, gates });
      expect(response.statusCode).toBe(200);
    }
    const blocked = mockResponse();
    await handleExcuse(
      request(buildExcusePayload('circle', { ...circleSignals, roundness: VISITOR_PER_HOUR * 10 })),
      blocked,
      { fetchImpl, gates },
    );
    expect(blocked.statusCode).toBe(204);
    expect(fetchImpl).toHaveBeenCalledTimes(VISITOR_PER_HOUR);
  });

  it('tries gpt-oss-120b once when gpt-oss-20b is rate limited', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const models = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      const model = JSON.parse(init.body).model;
      models.push(model);
      if (model === MODEL_PRIMARY) {
        return { ok: false, status: 429, json: async () => ({}) };
      }
      return groqSuccess('A steady radius is not a pulse.', { model });
    });
    const response = mockResponse();
    await handleExcuse(request(buildExcusePayload('circle', circleSignals)), response, {
      fetchImpl,
      gates: openGates(),
    });
    expect(models).toEqual([MODEL_PRIMARY, MODEL_FALLBACK]);
    expect(response.statusCode).toBe(200);
    expect(response.body).toContain('steady radius');
  });

  it('does not try a third call when the fallback model is also limited', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }));
    const response = mockResponse();
    await handleExcuse(request(buildExcusePayload('circle', circleSignals)), response, {
      fetchImpl,
      gates: openGates(),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(response.statusCode).toBe(429);
  });

  it('falls back when the reply is empty or cut off by the token cap', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(groqSuccess('', { finish: 'stop' }))
      .mockResolvedValueOnce(groqSuccess('This line was cut', { finish: 'length', total: 380 }));
    const empty = mockResponse();
    await handleExcuse(request(buildExcusePayload('circle', circleSignals)), empty, {
      fetchImpl,
      gates: openGates(),
    });
    expect(empty.statusCode).toBe(204);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const cut = mockResponse();
    await handleExcuse(
      request(buildExcusePayload('circle', { ...circleSignals, roundness: 40 })),
      cut,
      { fetchImpl, gates: openGates() },
    );
    expect(cut.statusCode).toBe(204);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    const logs = [...info.mock.calls, ...warn.mock.calls].flat().join(' ');
    expect(logs).toMatch(/prompt=18 completion=362 total=380/);
    expect(logs).toMatch(new RegExp(`token total 380 exceeds ${TOKEN_WARN}`));
    expect(TOKEN_WARN).toBe(350);
    expect(logs).not.toContain('gsk_test_only');
    expect(logs).not.toContain('203.0.113.10');
  });

  it('sends the compact line once and reuses a cached bucket', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const bodies = [];
    const fetchImpl = vi.fn(async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      expect(init.signal).toBeInstanceOf(AbortSignal);
      return groqSuccess('Close, and still a machine.');
    });
    const gates = openGates();
    const payload = buildExcusePayload('circle', circleSignals);
    const first = mockResponse();
    await handleExcuse(request(payload), first, { fetchImpl, gates });
    const second = mockResponse();
    await handleExcuse(request(payload), second, { fetchImpl, gates });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(bodies[0].max_tokens).toBe(MAX_TOKENS);
    expect(MAX_TOKENS).toBe(200);
    expect(bodies[0].reasoning_effort).toBe('low');
    expect(bodies[0].stream).toBe(false);
    expect(bodies[0].messages[1].content).toBe(signalBrief(payload).line);
    expect(bodies[0].messages[1].content).not.toContain('m=circle');
    expect(bodies[0].messages[1].content).not.toContain('{');
    expect(bodies[1].messages[1].content).toBe(signalBrief(payload).line);
    expect(CALL_TIMEOUT_MS).toBe(1200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fills a gesture bucket to 8 lines and then serves the pool', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const words = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];
    let count = 0;
    const fetchImpl = vi.fn(async () => groqSuccess(`Firmware rejected the ${words[count++]} attempt.`));
    const gates = openGates();
    const payload = buildExcusePayload('circle', circleSignals);
    for (let index = 0; index < 8; index += 1) {
      const response = mockResponse();
      await handleExcuse(request(payload), response, { fetchImpl, gates, random: () => 0 });
      expect(response.statusCode).toBe(200);
    }
    expect(fetchImpl).toHaveBeenCalledTimes(8);
    const pooled = mockResponse();
    await handleExcuse(request(payload), pooled, { fetchImpl, gates, random: () => 0.99 });
    expect(fetchImpl).toHaveBeenCalledTimes(8);
    expect(JSON.parse(pooled.body).text).toBe('Firmware rejected the hotel attempt.');
  });

  it('serves a pooled line when the visitor cap is already hit', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const fetchImpl = vi.fn();
    const payload = buildExcusePayload('circle', circleSignals);
    const key = signalBrief(payload).key;
    const gates = openGates(new Map([[key, ['First saved roast.', 'Second saved roast.']]]));
    gates.visitor = { async limit() { return { success: false }; } };
    const response = mockResponse();
    await handleExcuse(request(payload), response, { fetchImpl, gates, random: () => 0 });
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).text).toBe('First saved roast.');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('keeps separate pools for different gesture buckets', async () => {
    process.env.GROQ_API_KEY = 'gsk_test_only';
    const pushed = [];
    const gates = openGates();
    const original = gates.redis.rpush.bind(gates.redis);
    gates.redis.rpush = async (key, value) => {
      pushed.push(key);
      return original(key, value);
    };
    const fetchImpl = vi.fn(async () => groqSuccess('Too neat for a living wrist.'));
    await handleExcuse(
      request(buildExcusePayload('circle', { ...circleSignals, roundness: 12 })),
      mockResponse(),
      { fetchImpl, gates },
    );
    await handleExcuse(
      request(buildExcusePayload('circle', { ...circleSignals, roundness: 88 })),
      mockResponse(),
      { fetchImpl, gates },
    );
    expect(pushed).toHaveLength(2);
    expect(pushed[0]).not.toBe(pushed[1]);
    expect(pushed[0].startsWith(`${CACHE_KEY_PREFIX}circle:`)).toBe(true);
    expect(pushed[1].startsWith(`${CACHE_KEY_PREFIX}circle:`)).toBe(true);
    expect(signalBrief(buildExcusePayload('circle', { ...circleSignals, roundness: 12 })).key)
      .not.toBe(signalBrief(buildExcusePayload('circle', { ...circleSignals, roundness: 88 })).key);
  });

  it('configures 100 roasts an hour and a global cap of 600', () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
    const sliding = vi.spyOn(Ratelimit, 'slidingWindow');
    const fixed = vi.spyOn(Ratelimit, 'fixedWindow');
    expect(createExcuseGates()).not.toBeNull();
    expect(sliding).toHaveBeenCalledWith(VISITOR_PER_HOUR, VISITOR_WINDOW);
    expect(fixed).toHaveBeenCalledWith(GLOBAL_PER_DAY, GLOBAL_WINDOW);
    expect(VISITOR_PER_HOUR).toBe(100);
    expect(GLOBAL_PER_DAY).toBe(600);
  });
});

describe('signal words and sanitizer', () => {
  it('describes gestures in plain words and changes the bucket when the numbers change', () => {
    const low = signalBrief(buildExcusePayload('circle', { ...circleSignals, roundness: 12, wobble: 0.4 }));
    const high = signalBrief(buildExcusePayload('circle', { ...circleSignals, roundness: 88, wobble: 0.01 }));
    expect(low.line).toMatch(/^circle: roundness \d+%/);
    expect(low.line).toContain('wobbly');
    expect(high.line).toContain('steady');
    expect(low.key).not.toBe(high.key);
    expect(low.key).not.toBe(`${CACHE_KEY_PREFIX}circle`);
    const cat = signalBrief(buildExcusePayload('cat', {
      strokeCount: 3,
      avgSpeed: 40,
      rhythmRegularity: 0.9,
      directionChanges: 0,
      meanGapMs: 100,
      zone: 2,
      timeToFirstTouchMs: 4000,
      totalDistance: 20,
      purr: 5,
      pointCount: 4,
    }));
    expect(cat.line).toMatch(/^cat: stroked the belly 3 times/);
    expect(cat.line).toContain('hesitated');
    expect(cat.key.startsWith(`${CACHE_KEY_PREFIX}cat:`)).toBe(true);
  });

  it('rejects digits, URLs, and empty lines, and keeps wording from the prompt', () => {
    expect(sanitizeExcuseLine('Circle radius 0.6, time 2.5, jump 0.3.')).toBe('');
    expect(sanitizeExcuseLine('See https://evil.example/roast')).toBe('');
    expect(sanitizeExcuseLine('   ')).toBe('');
    expect(sanitizeExcuseLine('')).toBe('');
    expect(sanitizeExcuseLine('The roundness was wobbly for several seconds.')).toBe(
      'The roundness was wobbly for several seconds.',
    );
    expect(sanitizeExcuseLine('Too mechanical to trust.')).toBe('Too mechanical to trust.');
  });
});

function openGates(lists = new Map()) {
  const values = new Map();
  return {
    redis: {
      async get(key) { return values.get(key) ?? null; },
      async set(key, value) { values.set(key, value); },
      async rpush(key, value) {
        const list = lists.get(key) ?? [];
        list.push(value);
        lists.set(key, list);
      },
      async ltrim(key, start) {
        const list = lists.get(key) ?? [];
        lists.set(key, list.slice(start));
      },
      async lrange(key) { return [...(lists.get(key) ?? [])]; },
      async expire() {},
    },
    visitor: { async limit() { return { success: true }; } },
    global: { async limit() { return { success: true }; } },
  };
}
