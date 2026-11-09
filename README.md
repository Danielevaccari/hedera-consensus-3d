# Hedera Mainnet Consensus 3D

A live 3D view of Hedera mainnet in two views that share one data feed:

- **Tower**: each column is a real consensus node (sphere size = stake) and every dot is a real
  transaction placed in the column of the node it was submitted to, at its consensus timestamp.
  Time flows downward.
- **Globe**: each node at its host city, spikes for transactions received, and arcs along the real
  consensus order from one transaction to the next. Switch with the Tower/Globe control or open
  `/?view=globe`.

All data comes straight from the public
[Hedera mirror node](https://docs.hedera.com/hedera/sdks-and-apis/rest-api); there is no backend.

Below the 3D view, a short explainer covers the main pieces of the hashgraph algorithm (gossip
about gossip, events, rounds and witnesses, virtual voting, consensus timestamps, finality).

## Features

- Dark and flashy by default; a light theme and a calm style are one click away (remembered,
  applied before first paint). Flashy works in both themes: bloom and starfield on dark, pastel washes and coloured
  shadows on light
- Live tower of the last 2 minutes of mainnet transactions, blocks (record files) and the
  replayed consensus clock; unroll it into a flat wall
- Transaction journey: follow one transaction from signing to its block
- Ledger in consensus order, network log, optional live charts (tx/s, type mix, tx per node)
- Whale alerts for HBAR transfers ≥ $10k, optional hiding of Hedera's health-check pings
- Switching between Tower and Globe animates: the nodes fly from the ring to their cities (and back)
  while recent transactions stream between their columns and their node
- The globe has a real day and night side, driven by the sun's position at the current UTC time
- A big "transactions since you opened this page" counter greets new visitors
- A subtle image parallax from tilting a phone (where the browser allows it without a prompt)
- Presentation mode (`P`)
- Uncluttered layout: the 3D view fills the screen with one tabbed side drawer; on phones the view
  is the first thing on screen and the drawer sits below it

## Stack

React 19, TypeScript, Vite, three.js. Hosted on Netlify.

## Getting started

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run lint
npm run format
```

## Project structure

```
src/
  config.ts              constants: mirror-node URLs, tower geometry, kinds, storage keys
  api/                   typed, rate-limited mirror-node client (retries 429/5xx, abortable)
  engine/                framework-free live model
    LiveState.ts         nodes, transactions, blocks, consensus clock, tracking
    Feed.ts              boot, polling, history backfill, prices and token names
    Market.ts            HBAR/USD, token metadata, transaction summaries
    Engine.ts            wires state + feed + scene, runs the frame loop, exposes UI stores
    snapshot.ts          read-only view models for React (stats, ledger, tracker, charts)
  scene/                 three.js rendering, one renderer shared by two views
    TowerView.ts         the tower; globe/GlobeView.ts the globe (View3D is their interface)
    palette.ts           colours per theme; renderer.ts shared renderer and bloom chain
  charts/                2D canvas chart drawing
  components/            React UI (top bar, tabbed drawer, controls, popovers, tooltip, explainer)
  hooks/                 useStore, keyboard shortcuts, media queries, drawer state
  styles/                global CSS split by area (base tokens, stage, panels, explainer, flashy)
```

The render loop never goes through React: the active view draws every frame with three.js and `Engine` publishes
a UI snapshot about five times a second through a small store that components read with
`useSyncExternalStore`.

## Deploying to Netlify

`netlify.toml` holds the build settings (`npm run build`, publish `dist`, Node 22). In Netlify,
choose **Add new site → Import an existing project → GitHub** and pick this repository; every
push to `main` then deploys automatically.

## Data notes

The view runs a few seconds behind real time because the mirror node publishes each record file
a few seconds after consensus. Hedera does not publish the gossip graph itself (events, rounds,
witnesses, votes), so the explainer describes those steps but the 3D view does not draw them.
