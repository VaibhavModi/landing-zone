export const EXCUSE_WAIT_MS = 2500;
export const ANALYZING_LABEL = 'Analyzing behavioral signature…';

/**
 * One POST of numeric signals to /api/excuse.
 * Resolves to a line, or null when the call misses the wait, errors, or is empty.
 * Never retries.
 */
export function requestExcuseLine(payload, {
  fetchImpl = globalThis.fetch,
  waitMs = EXCUSE_WAIT_MS,
  signal,
} = {}) {
  if (signal?.aborted) return Promise.resolve(null);
  const controller = new AbortController();
  let settled = false;
  let timer = 0;

  const finish = (resolve, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    resolve(value);
  };

  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  return new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      finish(resolve, null);
    }, waitMs);

    fetchImpl('/api/excuse', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).then(async (response) => {
      if (signal?.aborted || !response || response.status === 204 || !response.ok) {
        finish(resolve, null);
        return;
      }
      let data = null;
      try {
        data = await response.json();
      } catch {
        data = null;
      }
      const text = data && typeof data.text === 'string' ? data.text.trim() : '';
      if (!text || text.length > 140 || /https?:\/\/|www\./i.test(text)) {
        finish(resolve, null);
        return;
      }
      finish(resolve, text);
    }).catch(() => {
      finish(resolve, null);
    });
  });
}
