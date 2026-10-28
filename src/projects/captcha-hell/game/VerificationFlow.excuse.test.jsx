import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import VerificationFlow from './VerificationFlow.jsx';

function drawCircle() {
  fireEvent.click(screen.getByRole('button', { name: /draw a perfect circle/i }));
  fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
  const pad = screen.getByRole('application', { name: /circle canvas/i });
  ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']
    .forEach((key) => fireEvent.keyDown(pad, { key }));
  fireEvent.keyDown(pad, { key: 'Enter' });
}

function reachFinalRound() {
  drawCircle();
  fireEvent.click(screen.getByRole('button', { name: /try another method/i }));
  fireEvent.click(screen.getByRole('button', { name: /pet the cat/i }));
  fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
  const cat = screen.getByRole('application', { name: /cat/i });
  fireEvent.keyDown(cat, { key: ' ' });
  fireEvent.keyUp(cat, { key: ' ' });
  fireEvent.click(screen.getByRole('button', { name: /done petting/i }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('final rejection excuse', () => {
  it('shows the pre-written line on the first round and does not call the api', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow />);
    drawCircle();
    expect(screen.queryByText(/analyzing behavioral signature/i)).not.toBeInTheDocument();
    expect(screen.getByText(/humanity:/i)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the analyzing line, then the AI line, from a single call', async () => {
    let resolveFetch;
    const fetchMock = vi.fn((_url, init) => new Promise((resolve) => {
      resolveFetch = () => resolve({
        ok: true,
        status: 200,
        json: async () => ({ text: 'Plotted, not pulsed.' }),
      });
      init.signal.addEventListener('abort', () => resolve({ ok: false, status: 499, json: async () => ({}) }));
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow />);
    reachFinalRound();
    expect(screen.getAllByText(/analyzing behavioral signature/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status').textContent).toMatch(/analyzing behavioral signature/i);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(Object.values(body).every((value) => typeof value === 'number')).toBe(true);
    await act(async () => {
      resolveFetch();
    });
    expect(screen.getAllByText('Plotted, not pulsed.').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/analyzing behavioral signature/i)).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('shows the pre-written line when nothing arrives in 2.5s', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow />);
    reachFinalRound();
    expect(screen.getAllByText(/analyzing behavioral signature/i).length).toBeGreaterThan(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });
    expect(screen.queryAllByText(/analyzing behavioral signature/i)).toHaveLength(0);
    expect(document.querySelector('.ch-verdict__slot').textContent.trim().length).toBeGreaterThan(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry after a 429', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: 'rate-limited' }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    render(<VerificationFlow />);
    reachFinalRound();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryAllByText(/analyzing behavioral signature/i)).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
