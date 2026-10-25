import { useEffect, useState } from 'react';

const DEFAULT_STEAM_PROXY_PATH = '/api/steam-profile';
const STEAM_PROXY_URL = import.meta.env.VITE_STEAM_PROXY_URL?.trim() || DEFAULT_STEAM_PROXY_PATH;

const showcaseNotesByApp = {
  271590: {
    note: 'Open-world sandbox comfort food.',
    tags: ['chaos', 'sandbox'],
  },
  578080: {
    note: 'Tactical enough to stay interesting, messy enough to stay funny.',
    tags: ['squad', 'strategy'],
  },
  730: {
    note: 'The classic competitive fallback.',
    tags: ['fps', 'competitive'],
  },
  570: {
    note: 'Easy to respect, harder to explain.',
    tags: ['moba', 'deep'],
  },
  1172470: {
    note: 'Fast rounds, clean movement, low-friction fun.',
    tags: ['arcade', 'squad'],
  },
};

const buildGameHeaderImage = (appid) => (
  `https://shared.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`
);

const normalizePayload = (payload) => {
  const games = payload?.showcaseGames
    ?? payload?.games
    ?? payload?.showcase_games
    ?? [];

  return {
    games: Array.isArray(games) ? games : [],
  };
};

async function loadShowcase(signal) {
  const response = await fetch(STEAM_PROXY_URL, { signal });

  if (!response.ok) {
    throw new Error(`steam-proxy-${response.status}`);
  }

  const payload = await response.json();
  return normalizePayload(payload);
}

function GameCard({ game }) {
  const localMeta = showcaseNotesByApp[game.appid] ?? {};
  const note = localMeta.note ?? 'A game that has stayed in the rotation for good reason.';
  const tags = localMeta.tags ?? [];
  const status = game.recentlyPlayed ? 'in recent rotation' : 'favorite pick';

  return (
    <article className="steam-showcase-card">
      <img
        className="steam-showcase-card__art"
        src={buildGameHeaderImage(game.appid)}
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.classList.add('is-broken');
        }}
      />

      <div className="steam-showcase-card__body">
        <div className="steam-showcase-card__topline">
          <p className="steam-showcase-card__name">{game.name}</p>
          <span className="steam-showcase-card__status">{status}</span>
        </div>

        <p className="steam-showcase-card__note">{note}</p>

        {tags.length > 0 && (
          <div className="steam-showcase-card__tags" aria-label={`${game.name} tags`}>
            {tags.map((tag) => (
              <span className="steam-showcase-card__tag" key={`${game.appid}-${tag}`}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function FriendPage() {
  const [games, setGames] = useState([]);
  const [loadingState, setLoadingState] = useState('loading');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    loadShowcase(controller.signal)
      .then((payload) => {
        setGames(payload.games);
        setLoadingState('ready');
      })
      .catch((error) => {
        if (error.name === 'AbortError') {
          return;
        }

        setLoadingState('error');
        setLoadError(error.message);
      });

    return () => controller.abort();
  }, []);

  return (
    <section className="friend-page">
      <div className="friend-page__intro">
        <h1 className="friend-page__title">Games I&apos;m currently playing</h1>
        <p className="friend-page__subtitle">
          A quick look at the games I&apos;ve been spending time with lately.
        </p>
      </div>

      {loadingState === 'loading' && (
        <section className="steam-card steam-card--message" aria-live="polite">
          <p className="steam-card__message-title">Loading game showcase...</p>
          <p className="steam-card__message-body">Pulling the approved list from the backend.</p>
        </section>
      )}

      {loadingState === 'error' && (
        <section className="steam-card steam-card--message steam-card--error" aria-live="polite">
          <p className="steam-card__message-title">The game showcase could not load.</p>
          <p className="steam-card__message-body">
            {loadError.includes('404')
              ? 'The backend is missing a valid Steam profile configuration.'
              : 'Check the Vercel Steam env vars and the allowlist, then try again.'}
          </p>
        </section>
      )}

      {loadingState === 'ready' && (
        <section className="steam-card steam-card--showcase">
          <div className="steam-card__body steam-card__body--showcase">
            <div className="steam-section">
              <div className="steam-section__title">curated steam shelf</div>
              <div className="steam-showcase-grid">
                {games.map((game) => (
                  <GameCard game={game} key={game.appid} />
                ))}
              </div>
            </div>

            {games.length === 0 && (
              <div className="steam-showcase-empty">
                <p className="steam-showcase-empty__title">No showcase games are configured yet.</p>
                <p className="steam-showcase-empty__body">
                  Add a few app ids to the backend allowlist and this section will stay curated by design.
                </p>
              </div>
            )}

            <div className="steam-card__footer steam-card__footer--showcase">
              <p className="steam-card__footer-copy">Curated to keep the signal, not the metadata.</p>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
