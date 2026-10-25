import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({
      showcaseGames: [
        { appid: 730, name: 'Counter-Strike 2', recentlyPlayed: false },
      ],
    }),
  })));
});

function renderAt(path) {
  window.history.pushState({}, '', path);
  return render(<App />);
}

describe('routes', () => {
  it('renders the home gateway', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: 'Choose a way in.' })).toBeInTheDocument();
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://www.vaibhavmodi.com/');
  });

  it('renders the recruiter page and the missing-key message', async () => {
    renderAt('/recruiter');
    expect(await screen.findByRole('heading', { name: /On AWS - ATX Refactor/ })).toBeInTheDocument();
    const resume = screen.getByRole('button', { name: 'click to open resume' });
    expect(resume).toHaveAccessibleName('click to open resume');
    expect(resume).not.toHaveAttribute('aria-label');
    expect(resume.textContent).not.toMatch(/open resume preview/i);
    const header = document.querySelector('.header-photo');
    expect(header).toHaveAttribute('width', '128');
    expect(header).toHaveAttribute('height', '128');
    expect(header.getAttribute('src')).toContain('profile-portrait-header-128-v2.png');
    expect(header.getAttribute('srcset')).toContain('profile-portrait-header-64-v2.png 64w');
    expect(screen.getByText(/contact form is not available right now/i)).toBeInTheDocument();
  });

  it('renders the friend page from the steam payload', async () => {
    renderAt('/friend/');
    expect(await screen.findByRole('heading', { name: /Games I'm currently playing/ })).toBeInTheDocument();
    expect(await screen.findByText('Counter-Strike 2')).toBeInTheDocument();
  });

  it('renders the in-app 404 without a canonical', async () => {
    renderAt('/this-page-is-missing');
    expect(await screen.findByRole('heading', { name: 'This doorway does not exist.' })).toBeInTheDocument();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
