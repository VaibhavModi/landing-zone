import { lazy, Suspense, useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

const SITE_URL = 'https://www.vaibhavmodi.com';

const routeMeta = {
  home: {
    title: 'Vaibhav Modi: Landing Zone',
    description:
      'Vaibhav Modi is a software engineer and curious builder creating thoughtful, human digital experiences.',
  },
  recruiter: {
    title: 'Vaibhav Modi · Recruiter',
    description:
      'A direct look at Vaibhav Modi\'s work, how he thinks, and how to get in touch.',
  },
  friend: {
    title: 'Vaibhav Modi · Friend',
    description: 'Games Vaibhav Modi has been spending time with lately.',
  },
  'not-found': {
    title: 'Vaibhav Modi · Page not found',
    description: 'That page is not part of Vaibhav Modi\'s site.',
  },
};

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function upsertCanonical(href) {
  let element = document.head.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', href);
}

function normalizePathname(pathname) {
  if (pathname.length > 1) {
    return pathname.replace(/\/+$/, '');
  }
  return pathname;
}

function Portrait({ alt, className, priority = false }) {
  return (
    <picture>
      <source srcSet="/images/profile-portrait.avif" type="image/avif" />
      <source srcSet="/images/profile-portrait.webp" type="image/webp" />
      <img
        src="/images/profile-portrait.png"
        alt={alt}
        className={className}
        width="500"
        height="666"
        decoding="async"
        // eslint-disable-next-line react/no-unknown-property -- React 18.2 only forwards the lowercase attribute
        fetchpriority={priority ? 'high' : 'auto'}
      />
    </picture>
  );
}


const loadRecruiterPage = () => import('./gateways/RecruiterPage.jsx');
const loadFriendPage = () => import('./gateways/FriendPage.jsx');

const RecruiterPage = lazy(loadRecruiterPage);
const FriendPage = lazy(loadFriendPage);

const gateways = {
  recruiter: {
    label: 'Recruiter',
    button: 'Recruiter',
    detail:
      'A direct way into my work, how I think, and the practical signals that matter when you are hiring.',
    accent: 'cyan',
    shortcut: 'R',
  },
  friend: {
    label: 'Friend',
    button: 'Friend',
    detail: 'A softer route through side quests, shared context, and the things I am into right now.',
    accent: 'gold',
    shortcut: 'F',
  },
};

const gatewayOrder = ['recruiter', 'friend'];
const validViews = new Set(['home', ...gatewayOrder]);
const routeComponents = {
  recruiter: RecruiterPage,
  friend: FriendPage,
};
const routeLoaders = {
  recruiter: loadRecruiterPage,
  friend: loadFriendPage,
};

function Header({ activeView, goHome, switchLens }) {
  const routeOpen = activeView === 'recruiter' || activeView === 'friend';

  const handleHomeClick = (event) => {
    event.preventDefault();
    goHome();
  };

  return (
    <header className={`topbar${routeOpen ? ' topbar--compact' : ''}`}>
      <a className="brand-lockup brand-lockup-link" href="/" onClick={handleHomeClick}>
        <span className={routeOpen ? 'header-photo-frame header-photo-frame--active' : 'header-photo-frame'}>
          <span className={routeOpen ? 'header-photo-wrap is-visible' : 'header-photo-wrap'} aria-hidden="true">
            <Portrait alt="" className="header-photo" />
          </span>
        </span>
        <span className="brand">vaibhav modi</span>
      </a>

      {routeOpen && (
        <nav className="lens-toggle" aria-label="Switch view">
          {gatewayOrder.map((key) => (
            <button
              key={key}
              className={`lens-btn${activeView === key ? ` lens-btn--active lens-btn--${gateways[key].accent}` : ''}`}
              onClick={() => switchLens(key)}
              type="button"
              aria-pressed={activeView === key}
            >
              {gateways[key].label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

function HomeFrame({ openView }) {
  const [hoveredGateway, setHoveredGateway] = useState(null);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const map = { r: 'recruiter', f: 'friend' };
      const match = map[e.key.toLowerCase()];
      if (match) openView(match);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [openView]);

  return (
    <section className="route-frame route-frame--home">
      <div className="route-frame__inner route-frame__inner--home">
        <section className="operator-layout">
          <div className="photo-panel" aria-label="Profile photo">
            <div className="photo-ring">
              <div className="photo-placeholder">
                <Portrait
                  alt="Portrait of Vaibhav Modi"
                  className="profile-photo"
                  priority
                />
              </div>
            </div>
            <p className="home-factline">
              <span className="home-factline__label">fun fact</span>
              Did you know Earth&apos;s moon is the only moon without a name?
            </p>
            <p className="currently-line">
              <span className="currently-label">Currently →</span>
              {' '}Engineering at Amazon Web Services
            </p>
          </div>

          <div className="content-panel">
            <div className="operator-copy">
              <p className="eyebrow">Software engineer & a curious builder</p>
              <p className="intro-bio">
                I build software, care deeply about thoughtful experiences, and
                like making digital spaces feel a little more human than they need to be.
              </p>
              <h1>
                Choose a way in.
              </h1>
            </div>

            <section className="gateway-console">
              <nav className="gateway-actions" aria-label="Gateway paths">
                {gatewayOrder.map((key) => {
                  const gateway = gateways[key];
                  return (
                    <button
                      key={key}
                      className={`gateway-button gateway-button--${gateway.accent}`}
                      onClick={() => openView(key)}
                      onMouseEnter={() => setHoveredGateway(key)}
                      onMouseLeave={() => setHoveredGateway(null)}
                      type="button"
                    >
                      {gateway.button}
                      <kbd className="gateway-key">{gateway.shortcut}</kbd>
                    </button>
                  );
                })}
              </nav>
              <p className={`gateway-detail${hoveredGateway ? ' gateway-detail--visible' : ''}`}>
                {hoveredGateway ? gateways[hoveredGateway].detail : '\u00A0'}
              </p>
            </section>
          </div>
        </section>
      </div>
    </section>
  );
}

function RouteFrame({ view, goHome }) {
  const selectedGateway = gateways[view];
  const RoutePage = routeComponents[view];

  return (
    <section className={`route-frame route-frame--${selectedGateway.accent}`}>
      <div className="route-frame__inner">
        <Suspense
          fallback={
            <>
              <p className="eyebrow">Loading</p>
              <h1>{selectedGateway.label} page</h1>
              <p className="route-copy">Loading this doorway...</p>
            </>
          }
        >
          <RoutePage goHome={goHome} />
        </Suspense>
      </div>
    </section>
  );
}

function NotFoundFrame({ goHome }) {
  return (
    <section className="route-frame">
      <div className="route-frame__inner">
        <p className="eyebrow">404</p>
        <h1>This doorway does not exist.</h1>
        <p className="route-copy">
          The page you asked for is not part of the landing zone.
        </p>
        <div className="route-actions">
          <button className="ghost-button" type="button" onClick={goHome}>
            Back home
          </button>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const isLocal = () => /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
  return (
    <footer className="site-footer">
      <div className="footer-stack">
        <nav className="footer-links" aria-label="Social links">
          <a className="footer-link" href="https://github.com/vaibhavmodi" target="_blank" rel="noreferrer"
            onClick={() => !isLocal() && window.gtag?.('event', 'social_click', { platform: 'github', transport_type: 'beacon' })}>
            <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.216.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            <span>github</span>
          </a>
          <span className="footer-dot" aria-hidden="true">·</span>
          <a className="footer-link" href="https://www.linkedin.com/in/vaibhavmodir/" target="_blank" rel="noreferrer"
            onClick={() => !isLocal() && window.gtag?.('event', 'social_click', { platform: 'linkedin', transport_type: 'beacon' })}>
            <svg className="footer-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#0A66C2" d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            <span>linkedin</span>
          </a>
        </nav>

        <a className="footer-email-link" href="mailto:hi@vaibhavmodi.com">
          Reach out to me at <span>hi@vaibhavmodi.com</span>
        </a>
      </div>
    </footer>
  );
}

function App() {
  const [pathname, setPathname] = useState(() => normalizePathname(window.location.pathname));
  const pathView = pathname === '/' ? 'home' : pathname.slice(1);
  const currentView = validViews.has(pathView) ? pathView : 'not-found';

  const openView = (view) => {
    const nextPath = view === 'home' ? '/' : `/${view}`;
    if (window.location.pathname !== nextPath) {
      window.history.pushState(
        {
          appPath: view,
          fromHome: currentView === 'home',
        },
        '',
        nextPath
      );
      setPathname(nextPath);
    }
  };

  const goHome = () => {
    if (currentView === 'home') {
      return;
    }

    if (window.history.state?.fromHome) {
      window.history.back();
      return;
    }

    window.history.replaceState({ appPath: 'home', fromHome: false }, '', '/');
    setPathname('/');
  };

  useEffect(() => {
    const meta = routeMeta[currentView] ?? routeMeta['not-found'];
    const path = currentView === 'home'
      ? '/'
      : currentView === 'not-found'
        ? pathname
        : `/${currentView}`;
    document.title = meta.title;
    upsertMeta('name', 'description', meta.description);
    upsertMeta('property', 'og:title', meta.title);
    upsertMeta('property', 'og:description', meta.description);
    if (currentView !== 'not-found') {
      upsertMeta('property', 'og:url', `${SITE_URL}${path}`);
    }
    upsertMeta('name', 'twitter:title', meta.title);
    upsertMeta('name', 'twitter:description', meta.description);
    upsertMeta('name', 'robots', currentView === 'not-found' ? 'noindex' : 'all');
    if (currentView === 'not-found') {
      document.head.querySelector('link[rel="canonical"]')?.remove();
    } else {
      upsertCanonical(`${SITE_URL}${path}`);
    }
    const isLocal = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(window.location.hostname);
    if (typeof window.gtag === 'function' && !isLocal) {
      window.gtag('event', 'page_view', {
        page_path: path,
        page_title: meta.title,
        page_location: window.location.origin + path,
      });
    }
  }, [currentView, pathname]);

  useEffect(() => {
    let timer;
    const handleVisibility = () => {
      clearTimeout(timer);
      if (document.hidden) {
        document.documentElement.classList.add('tab-hidden');
        document.title = 'you left something here 👀';
      } else {
        document.title = document.title !== 'you left something here 👀'
          ? document.title
          : (routeMeta[currentView]?.title ?? routeMeta.home.title);

        // hold red for 2s so user sees it, then transition to green
        timer = setTimeout(() => {
          document.documentElement.classList.remove('tab-hidden');
        }, 500);
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(timer);
    };
  }, [currentView]);

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };

    window.history.replaceState(
      {
        appPath: currentView,
        fromHome: window.history.state?.fromHome ?? false,
      },
      '',
      window.location.pathname
    );

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView]);

  useEffect(() => {
    if (currentView !== 'home') {
      return undefined;
    }

    const preloadRoutes = () => {
      Object.values(routeLoaders).forEach((loadRoute) => {
        loadRoute();
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(preloadRoutes, { timeout: 3000 });
      return () => window.cancelIdleCallback(idleId);
    }

    const timerId = window.setTimeout(preloadRoutes, 2500);
    return () => window.clearTimeout(timerId);
  }, [currentView]);

  return (
    <div className="site-shell">
      <div className="site-noise" aria-hidden="true" />

      <main className="operator-stage">
        <Header activeView={currentView} goHome={goHome} switchLens={openView} />

        {currentView === 'home' ? (
          <HomeFrame openView={openView} />
        ) : currentView === 'not-found' ? (
          <NotFoundFrame goHome={goHome} />
        ) : (
          <RouteFrame key={currentView} view={currentView} goHome={goHome} />
        )}

        <Footer />
      </main>
      <Analytics />
      <SpeedInsights />
    </div>
  );
}

export default App;
