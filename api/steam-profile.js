import { clientIp, consumeRateLimit, STEAM_PROFILE_LIMIT, STEAM_PROFILE_WINDOW_MS } from './rate-limit.js';

const STEAM_API_BASE = 'https://api.steampowered.com';
const SUCCESS_CACHE = 'public, s-maxage=300, stale-while-revalidate=600';
const PRIVATE_CACHE = 'private, no-store';

const EXACT_ORIGINS = new Set([
  'https://vaibhavmodi.com',
  'https://www.vaibhavmodi.com',
  'https://landing-zone-omega.vercel.app',
]);

// This project's preview hosts only. Anchored so a lookalike suffix on another
// domain, another team's project, or a bare landing-zone.vercel.app cannot match.
const PREVIEW_ORIGIN = /^https:\/\/landing-zone-[a-z0-9-]+-vaibhav-modis-projects\.vercel\.app$/;

function readOrigin(request) {
  const origin = request.headers?.origin ?? request.headers?.Origin;
  if (Array.isArray(origin)) {
    return origin[0] || '';
  }
  return typeof origin === 'string' ? origin : '';
}

export function isAllowedOrigin(origin) {
  if (!origin) {
    return false;
  }

  if (EXACT_ORIGINS.has(origin)) {
    return true;
  }

  return PREVIEW_ORIGIN.test(origin);
}

function applyCors(request, response) {
  const origin = readOrigin(request);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (isAllowedOrigin(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
  }
}

function json(request, response, statusCode, body, cacheControl = PRIVATE_CACHE) {
  response.status(statusCode).setHeader('Content-Type', 'application/json');
  response.setHeader('Cache-Control', cacheControl);
  applyCors(request, response);
  response.send(JSON.stringify(body));
}

function readRequiredConfig() {
  const apiKey = process.env.STEAM_API_KEY?.trim();
  const profileId = process.env.STEAM_PROFILE_ID?.trim();
  const showcaseAppIds = (process.env.STEAM_SHOWCASE_APPIDS || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^\d+$/.test(value))
    .map((value) => Number(value));

  if (!apiKey) {
    throw new Error('missing-steam-api-key');
  }

  if (!profileId) {
    throw new Error('missing-steam-profile-id');
  }

  if (showcaseAppIds.length === 0) {
    throw new Error('missing-showcase-appids');
  }

  return { apiKey, profileId, showcaseAppIds };
}

function formatSteamApiUrl(pathname, params) {
  const url = new URL(`${STEAM_API_BASE}${pathname}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchSteam(pathname, params) {
  const response = await fetch(formatSteamApiUrl(pathname, params));

  if (!response.ok) {
    throw new Error(`steam-request-failed:${response.status}`);
  }

  return response.json();
}

async function resolveSteamId(apiKey, profileId) {
  if (/^\d{17}$/.test(profileId)) {
    return profileId;
  }

  const data = await fetchSteam('/ISteamUser/ResolveVanityURL/v1/', {
    key: apiKey,
    vanityurl: profileId,
  });

  if (data?.response?.success !== 1 || !data?.response?.steamid) {
    throw new Error('steam-profile-not-found');
  }

  return data.response.steamid;
}

function buildShowcaseGames(showcaseAppIds, ownedGames, recentGames) {
  const ownedLookup = new Map(ownedGames.map((game) => [Number(game.appid), game]));
  const recentIds = new Set(recentGames.map((game) => Number(game.appid)));

  return showcaseAppIds
    .map((appid) => {
      const ownedGame = ownedLookup.get(Number(appid));

      if (!ownedGame) {
        return null;
      }

      return {
        appid: Number(ownedGame.appid),
        name: ownedGame.name,
        recentlyPlayed: recentIds.has(Number(ownedGame.appid)),
      };
    })
    .filter(Boolean);
}

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    applyCors(request, response);
    response.status(204).send('');
    return;
  }

  if (request.method !== 'GET') {
    return json(request, response, 405, { error: 'method-not-allowed' });
  }

  // Best-effort per-IP limit for this instance. See api/rate-limit.js.
  const limit = consumeRateLimit(
    `steam:${clientIp(request)}`,
    STEAM_PROFILE_LIMIT,
    STEAM_PROFILE_WINDOW_MS
  );
  if (!limit.allowed) {
    response.setHeader('Retry-After', String(limit.retryAfter));
    return json(request, response, 429, { error: 'rate-limited' });
  }

  try {
    const { apiKey, profileId, showcaseAppIds } = readRequiredConfig();
    const steamId = await resolveSteamId(apiKey, profileId);

    const [ownedGamesData, recentGamesData] = await Promise.all([
      fetchSteam('/IPlayerService/GetOwnedGames/v1/', {
        key: apiKey,
        steamid: steamId,
        include_appinfo: true,
        include_played_free_games: true,
      }),
      fetchSteam('/IPlayerService/GetRecentlyPlayedGames/v1/', {
        key: apiKey,
        steamid: steamId,
        count: 20,
      }),
    ]);

    const ownedGames = ownedGamesData?.response?.games ?? [];
    const recentlyPlayed = recentGamesData?.response?.games ?? [];
    const showcaseGames = buildShowcaseGames(showcaseAppIds, ownedGames, recentlyPlayed);

    return json(request, response, 200, {
      showcaseGames,
    }, SUCCESS_CACHE);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown-error';
    const statusCode = (
      message === 'steam-profile-not-found'
        ? 404
        : message.startsWith('missing-')
          ? 500
          : message.startsWith('steam-request-failed:')
            ? 502
            : 500
    );

    console.error('[steam-profile]', message);
    return json(request, response, statusCode, { error: 'unavailable' });
  }
}
