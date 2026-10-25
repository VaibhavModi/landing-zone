# Vaibhav Modi — Landing Zone

Personal site for Vaibhav Modi: a React 18 single-page app built with Vite and deployed on Vercel.

Production: [https://www.vaibhavmodi.com](https://www.vaibhavmodi.com)

The Vercel project is `landing-zone`. Pushes to `main` deploy automatically.

## Stack

- React 18 and Vite
- One serverless function, `api/steam-profile.js`, for the friend page
- Vercel Web Analytics and Speed Insights
- Google Analytics (GA4) and a Web3Forms contact form on the recruiter page

## Routes

| Path | What it is |
| --- | --- |
| `/` | Home gateway. Recruiter and Friend, with `R` and `F` shortcuts. |
| `/recruiter` | Work, resume preview, and the contact form. |
| `/friend` | Games pulled from `/api/steam-profile`. |
| anything else | In-app 404. On Vercel this is also an HTTP 404. |

`/recruiter` and `/friend` rewrite to `index.html`. Other unknown URLs are not rewritten; the build copies `index.html` to `404.html`, which Vercel serves with status 404. The app then renders the same 404 screen. `vite preview` still falls back to `index.html` with status 200, because it does not apply `vercel.json`.

## Run locally

Node 20 or newer (`nvm` will read `.nvmrc`). npm 10 or newer.

```bash
npm ci
npm run dev
```

`npm run build` writes `dist/`. `npm run preview` serves that build.

Copy `.env.example` to `.env.local` when you need the optional integrations:

- `VITE_STEAM_PROXY_URL` — only if the friend page should call a deployed `/api/steam-profile` instead of the relative path.
- `STEAM_PROFILE_ID`, `STEAM_SHOWCASE_APPIDS`, and `STEAM_API_KEY` — used by the serverless function on Vercel, not by the Vite client.
- `VITE_WEB3FORMS_KEY` — public Web3Forms access key for the recruiter contact form. Set it in the Vercel project for **both Production and Preview** before merging a change that depends on it. Vite inlines `VITE_` variables at build time. If the key is missing, the form shows a message asking visitors to email hi@vaibhavmodi.com.

## Deploy

The site deploys from `main` on the existing Vercel project. Security headers live in `vercel.json`. Do not change the Vercel project settings from this repo's workflow; environment variables are set in the Vercel dashboard.

`/api/steam-profile` accepts browser calls from `https://www.vaibhavmodi.com`, `https://vaibhavmodi.com`, and `landing-zone*.vercel.app` preview hosts. Failures are logged on the server and returned to the client as a generic error.

## CI

`.github/workflows/ci.yml` runs on pull requests to `main` and on pushes to `main`. The job name is `ci` (the GitHub check is `CI / ci`). It installs with `npm ci`, builds, and scans the pull request or push commit range with gitleaks. There is no lint or typecheck script in this project, so CI does not run those steps.
