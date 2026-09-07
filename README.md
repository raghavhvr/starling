# Starling — Influencer Intelligence by Nestlé

Nestlé's influencer intelligence platform for data-driven creator strategy and campaign management across MENA. Covers the full workflow from brief to measurement: creator discovery and scoring, campaign briefs, workflow management, content calendar, financial governance, a Business/Brand/Media/Governance measurement framework with live Picture-of-Success tracking, and a creator-facing portal.

Focus brands: **Maggi**, **NIDO** and **S-26**, with support for the wider Nestlé portfolio (Nescafé, Milo, Nesquik, KitKat, Cerelac, Nestlé Pure Life) across four clusters: Culinary (CUL), Dairy & Nutrition (DAI), Beverages (BEV), and Confectionery (CNF). Powered by WPP.

## Tech stack

- Vite + React + TypeScript
- shadcn/ui + Tailwind CSS
- Supabase (auth, database, edge functions)
- TanStack Query, React Router

## Getting started

```sh
npm i
cp .env.example .env   # fill in your Supabase project values
npm run dev
```

Dev server runs at http://localhost:8080.

## Deploying to Cloudflare Pages

1. Push this repo to GitHub.
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git** and select the repo.
3. Build settings:
   - **Framework preset**: Vite (or None)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
4. **Environment variables** (Production & Preview):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PROJECT_ID`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
5. Deploy. SPA routing is handled by `public/_redirects` (`/* → /index.html 200`), so deep links like `/measurement` work on refresh.

To deploy from the CLI instead: `npm run build && npx wrangler pages deploy dist`.

## Data & scripts

- `scripts/transform-roster.mjs` — converts the Nestlé MENA creator roster Excel into importable creator rows (ER/ROI/CPV/SOI derived from the performance sheet).
- `scripts/seed-demo-admin.mjs` / `scripts/check-demo-login.mjs` — demo admin account utilities.
- `supabase/migrations` + `supabase/functions` — full schema and edge functions (including the Nestlé-native `chat-starling` assistant), ready to deploy to a dedicated Supabase project.

## Setup notes

- **Supabase**: the app currently points at the original shared Supabase project; Starling scopes itself to Nestlé data via native cluster codes. For full separation, create a dedicated Supabase project, run the migrations, deploy the functions in `supabase/functions`, and update the env vars.
- **Demo login**: `admin@starling.demo` / `Maggi2026!` (requires email confirmation disabled in Supabase Auth settings, then re-run `scripts/seed-demo-admin.mjs`).
- **Chat assistant**: the client prefers the `chat-starling` edge function and falls back to the legacy shared function (with injected Starling context) until it is deployed: `npx supabase functions deploy chat-starling --project-ref <ref>`.
- **Brand assets**: official Nestlé, Maggi, NIDO and WPP logos are in `src/assets`. Still pending: S-26/Nescafé/KitKat logo files (text-chip fallback renders meanwhile), and a Create Brief hero product visual.
- **BigQuery**: creator history queries point at `wavemaker-mena-groupm.Nestle.Nestle_main_media` — update when the Nestlé media dataset is provisioned.
- **Virlo**: live niche discovery and cross-platform trends activate when the Virlo account has credits; local (self-managed) niches work without it.
