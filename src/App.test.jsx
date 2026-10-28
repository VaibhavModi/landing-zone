import { readFileSync } from 'node:fs';
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

  it('renders the projects gallery and links into captcha hell', async () => {
    renderAt('/projects');
    expect(await screen.findByRole('heading', { name: /things i built to make you smile/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /secure my website/i })).toHaveAttribute('href', '/projects/captcha-hell');
    expect(screen.getAllByText(/more experiments loading/i)).toHaveLength(2);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
      .toBe('https://www.vaibhavmodi.com/projects');
  });

  it('renders the captcha chooser without the punchline', async () => {
    renderAt('/projects/captcha-hell/');
    expect(await screen.findByRole('heading', { name: /human verification, reimagined with ai/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /verify you're human/i })).toBeInTheDocument();
    expect(screen.getByText(/a parody project by vaibhav/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /officially a robot/i })).not.toBeInTheDocument();
    expect(document.title).toMatch(/Captcha Hell/);
  });

  it('links projects from the home nav', () => {
    renderAt('/');
    expect(screen.getByRole('link', { name: 'Projects' })).toHaveAttribute('href', '/projects');
  });

  it('does not preload the captcha game from the home loaders', async () => {
    const source = readFileSync('src/App.jsx', 'utf8');
    const loaders = source.match(/const routeLoaders = \{[\s\S]*?\};/);
    expect(loaders?.[0]).not.toMatch(/captcha|ProjectsPage/);
    const projects = readFileSync('src/projects/ProjectsPage.jsx', 'utf8');
    expect(projects).not.toMatch(/captcha-hell\/game|scoreCircle|selectCannedExcuse/);
  });

  it('404s unknown project paths', async () => {
    renderAt('/projects/other');
    expect(await screen.findByRole('heading', { name: 'This doorway does not exist.' })).toBeInTheDocument();
  });

  it('renders the in-app 404 without a canonical', async () => {
    renderAt('/this-page-is-missing');
    expect(await screen.findByRole('heading', { name: 'This doorway does not exist.' })).toBeInTheDocument();
    expect(document.querySelector('link[rel="canonical"]')).toBeNull();
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex');
  });
});
