import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import VerificationFlow from './VerificationFlow.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    status: 204,
    json: async () => ({}),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function drawCircle() {
  fireEvent.click(screen.getByRole('button', { name: /draw a perfect circle/i }));
  fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
  const pad = screen.getByRole('application', { name: /circle canvas/i });
  ['ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowLeft', 'ArrowUp', 'ArrowUp']
    .forEach((key) => fireEvent.keyDown(pad, { key }));
  fireEvent.keyDown(pad, { key: 'Enter' });
}

function petCat() {
  fireEvent.click(screen.getByRole('button', { name: /pet the cat/i }));
  fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
  const cat = screen.getByRole('application', { name: /cat/i });
  fireEvent.keyDown(cat, { key: ' ' });
  fireEvent.keyUp(cat, { key: ' ' });
  const done = screen.getByRole('button', { name: /done petting/i });
  expect(done).toBeEnabled();
  fireEvent.click(done);
}

describe('captcha hell flow', () => {
  it('starts on the chooser and does not spoil the result', () => {
    render(<VerificationFlow />);
    expect(screen.getByRole('heading', { name: /verify you're human/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /draw a perfect circle/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /pet the cat/i })).toBeInTheDocument();
    expect(screen.getByText(/precision check/i)).toBeInTheDocument();
    expect(screen.getByText(/empathy check/i)).toBeInTheDocument();
    expect(screen.getByText(/retina scan/i)).toBeInTheDocument();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retina/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /officially a robot/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/inconclusive/i)).not.toBeInTheDocument();
    expect(document.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
  });

  it('rejects one method, returns to the remaining one, then unlocks the certificate', () => {
    render(<VerificationFlow />);
    drawCircle();
    expect(screen.getByText(/humanity:/i)).toBeInTheDocument();
    expect(screen.getByText(/required:/i)).toBeInTheDocument();
    expect(screen.getByText(/not human/i)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /analyzing your circle/i })).toHaveFocus();
    const again = screen.getByRole('button', { name: /^try again$/i });
    const different = screen.getByRole('button', { name: /try different challenge/i });
    expect(again.tabIndex).toBe(0);
    expect(different.tabIndex).toBe(0);
    expect(again.compareDocumentPosition(different) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    again.focus();
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    again.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(false);
    different.focus();
    const space = new KeyboardEvent('keyup', { key: ' ', bubbles: true, cancelable: true });
    different.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    fireEvent.click(different);
    expect(screen.getAllByText(/inconclusive. please try another method/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /draw a perfect circle/i })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: /pet the cat/i })).not.toHaveAttribute('aria-disabled');
    expect(screen.getByRole('button', { name: /get your certificate anyway/i })).toBeInTheDocument();

    petCat();
    const skip = screen.getByRole('button', { name: /skip to my certificate/i });
    expect(skip.tabIndex).toBe(0);
    skip.focus();
    const skipKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    skip.dispatchEvent(skipKey);
    expect(skipKey.defaultPrevented).toBe(false);
    fireEvent.click(skip);
    expect(screen.getByRole('heading', { name: /officially a robot/i })).toBeInTheDocument();
    expect(screen.getByText(/congratulations, you are a robot. please don't install this/i)).toBeInTheDocument();
    const share = screen.getByRole('link', { name: /share on x/i });
    expect(share.getAttribute('href')).toMatch(/^https:\/\/x\.com\/intent\/post\?text=/);
    expect(decodeURIComponent(share.getAttribute('href'))).not.toMatch(/typed|textarea|<input/i);
    expect(document.querySelector('input, textarea')).toBeNull();
  });

  it('can stop after one method and still take the certificate', () => {
    render(<VerificationFlow />);
    drawCircle();
    fireEvent.click(screen.getByRole('button', { name: /try different challenge/i }));
    fireEvent.click(screen.getByRole('button', { name: /get your certificate anyway/i }));
    expect(screen.getByRole('heading', { name: /officially a robot/i })).toBeInTheDocument();
  });

  it('accepts a pointer stroke, including a stylus, on the circle', () => {
    render(<VerificationFlow />);
    fireEvent.click(screen.getByRole('button', { name: /^start$/i }));
    const pad = screen.getByRole('application', { name: /circle canvas/i });
    const pointer = { pointerId: 1, pointerType: 'pen', button: 0 };
    fireEvent.pointerDown(pad, { ...pointer, clientX: 150, clientY: 40 });
    fireEvent.pointerMove(pad, { ...pointer, clientX: 240, clientY: 150 });
    fireEvent.pointerMove(pad, { ...pointer, clientX: 150, clientY: 280 });
    fireEvent.pointerMove(pad, { ...pointer, clientX: 60, clientY: 150 });
    fireEvent.pointerUp(pad, { ...pointer, clientX: 150, clientY: 50 });
    expect(screen.getByText(/humanity:/i)).toBeInTheDocument();
  });
});
