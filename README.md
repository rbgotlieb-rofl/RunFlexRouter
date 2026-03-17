# RunFlexRouter

A running route generator that creates circular and point-to-point routes based on your location and preferences, using Mapbox for maps and routing.

## Tech Stack

- **Frontend:** React, TypeScript, Tailwind CSS, Mapbox GL
- **Backend:** Express, TypeScript
- **Database:** Neon (PostgreSQL) via Drizzle ORM (falls back to in-memory if DATABASE_URL not set)
- **APIs:** Mapbox (Directions, Geocoding, Map Tiles)

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later)
- npm (comes with Node.js)

### Installation

1. Clone the repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/RunFlexRouter.git
   cd RunFlexRouter
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create your environment file:
   ```bash
   cp .env.example .env
   ```

4. Open `.env` and fill in your API keys:
   - `MAPBOX_ACCESS_TOKEN` -- get one at https://mapbox.com
   - `MAPBOX_PUBLIC_TOKEN` (optional) -- a URL-restricted token for client-side map rendering
   - `DATABASE_URL` (optional) -- PostgreSQL connection string for persistent storage

5. Start the dev server:
   ```bash
   npm run dev
   ```

6. Open http://localhost:5000 in your browser.

## How Route Generation Works

RunFlex uses an algorithmic approach to generate running routes:

1. **Circular loops** -- Places waypoints at calculated bearings around your start point, then uses Mapbox Directions API to snap them to real walkable/runnable paths. A binary search adjusts the radius until the route matches your target distance.

2. **Quality scoring** -- Each generated loop is scored on aspect ratio (roundness), midpoint distance (spread), and separation (no self-overlap). Poor-quality routes are filtered out.

3. **Route naming** -- Reverse geocoding at points along the route generates descriptive names like "Loop via Riverside Park".

## Scripts

- `npm run dev` -- Start the development server
- `npm run build` -- Build for production
- `npm run check` -- Run TypeScript type checking
- `npm run db:push` -- Push database schema migrations (requires DATABASE_URL)
